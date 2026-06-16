export type UiFieldSpec = {
  default?: string | number | boolean;
  name: string;
  required?: boolean;
  schema?: Record<string, unknown>;
  valueKind?: 'string' | 'number' | 'boolean' | 'string-array' | 'json';
};

export type ChainRunInputParts = {
  imageModel: string;
  imageModelInput?: Record<string, unknown>;
  modifyModel?: string;
  modifyModelInput?: Record<string, unknown>;
  refineModel?: string;
  refineModelInput?: Record<string, unknown>;
  videoModel: string;
  videoModelInput?: Record<string, unknown>;
};

export type ChainRunRequestBody = {
  input: Record<string, unknown>;
};

const IDEMPOTENCY_KEY_PLACEHOLDER = 'your-unique-idempotency-key';
const EMPTY_KEYS = new Set<string>();

export function createModelSchemaJsonFromFields({
  fields,
  modelId,
  modelLabel,
}: {
  fields: readonly UiFieldSpec[];
  modelId: string;
  modelLabel: string;
}) {
  const required = fields
    .filter((field) => field.required)
    .map((field) => field.name);

  return {
    model: modelLabel,
    model_identifier: modelId,
    schema: {
      type: 'object',
      ...(required.length > 0 ? { required } : {}),
      properties: Object.fromEntries(
        fields.map((field, index) => [
          field.name,
          createModelSchemaProperty(field, index),
        ]),
      ),
    },
  };
}

export function createModelSchemaJsonFromRequestSchema({
  excludedKeys = EMPTY_KEYS,
  modelId,
  modelLabel,
  schema,
}: {
  excludedKeys?: ReadonlySet<string>;
  modelId: string;
  modelLabel: string;
  schema: Record<string, unknown>;
}) {
  const required = new Set(readStringArray(schema.required));
  const properties = isJsonObject(schema.properties) ? schema.properties : {};
  const orderedProperties: Record<string, unknown> = {};
  let order = 0;

  for (const [key, propertySchema] of Object.entries(properties)) {
    if (excludedKeys.has(key)) {
      continue;
    }

    orderedProperties[key] = normalizeSchemaProperty(propertySchema, {
      includeOrder: true,
      order,
      required: required.has(key),
    });
    order += 1;
  }

  return {
    model: modelLabel,
    model_identifier: modelId,
    schema: {
      type: 'object',
      ...(required.size > 0
        ? {
            required: [...required].filter((key) => !excludedKeys.has(key)),
          }
        : {}),
      properties: orderedProperties,
    },
  };
}

export function createStepInputFromValues({
  excludedKeys = EMPTY_KEYS,
  fields,
  values,
}: {
  excludedKeys?: ReadonlySet<string>;
  fields: readonly Pick<UiFieldSpec, 'name'>[];
  values: Record<string, unknown>;
}) {
  const fieldNames = new Set(fields.map((field) => field.name));

  return Object.fromEntries(
    Object.entries(values).filter(
      ([key, value]) =>
        fieldNames.has(key) &&
        !excludedKeys.has(key) &&
        isMeaningfulRequestValue(value),
    ),
  );
}

export function createChainRunInput({
  imageModel,
  imageModelInput,
  modifyModel,
  modifyModelInput,
  refineModel,
  refineModelInput,
  videoModel,
  videoModelInput,
}: ChainRunInputParts) {
  return {
    chain_models: {
      image_model: imageModel,
      ...(refineModel ? { refine_model: refineModel } : {}),
      video_model: videoModel,
      ...(modifyModel ? { modify_model: modifyModel } : {}),
    },
    image_model_input: compactRequestObject(imageModelInput ?? {}),
    ...(refineModel
      ? { refine_model_input: compactRequestObject(refineModelInput ?? {}) }
      : {}),
    video_model_input: compactRequestObject(videoModelInput ?? {}),
    ...(modifyModel
      ? { modify_model_input: compactRequestObject(modifyModelInput ?? {}) }
      : {}),
  };
}

export function createChainRunRequest(input: Record<string, unknown>) {
  return { input } satisfies ChainRunRequestBody;
}

export function createChainRunCurl(input: Record<string, unknown>) {
  const lines = [
    'curl --request POST',
    '  --url "$NEXT_PUBLIC_SITE_URL/api/v1/chains/runs"',
    '  --header "Authorization: Bearer $BABYCHAIN_API_KEY"',
    '  --header "Content-Type: application/json"',
    `  --header "Idempotency-Key: ${IDEMPOTENCY_KEY_PLACEHOLDER}"`,
    `  --data '${JSON.stringify(createChainRunRequest(input), null, 2)}'`,
  ];

  return lines.join(lineContinuation());
}

function createModelSchemaProperty(field: UiFieldSpec, order: number) {
  const property: Record<string, unknown> = field.schema
    ? { ...field.schema }
    : { type: jsonSchemaTypeForField(field) };

  if (field.required) {
    property.required = true;
  }

  property['x-order'] = order;

  return property;
}

function jsonSchemaTypeForField(field: UiFieldSpec) {
  if (field.valueKind === 'json') return 'object';
  if (field.valueKind === 'string-array') return 'array';
  if (field.valueKind === 'number') return 'number';
  if (field.valueKind === 'boolean') return 'boolean';
  return 'string';
}

function normalizeSchemaProperty(
  value: unknown,
  options: { includeOrder: boolean; order: number; required: boolean },
): Record<string, unknown> {
  if (!isJsonObject(value)) {
    return {
      type: 'string',
      ...(options.required ? { required: true } : {}),
      ...(options.includeOrder ? { 'x-order': options.order } : {}),
    };
  }

  const output: Record<string, unknown> = {};

  for (const key of JSON_SCHEMA_COPY_KEYS) {
    if (value[key] !== undefined) {
      output[key] = value[key];
    }
  }

  for (const key of JSON_SCHEMA_VARIANT_KEYS) {
    const variants = value[key];

    if (Array.isArray(variants)) {
      output[key] = variants.map((variant) =>
        normalizeSchemaProperty(variant, {
          includeOrder: false,
          order: 0,
          required: false,
        }),
      );
    }
  }

  if (isJsonObject(value.items)) {
    output.items = normalizeSchemaProperty(value.items, {
      includeOrder: false,
      order: 0,
      required: false,
    });
  }

  if (isJsonObject(value.properties)) {
    output.properties = Object.fromEntries(
      Object.entries(value.properties).map(([key, property]) => [
        key,
        normalizeSchemaProperty(property, {
          includeOrder: false,
          order: 0,
          required: false,
        }),
      ]),
    );
  }

  if (options.required) {
    output.required = true;
  }

  if (options.includeOrder) {
    output['x-order'] = options.order;
  }

  return output;
}

const JSON_SCHEMA_COPY_KEYS = [
  'type',
  'enum',
  'const',
  'default',
  'minimum',
  'maximum',
  'minLength',
  'maxLength',
  'minItems',
  'maxItems',
  'multipleOf',
  'format',
  'pattern',
] as const;

const JSON_SCHEMA_VARIANT_KEYS = ['oneOf', 'anyOf', 'allOf'] as const;

function compactRequestObject(value: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) =>
      isMeaningfulRequestValue(entry),
    ),
  );
}

function isMeaningfulRequestValue(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return false;
  }

  return !(Array.isArray(value) && value.length === 0);
}

function readStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function lineContinuation() {
  return ` ${String.fromCharCode(92)}\n`;
}
