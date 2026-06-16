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
const VIDEO_INPUT_FILE_URL = 'https://example.com/input-video.mp4';
const AUDIO_INPUT_FILE_URL = 'https://example.com/input-audio.wav';

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
    expect((example as JsonObject).generation_seed).toBe(42);
    expect((example as JsonObject).generation_prompt_extend).toBe(false);
    expect((example as JsonObject).generation_input_image_file).toEqual([
      IMAGE_INPUT_FILE_URL,
    ]);
  });

  it('generates default-backed examples from every registered model schema', () => {
    const models = listRegisteredModels();

    expect(models).toHaveLength(57);

    for (const modelIdentifier of models) {
      for (const role of CHAIN_STEP_ROLES) {
        const schema = createSemanticRequestSchema(modelIdentifier, {
          chainFieldMode: chainFieldModeForRole(role),
        });
        const properties = schema.properties as JsonObject;
        const example = createSchemaExample(schema, {
          audioInputFileUrl: AUDIO_INPUT_FILE_URL,
          imageInputFileUrl: IMAGE_INPUT_FILE_URL,
          preferredPrompt: '',
          videoInputFileUrl: VIDEO_INPUT_FILE_URL,
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

  it('only fabricates file URLs for media input fields', () => {
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
        audioInputFileUrl: AUDIO_INPUT_FILE_URL,
        imageInputFileUrl: IMAGE_INPUT_FILE_URL,
        preferredPrompt: '',
        videoInputFileUrl: VIDEO_INPUT_FILE_URL,
      },
    );

    expect(example).toEqual({
      generation_input_audio_file: [AUDIO_INPUT_FILE_URL],
      generation_input_image_file: [IMAGE_INPUT_FILE_URL],
      generation_input_video_file: [VIDEO_INPUT_FILE_URL],
    });
  });

  it('does not fabricate scalar values without schema defaults', () => {
    const example = createSchemaExample(
      {
        type: 'object',
        properties: {
          generation_prompt: { type: 'string' },
          generation_seed: { type: 'integer', minimum: 0, maximum: 100 },
          generation_moderation: { type: 'boolean' },
          generation_quality: { type: 'string', enum: ['low', 'medium'] },
        },
      },
      {
        imageInputFileUrl: IMAGE_INPUT_FILE_URL,
        preferredPrompt: 'A real user prompt',
      },
    );

    expect(example).toBeUndefined();
  });

  it('includes required generation_prompt from the supplied prompt', () => {
    const example = createSchemaExample(
      {
        type: 'object',
        required: ['generation_prompt'],
        properties: {
          generation_prompt: { type: 'string' },
          generation_seed: { type: 'integer', minimum: 0, maximum: 100 },
        },
      },
      {
        imageInputFileUrl: IMAGE_INPUT_FILE_URL,
        preferredPrompt: 'A real user prompt',
      },
    );

    expect(example).toEqual({
      generation_prompt: 'A real user prompt',
    });
  });

  it('does not invent required generation_prompt when no prompt exists', () => {
    const example = createSchemaExample(
      {
        type: 'object',
        required: ['generation_prompt'],
        properties: {
          generation_prompt: { type: 'string' },
        },
      },
      {
        imageInputFileUrl: IMAGE_INPUT_FILE_URL,
        preferredPrompt: '',
      },
    );

    expect(example).toBeUndefined();
  });
});

function shouldHaveGeneratedExample(key: string, schema: unknown) {
  if (!isJsonObject(schema)) {
    return false;
  }

  if (key === 'generation_input_image_file') {
    return true;
  }

  if (
    key === 'generation_input_video_file' ||
    key === 'generation_input_audio_file'
  ) {
    return true;
  }

  if ('default' in schema || 'const' in schema) {
    return true;
  }

  const type = getPreferredSchemaType(schema.type);

  if (type === 'array') {
    return false;
  }

  return type === 'object' && isJsonObject(schema.properties);
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
