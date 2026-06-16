type JsonObject = Record<string, unknown>;

type SchemaExampleContext = {
  audioInputFileUrl?: string;
  excludedKeys?: ReadonlySet<string>;
  imageInputFileUrl: string;
  key?: string;
  preferredPrompt: string;
  required?: boolean;
  videoInputFileUrl?: string;
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
    return schema.default;
  }

  if ('const' in schema) {
    return schema.const;
  }

  if (shouldUsePreferredPrompt(schema, context, type)) {
    const prompt = context.preferredPrompt.trim();

    return prompt ? prompt : undefined;
  }

  const variants = [schema.oneOf, schema.anyOf].flatMap((value) =>
    Array.isArray(value) ? value : [],
  );

  if (variants.length > 0) {
    return createSchemaExample(variants[0], context);
  }

  if (type === 'array') {
    if (context.key && isFileInputKey(context.key)) {
      const fileUrl = exampleFileUrlForKey(context.key, context);

      return fileUrl ? [fileUrl] : undefined;
    }

    const item = createSchemaExample(schema.items, context);

    return isUsefulArrayItem(item) ? [item] : undefined;
  }

  if (type === 'object' || isJsonObject(schema.properties)) {
    const properties = isJsonObject(schema.properties) ? schema.properties : {};
    const requiredKeys = new Set(
      Array.isArray(schema.required)
        ? schema.required.filter(
            (key): key is string => typeof key === 'string',
          )
        : [],
    );
    const entries = Object.entries(properties)
      .filter(([key]) => !context.excludedKeys?.has(key))
      .flatMap(([key, propertySchema]) => {
        const value = createSchemaExample(propertySchema, {
          ...context,
          key,
          required: requiredKeys.has(key),
        });

        return value === undefined ? [] : [[key, value]];
      });

    return entries.length > 0 ? Object.fromEntries(entries) : undefined;
  }

  return undefined;
}

function shouldUsePreferredPrompt(
  schema: JsonObject,
  context: SchemaExampleContext,
  type: string,
) {
  return (
    type === 'string' &&
    context.key === 'generation_prompt' &&
    (context.required === true || schema.required === true)
  );
}

function getPreferredSchemaType(type: unknown) {
  const types = Array.isArray(type) ? type : [type];

  return (
    types.find((value) => value !== 'null' && typeof value === 'string') ??
    'object'
  );
}

function isUsefulArrayItem(value: unknown) {
  if (value === undefined || value === null) {
    return false;
  }

  return typeof value !== 'string' || value.length > 0;
}

function isFileInputKey(key: string) {
  return /^generation_input_[a-z]+_file$/.test(key);
}

function exampleFileUrlForKey(key: string, context: SchemaExampleContext) {
  if (key.includes('_audio_')) {
    return context.audioInputFileUrl;
  }

  if (key.includes('_video_')) {
    return context.videoInputFileUrl;
  }

  return context.imageInputFileUrl;
}

function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
