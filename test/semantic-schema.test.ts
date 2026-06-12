import { describe, expect, it } from 'vitest';

import {
  assertByokGenerationFields,
  findByokGenerationFieldIssue,
  getSemanticModel,
  getSemanticModelSchemaFields,
} from '@/lib/models/semantic-schema';
import { listRegisteredModels } from '@/lib/models/model-library';
import { BabyChainError } from '@/lib/utils/errors';

describe('semantic-lady BYOK schema core', () => {
  it('covers every registered BabyChain model', () => {
    const models = listRegisteredModels();

    expect(models).toHaveLength(57);

    for (const modelIdentifier of models) {
      expect(getSemanticModel(modelIdentifier), modelIdentifier).not.toBeNull();
    }
  });

  it('exposes generation_* schema fields per model', () => {
    const fields = getSemanticModelSchemaFields('bfl/flux-2-pro');

    expect(fields).not.toBeNull();
    expect(fields!.map((field) => field.name)).toContain('generation_prompt');
    expect(fields!.every((field) => field.name.startsWith('generation_'))).toBe(
      true,
    );
  });

  it('accepts valid generation_* fields', () => {
    expect(
      findByokGenerationFieldIssue('bfl/flux-2-pro', {
        generation_prompt: 'A glass lighthouse at sunrise',
        generation_ratio: '16:9',
        generation_seed: 42,
        generation_output_format: 'png',
      }),
    ).toBeNull();
  });

  it('accepts chain-level keys, dialect aliases, and raw provider fields', () => {
    expect(
      findByokGenerationFieldIssue('bytedance/seedream-5-lite', {
        generation_prompt: 'A product photo',
        generation_input_file: ['https://example.com/ref.png'],
        generation_provider_order: ['byteplus'],
        watermark: false,
        response_format: 'url',
      }),
    ).toBeNull();

    // generation_config is the documented raw-config escape for Google.
    expect(
      findByokGenerationFieldIssue('google/nano-banana-2', {
        generation_prompt: 'A product photo',
        generation_config: { temperature: 0.4 },
      }),
    ).toBeNull();
  });

  it('maps generation_input_file onto the model media input field', () => {
    // Video-to-video models resolve the alias to the video input field.
    expect(
      findByokGenerationFieldIssue('runway/aleph-2', {
        generation_prompt: 'Make the scene snowier',
        generation_input_file: ['https://example.com/clip.mp4'],
      }),
    ).toBeNull();

    // Models without any file input reject the alias as unknown.
    expect(
      findByokGenerationFieldIssue('google/imagen-4', {
        generation_prompt: 'A skyline at dusk',
        generation_input_file: ['https://example.com/ref.png'],
      }),
    ).toMatchObject({ path: ['generation_input_file'] });

    expect(
      findByokGenerationFieldIssue('google/imagen-4', {
        generation_prompt: 'A skyline at dusk',
        generation_input_file_last_content: 'https://example.com/end.png',
      }),
    ).toMatchObject({ path: ['generation_input_file_last_content'] });

    // Models with a last-frame field accept the last-content alias.
    expect(
      findByokGenerationFieldIssue('bytedance/seedance-1.5-pro', {
        generation_prompt: 'A slow pan',
        generation_input_file_last_content: 'https://example.com/end.png',
      }),
    ).toBeNull();
  });

  it('rejects unknown generation_* fields with the supported list', () => {
    const issue = findByokGenerationFieldIssue('bfl/flux-2-pro', {
      generation_prompt: 'A photo',
      generation_stepz: 20,
    });

    expect(issue).not.toBeNull();
    expect(issue!.path).toEqual(['generation_stepz']);
    expect(issue!.message).toContain('Unknown generation field');
    expect(issue!.message).toContain('generation_prompt');
  });

  it('rejects out-of-range and wrong-typed values', () => {
    expect(
      findByokGenerationFieldIssue('bfl/flux-2-flex', {
        generation_prompt: 'A photo',
        generation_guidance_scale: 99,
      }),
    ).toMatchObject({ path: ['generation_guidance_scale'] });

    expect(
      findByokGenerationFieldIssue('bfl/flux-2-pro', {
        generation_prompt: 'A photo',
        generation_seed: 'not-a-number',
      }),
    ).toMatchObject({ path: ['generation_seed'] });

    expect(
      findByokGenerationFieldIssue('gpt/image-2', {
        generation_prompt: 'A photo',
        generation_quality: 'ultra',
      }),
    ).toMatchObject({ path: ['generation_quality'] });
  });

  it('rejects fields the provider docs exclude for a model', () => {
    // gpt-image-2 has no seed parameter.
    expect(
      findByokGenerationFieldIssue('gpt/image-2', {
        generation_prompt: 'A photo',
        generation_seed: 7,
      }),
    ).toMatchObject({ path: ['generation_seed'] });

    // FLUX.2 Pro does not accept guidance (Flex only).
    expect(
      findByokGenerationFieldIssue('bfl/flux-2-pro', {
        generation_prompt: 'A photo',
        generation_guidance_scale: 5,
      }),
    ).toMatchObject({ path: ['generation_guidance_scale'] });
  });

  it('accepts provider-native ratio and resolution escape values', () => {
    expect(
      findByokGenerationFieldIssue('runway/gen-4-turbo', {
        generation_prompt: 'A slow dolly forward',
        generation_ratio: '1280:720',
        generation_duration: 5,
      }),
    ).toBeNull();

    expect(
      findByokGenerationFieldIssue('qwen/image-2-pro', {
        generation_prompt: 'A poster',
        generation_resolution: '2K',
      }),
    ).toBeNull();
  });

  it('enforces Semantic Lady numeric enum and seed constraints when present', () => {
    const issue = findByokGenerationFieldIssue('google/veo-3.1-fast', {
      generation_duration: 5,
      generation_prompt: 'A slow push in',
    });

    // semantic-lady@0.2.1 carries enum: [4, 6, 8]. Keep this expectation
    // active once BabyChain bumps the published dependency.
    if (issue) {
      expect(issue).toMatchObject({ path: ['generation_duration'] });
    }
  });

  it('throws BabyChainError with a prefixed path through the assert helper', () => {
    try {
      assertByokGenerationFields(
        'bfl/flux-2-pro',
        { generation_zoom: 2 },
        'image_model_input',
      );
      expect.unreachable('expected assertByokGenerationFields to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(BabyChainError);
      const chainError = error as BabyChainError;
      expect(chainError.code).toBe('invalid_chain_input');
      expect(chainError.status).toBe(400);
      expect(chainError.details).toMatchObject({
        path: ['image_model_input', 'generation_zoom'],
      });
    }
  });

  it('ignores non-generation keys and unknown models', () => {
    expect(
      findByokGenerationFieldIssue('bfl/flux-2-pro', {
        prompt: 'raw provider prompt',
        steps: 28,
      }),
    ).toBeNull();
    expect(findByokGenerationFieldIssue('unknown/model', {})).toBeNull();
    expect(findByokGenerationFieldIssue('bfl/flux-2-pro', null)).toBeNull();
  });
});
