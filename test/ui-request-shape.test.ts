import { describe, expect, it } from 'vitest';

import {
  createChainRunCurl,
  createChainRunInput,
  createModelSchemaJsonFromRequestSchema,
  createStepInputFromRequestSchema,
  createStepInputFromValues,
} from '@/lib/chains/ui-request-shape';
import { createSemanticRequestSchema } from '@/lib/models/semantic-schema';

describe('UI request shape builders', () => {
  it('serializes user values and defaults, then omits missing no-default fields', () => {
    const fields = [
      { name: 'generation_prompt', valueKind: 'string' as const },
      { name: 'generation_width', valueKind: 'number' as const },
      { name: 'generation_height', default: 768, valueKind: 'number' as const },
      {
        name: 'generation_moderation',
        default: false,
        valueKind: 'boolean' as const,
      },
      {
        name: 'generation_input_image_file',
        valueKind: 'string-array' as const,
      },
    ];

    expect(
      createStepInputFromValues({
        fields,
        values: {
          generation_input_image_file: [],
          generation_prompt: 'A product frame',
          generation_width: 1024,
        },
      }),
    ).toEqual({
      generation_height: 768,
      generation_moderation: false,
      generation_prompt: 'A product frame',
      generation_width: 1024,
    });
  });

  it('uses schema defaults and omits missing no-default fields', () => {
    const schema = createSemanticRequestSchema('runway/gen-4-turbo', {
      chainFieldMode: 'downstream',
    });

    expect(
      createStepInputFromRequestSchema({
        schema,
        values: { generation_moderation: false },
      }),
    ).toEqual({
      generation_moderation: false,
    });
  });

  it('builds template cURL inputs from schema defaults without fake media URLs', () => {
    const schema = createSemanticRequestSchema('bfl/flux-1.1-pro');

    expect(createStepInputFromRequestSchema({ schema })).toEqual({
      generation_height: 768,
      generation_moderation: false,
      generation_output_format: 'jpeg',
      generation_prompt: '',
      generation_prompt_extend: false,
      generation_seed: 42,
      generation_width: 1024,
    });
  });

  it('builds cURL from the same request body sent to the backend', () => {
    const input = createChainRunInput({
      imageModel: 'bfl/flux-1.1-pro',
      imageModelInput: {
        generation_prompt: 'A product frame',
        generation_width: 1024,
      },
      videoModel: 'runway/gen-4-turbo',
      videoModelInput: {
        generation_aspect_ratio: '1280:720',
        generation_duration: 5,
        generation_prompt: 'Animate the image',
      },
    });
    const curl = createChainRunCurl(input);

    expect(curl).toContain(JSON.stringify({ input }, null, 2));
    expect(curl).not.toContain('https://example.com/image.png');
    expect(curl).not.toContain('client_reference_id');
    expect(curl).not.toContain('webhook_url');
  });

  it('builds ordered JSON schema without changing schema defaults', () => {
    const schema = createSemanticRequestSchema('bfl/flux-1.1-pro');
    const uiSchema = createModelSchemaJsonFromRequestSchema({
      modelId: 'bfl/flux-1.1-pro',
      modelLabel: 'FLUX 1.1 Pro',
      schema,
    });

    expect(uiSchema).toMatchObject({
      model: 'FLUX 1.1 Pro',
      model_identifier: 'bfl/flux-1.1-pro',
      schema: {
        type: 'object',
        properties: {
          generation_seed: {
            default: 42,
            minimum: -1,
            maximum: 4294967295,
          },
        },
      },
    });
  });
});
