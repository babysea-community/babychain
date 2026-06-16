import { describe, expect, it } from 'vitest';

import {
  CHAIN_STEP_ROLES,
  chainFieldModeForRole,
} from '@/lib/models/chain-schema';
import { createSchemaExample } from '@/lib/models/schema-example';
import { listRegisteredModels } from '@/lib/models/model-library';
import { createSemanticRequestSchema } from '@/lib/models/semantic-schema';

type JsonObject = Record<string, unknown>;

const IMAGE_INPUT_FILE_URL = 'https://example.com/input-image.png';

describe('schema example generation', () => {
  it('keeps FLUX 1.1 Pro schema fields visible in generated examples', () => {
    const schema = createSemanticRequestSchema('bfl/flux-1.1-pro');
    const example = createSchemaExample(schema, {
      imageInputFileUrl: IMAGE_INPUT_FILE_URL,
      preferredPrompt: '',
    });

    expect(isJsonObject(example)).toBe(true);
    expect(Object.keys(example as JsonObject)).toEqual(
      Object.keys(schema.properties as JsonObject),
    );
    expect((example as JsonObject).generation_seed).toBe(0);
    expect((example as JsonObject).generation_prompt_extend).toBe(false);
    expect((example as JsonObject).generation_input_image_file).toEqual([
      IMAGE_INPUT_FILE_URL,
    ]);
  });

  it('generates scalar examples from every registered model schema', () => {
    const models = listRegisteredModels();

    expect(models).toHaveLength(57);

    for (const modelIdentifier of models) {
      for (const role of CHAIN_STEP_ROLES) {
        const schema = createSemanticRequestSchema(modelIdentifier, {
          chainFieldMode: chainFieldModeForRole(role),
        });
        const properties = schema.properties as JsonObject;
        const example = createSchemaExample(schema, {
          imageInputFileUrl: IMAGE_INPUT_FILE_URL,
          preferredPrompt: '',
        });

        expect(isJsonObject(example), `${role}:${modelIdentifier}`).toBe(true);

        const exampleObject = example as JsonObject;

        for (const [key, propertySchema] of Object.entries(properties)) {
          if (!shouldHaveGeneratedExample(key, propertySchema)) {
            continue;
          }

          expect(
            Object.hasOwn(exampleObject, key),
            `${role}:${modelIdentifier}.${key}`,
          ).toBe(true);
        }
      }
    }
  });

  it('only fabricates file URLs for image input fields', () => {
    const example = createSchemaExample(
      {
        type: 'object',
        properties: {
          generation_input_audio_file: {
            type: 'array',
            items: { type: 'string', format: 'uri' },
          },
          generation_input_image_file: {
            type: 'array',
            items: { type: 'string', format: 'uri' },
          },
          generation_input_video_file: {
            type: 'array',
            items: { type: 'string', format: 'uri' },
          },
        },
      },
      {
        imageInputFileUrl: IMAGE_INPUT_FILE_URL,
        preferredPrompt: '',
      },
    );

    expect(example).toEqual({
      generation_input_image_file: [IMAGE_INPUT_FILE_URL],
    });
  });
});

function shouldHaveGeneratedExample(key: string, schema: unknown) {
  if (!isJsonObject(schema)) {
    return false;
  }

  if (key === 'generation_input_image_file') {
    return true;
  }

  const type = getPreferredSchemaType(schema.type);

  if (type === 'array') {
    return false;
  }

  return !(type === 'string' && schema.format === 'uri');
}

function getPreferredSchemaType(type: unknown) {
  const types = Array.isArray(type) ? type : [type];

  return (
    types.find((value) => value !== 'null' && typeof value === 'string') ??
    'object'
  );
}

function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
