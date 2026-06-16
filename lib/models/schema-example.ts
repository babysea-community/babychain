type JsonObject = Record<string, unknown>;

type SchemaExampleContext = {
  excludedKeys?: ReadonlySet<string>;
  imageInputFileUrl: string;
  key?: string;
  preferredPrompt: string;
};

export function createSchemaExample(
  schema: unknown,
  context: SchemaExampleContext,
): unknown {
  if (!isJsonObject(schema)) {
    return undefined;
  }

  const type = getPreferredSchemaType(schema.type);

  if ('default' in schema) {
    if (isValidSchemaExample(schema.default, schema, type)) {
      return schema.default;
    }
  }

  if ('const' in schema) {
    return schema.const;
  }

  const examples = Array.isArray(schema.examples) ? schema.examples : [];

  if (examples.length > 0) {
    const example = examples.find((value) =>
      isValidSchemaExample(value, schema, type),
    );

    if (example !== undefined) {
      return example;
    }
  }

  const variants = [schema.oneOf, schema.anyOf].flatMap((value) =>
    Array.isArray(value) ? value : [],
  );

  if (variants.length > 0) {
    return createSchemaExample(variants[0], context);
  }

  if (Array.isArray(schema.enum)) {
    const enumValue = schema.enum.find((value) =>
      isValidSchemaExample(value, schema, type),
    );

    if (enumValue !== undefined) {
      return enumValue;
    }
  }

  if (context.key && isPromptLikeKey(context.key)) {
    return context.preferredPrompt.trim() ? context.preferredPrompt : '';
  }

  if (type === 'array') {
    if (context.key === 'generation_input_image_file') {
      return [context.imageInputFileUrl];
    }

    const item = createSchemaExample(schema.items, context);

    return isUsefulArrayItem(item) ? [item] : undefined;
  }

  if (type === 'object' || isJsonObject(schema.properties)) {
    const properties = isJsonObject(schema.properties) ? schema.properties : {};
    const entries = Object.entries(properties)
      .filter(([key]) => !context.excludedKeys?.has(key))
      .flatMap(([key, propertySchema]) => {
        const value = createSchemaExample(propertySchema, {
          ...context,
          key,
        });

        return value === undefined ? [] : [[key, value]];
      });

    if (entries.length > 0) {
      return Object.fromEntries(entries);
    }

    return type === 'object' ? {} : undefined;
  }

  if (type === 'integer' || type === 'number') {
    const value = exampleNumberForSchema(schema, type);

    if (value !== undefined) {
      return value;
    }
  }

  if (type === 'boolean') {
    return false;
  }

  if (type === 'string') {
    return schema.format === 'uri' ? undefined : '';
  }

  return undefined;
}

function exampleNumberForSchema(schema: JsonObject, type: string) {
  const candidates = [0, schema.minimum, schema.maximum, 1].filter(
    (value): value is number =>
      typeof value === 'number' && Number.isFinite(value),
  );

  return candidates.find((value) => isValidSchemaExample(value, schema, type));
}

function getPreferredSchemaType(type: unknown) {
  const types = Array.isArray(type) ? type : [type];

  return (
    types.find((value) => value !== 'null' && typeof value === 'string') ??
    'object'
  );
}

function isValidSchemaExample(
  value: unknown,
  schema: JsonObject,
  type: string,
): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  if ('const' in schema) {
    return value === schema.const;
  }

  if (Array.isArray(schema.enum)) {
    return schema.enum.includes(value);
  }

  const variants = [schema.oneOf, schema.anyOf].flatMap((variant) =>
    Array.isArray(variant) ? variant : [],
  );

  if (variants.length > 0) {
    return variants.some((variant): boolean => {
      if (!isJsonObject(variant)) {
        return false;
      }

      return isValidSchemaExample(
        value,
        variant,
        getPreferredSchemaType(variant.type),
      );
    });
  }

  if (type === 'integer' || type === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return false;
    }

    if (type === 'integer' && !Number.isInteger(value)) {
      return false;
    }

    if (typeof schema.minimum === 'number' && value < schema.minimum) {
      return false;
    }

    if (typeof schema.maximum === 'number' && value > schema.maximum) {
      return false;
    }

    if (
      typeof schema.multipleOf === 'number' &&
      schema.multipleOf > 0 &&
      value % schema.multipleOf !== 0
    ) {
      return false;
    }

    return true;
  }

  if (type === 'string') {
    if (typeof value !== 'string') {
      return false;
    }

    if (
      typeof schema.minLength === 'number' &&
      value.length < schema.minLength
    ) {
      return false;
    }

    if (
      typeof schema.maxLength === 'number' &&
      value.length > schema.maxLength
    ) {
      return false;
    }

    return true;
  }

  if (type === 'boolean') {
    return typeof value === 'boolean';
  }

  if (type === 'array') {
    return Array.isArray(value);
  }

  if (type === 'object') {
    return isJsonObject(value);
  }

  return true;
}

function isUsefulArrayItem(value: unknown) {
  if (value === undefined || value === null) {
    return false;
  }

  return typeof value !== 'string' || value.length > 0;
}

function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isPromptLikeKey(key: string) {
  const normalized = key.toLowerCase();

  return (
    normalized !== 'image_prompt' &&
    (normalized === 'prompt' ||
      normalized === 'prompttext' ||
      normalized === 'prompt_text' ||
      normalized === 'text' ||
      normalized.endsWith('_prompt'))
  );
}
