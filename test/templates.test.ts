import type { GenerationParams } from 'babysea';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  assertChainTemplateInvariants,
  getChainTemplate,
  getChainTemplateSummaries,
  parseTemplateInput,
  resolveStepModel,
  selectChainTemplateSteps,
} from '@/lib/chains/templates';
import {
  isImageInputCapableModel,
  isImageToVideoChainModel,
  isVideoToVideoChainModel,
} from '@/lib/models/semantic-schema';
import type { ChainStepOutput, ChainTemplate } from '@/lib/chains/types';

const TEXT_IMAGE_MODEL = 'bfl/flux-1.1-pro';
const REFINE_IMAGE_MODEL = 'bytedance/seedream-5-lite';
const VIDEO_MODEL = 'bytedance/seedance-1.5-pro';
const VALIDATION_IMAGE_URL =
  'https://imagedelivery.net/ub24fjUytZQ3JbssUo49_w/97d9a23a-2a4e-4543-4b3b-199516ad6c00/1280x720';

describe('chain templates', () => {
  it('exposes built-in model chains as API engine summaries', () => {
    const summaries = getChainTemplateSummaries();

    expect(summaries.map((summary) => summary.slug)).toEqual(['chain']);
    expect(summaries.map((summary) => summary.object)).toEqual([
      'chain_template',
    ]);
    expect(summaries.map((summary) => summary.steps.length)).toEqual([4]);
    expect(summaries.map((summary) => summary.title)).toEqual([
      'image model → optional image model → image-to-video → optional video-to-video',
    ]);
  });

  it('advertises one image-model chain contract', () => {
    const [summary] = getChainTemplateSummaries();
    const fields = summary!.input_fields;

    expect(fields.some((field) => field.name === 'source_image_url')).toBe(
      false,
    );
    expect(fields.some((field) => field.name === 'workflow')).toBe(false);
    expect(fields.some((field) => field.name === 'image_prompt')).toBe(false);
    expect(fields.some((field) => field.name === 'video_duration')).toBe(false);
    expect(fields.some((field) => field.name === 'provider_order')).toBe(false);
    expect(fields).toContainEqual(
      expect.objectContaining({
        name: 'image_model',
        required: true,
      }),
    );
    expect(
      fields.filter((field) => field.name === 'image_model_input'),
    ).toEqual([
      expect.objectContaining({
        name: 'image_model_input',
        required: false,
      }),
    ]);
    expect(fields).toContainEqual(
      expect.objectContaining({
        name: 'refine_model',
        required: false,
      }),
    );
    expect(fields).toContainEqual(
      expect.objectContaining({
        name: 'modify_model',
        required: false,
      }),
    );
    expect(fields).toContainEqual(
      expect.objectContaining({
        name: 'modify_model_input',
        required: false,
      }),
    );
  });

  it('only resolves the chain template slug', () => {
    expect(getChainTemplate('chain')?.slug).toBe('chain');
    expect(getChainTemplate('chain1')).toBeNull();
    expect(getChainTemplate('chain2')).toBeNull();
    expect(getChainTemplate('chain3')).toBeNull();
    expect(getChainTemplate('image-to-video')).toBeNull();
    expect(getChainTemplate('text-to-image--image-to-video')).toBeNull();
    expect(getChainTemplate('image-to-image--image-to-video')).toBeNull();
  });

  it('derives image-input capability from Semantic Lady workflows', () => {
    expect(isImageInputCapableModel('bfl/flux-1.1-pro')).toBe(true);
    expect(isImageInputCapableModel('bfl/flux-1.1-pro-ultra')).toBe(true);
    expect(isImageInputCapableModel('runway/gen-4-image')).toBe(true);
    expect(isImageInputCapableModel('runway/gen-4-image-turbo')).toBe(true);
    expect(isImageInputCapableModel('google/nano-banana')).toBe(true);
    expect(isImageInputCapableModel('google/nano-banana-2')).toBe(true);
    expect(isImageInputCapableModel('google/nano-banana-pro')).toBe(true);
    expect(isImageInputCapableModel('gpt/image-2')).toBe(true);
    // Text-to-image-only models are not refine-capable.
    expect(isImageInputCapableModel('google/imagen-4')).toBe(false);
    expect(isImageInputCapableModel('qwen/image-max')).toBe(false);
    expect(isImageInputCapableModel('z/image-turbo')).toBe(false);
    expect(isImageInputCapableModel('wan/2.6-t2i')).toBe(false);
  });

  it('derives video step roles from Semantic Lady workflows', () => {
    expect(isImageToVideoChainModel('bytedance/seedance-1.5-pro')).toBe(true);
    expect(isImageToVideoChainModel('google/veo-3.1')).toBe(true);
    expect(isImageToVideoChainModel('runway/gen-4-turbo')).toBe(true);
    expect(isImageToVideoChainModel('wan/2.7-r2v')).toBe(true);
    // Text-to-video-only, performance-transfer, and edit-only models are
    // not wireable as the chain image-to-video step.
    expect(isImageToVideoChainModel('wan/2.7-t2v')).toBe(false);
    expect(isImageToVideoChainModel('happyhorse/1.0-t2v')).toBe(false);
    expect(isImageToVideoChainModel('runway/act-two')).toBe(false);
    expect(isImageToVideoChainModel('wan/2.2-animate-mix')).toBe(false);
    expect(isImageToVideoChainModel('wan/2.2-animate-move')).toBe(false);
    expect(isImageToVideoChainModel('runway/aleph-2')).toBe(false);

    expect(isVideoToVideoChainModel('runway/aleph-2')).toBe(true);
    expect(isVideoToVideoChainModel('runway/gen-4-aleph')).toBe(true);
    expect(isVideoToVideoChainModel('wan/2.7-videoedit')).toBe(true);
    expect(isVideoToVideoChainModel('happyhorse/1.0-video-edit')).toBe(true);
    // Seedance 2.0 supports multimodal video references, so it can modify.
    expect(isVideoToVideoChainModel('bytedance/seedance-2.0')).toBe(true);
    expect(isVideoToVideoChainModel('bytedance/seedance-2.0-fast')).toBe(true);
    expect(isVideoToVideoChainModel('bytedance/seedance-1.5-pro')).toBe(false);
    expect(isVideoToVideoChainModel('runway/act-two')).toBe(false);
    expect(isVideoToVideoChainModel('wan/2.2-animate-mix')).toBe(false);
  });

  it('allows raw Google image input on the first image step', () => {
    const template = getChainTemplate('chain');

    expect(() =>
      parseTemplateInput(
        template!,
        {
          image_model: 'google/nano-banana-2',
          image_model_input: {
            contents: [
              {
                role: 'user',
                parts: [
                  { text: 'Refine this source image.' },
                  {
                    inlineData: {
                      data: 'aW1hZ2U=',
                      mimeType: 'image/png',
                    },
                  },
                ],
              },
            ],
          },
          video_model: 'google/veo-3.1-lite',
          video_model_input: {
            prompt: 'Animate the generated image.',
            parameters: { durationSeconds: '4', resolution: '720p' },
          },
        },
        { byokMode: true },
      ),
    ).not.toThrow();
  });

  it('validates generation_* fields against semantic-lady in BYOK mode', () => {
    const template = getChainTemplate('chain');
    const buildInput = (imageModelInput: Record<string, unknown>) => ({
      image_model: TEXT_IMAGE_MODEL,
      image_model_input: imageModelInput,
      video_model: VIDEO_MODEL,
      video_model_input: { generation_duration: 5 },
    });

    // Unknown generation field is rejected with the input path.
    expect(() =>
      parseTemplateInput(
        template!,
        buildInput({
          generation_prompt: 'A photo',
          generation_stepz: 28,
        }),
        { byokMode: true },
      ),
    ).toThrowError(/Unknown generation field "generation_stepz"/);

    // Invalid enum value is rejected.
    expect(() =>
      parseTemplateInput(
        template!,
        buildInput({
          generation_prompt: 'A photo',
          generation_output_format: 'tiff',
        }),
        { byokMode: true },
      ),
    ).toThrowError(/generation_output_format must be one of/);

    // Valid semantic fields plus raw provider fields pass.
    expect(() =>
      parseTemplateInput(
        template!,
        buildInput({
          generation_prompt: 'A photo',
          generation_width: 1024,
          generation_height: 768,
          safety_tolerance: 4,
        }),
        { byokMode: true },
      ),
    ).not.toThrow();

    // BabySea mode does not apply the semantic-lady BYOK validation.
    expect(() =>
      parseTemplateInput(
        template!,
        {
          image_model: 'qwen/image',
          image_model_input: {
            generation_prompt: 'A photo',
            generation_stepz: 28,
          },
          video_model: VIDEO_MODEL,
          video_model_input: { generation_duration: 5 },
        },
        { byokMode: false },
      ),
    ).not.toThrowError(/Unknown generation field/);
  });

  it('accepts all eight documented workflow shapes', () => {
    const template = getChainTemplate('chain');
    const workflowCases = [
      {
        name: 'text-to-image -> image-to-video',
        input: workflowInput({
          initialImage: false,
          modify: false,
          refine: false,
        }),
        steps: ['image', 'video'],
      },
      {
        name: 'text-to-image -> image-to-video -> video-to-video',
        input: workflowInput({
          initialImage: false,
          modify: true,
          refine: false,
        }),
        steps: ['image', 'video', 'modify'],
      },
      {
        name: 'text-to-image -> image-to-image -> image-to-video',
        input: workflowInput({
          initialImage: false,
          modify: false,
          refine: true,
        }),
        steps: ['image', 'refine', 'video'],
      },
      {
        name: 'text-to-image -> image-to-image -> image-to-video -> video-to-video',
        input: workflowInput({
          initialImage: false,
          modify: true,
          refine: true,
        }),
        steps: ['image', 'refine', 'video', 'modify'],
      },
      {
        name: 'image-to-image -> image-to-video',
        input: workflowInput({
          initialImage: true,
          modify: false,
          refine: false,
        }),
        steps: ['image', 'video'],
      },
      {
        name: 'image-to-image -> image-to-video -> video-to-video',
        input: workflowInput({
          initialImage: true,
          modify: true,
          refine: false,
        }),
        steps: ['image', 'video', 'modify'],
      },
      {
        name: 'image-to-image -> image-to-image -> image-to-video',
        input: workflowInput({
          initialImage: true,
          modify: false,
          refine: true,
        }),
        steps: ['image', 'refine', 'video'],
      },
      {
        name: 'image-to-image -> image-to-image -> image-to-video -> video-to-video',
        input: workflowInput({
          initialImage: true,
          modify: true,
          refine: true,
        }),
        steps: ['image', 'refine', 'video', 'modify'],
      },
    ] as const;

    for (const workflowCase of workflowCases) {
      const input = parseTemplateInput(template!, workflowCase.input, {
        byokMode: true,
      });

      expect(
        selectChainTemplateSteps(template!, input).map((step) => step.key),
        workflowCase.name,
      ).toEqual(workflowCase.steps);
    }
  });

  it('normalizes image → video input', () => {
    const template = getChainTemplate('chain');

    expect(template).not.toBeNull();

    const input = parseTemplateInput(
      template!,
      withModelSelection({
        video_model_input: {
          generation_duration: 4,
        },
      }),
    );

    expect(input.image_model).toBe(TEXT_IMAGE_MODEL);
    expect(input.video_model).toBe(VIDEO_MODEL);
    expect(input.provider_order).toBeUndefined();
    expect(input.video_duration).toBeUndefined();
    expect(input.image_output_format).toBeUndefined();
    expect(input.image_model_input).toEqual({});
    expect(input.video_model_input).toEqual({
      generation_duration: 4,
    });
  });

  it('accepts selected models nested under input.chain_models', () => {
    const template = getChainTemplate('chain');

    expect(template).not.toBeNull();

    const input = parseTemplateInput(template!, {
      chain_models: {
        image_model: 'bfl/flux-1.1-pro',
        video_model: 'bytedance/seedance-1-pro-fast',
      },
      video_model_input: {
        generation_duration: 2,
      },
    });

    expect(input.image_model).toBe('bfl/flux-1.1-pro');
    expect(input.video_model).toBe('bytedance/seedance-1-pro-fast');
    expect(input).not.toHaveProperty('chain_models');
  });

  it('normalizes a two-image-model chain under the single chain contract', () => {
    const template = getChainTemplate('chain');

    expect(template).not.toBeNull();

    const input = parseTemplateInput(template!, {
      image_model: TEXT_IMAGE_MODEL,
      refine_model: REFINE_IMAGE_MODEL,
      refine_model_input: {
        generation_prompt: 'Sharpen the product materials',
      },
      video_model: VIDEO_MODEL,
      video_model_input: {
        generation_duration: 4,
      },
    });
    const selectedSteps = selectChainTemplateSteps(template!, input);

    expect(input.image_model).toBe(TEXT_IMAGE_MODEL);
    expect(input.refine_model).toBe(REFINE_IMAGE_MODEL);
    expect(input.video_model).toBe(VIDEO_MODEL);
    expect(input.refine_model_input).toEqual({
      generation_prompt: 'Sharpen the product materials',
    });
    expect(selectedSteps.map((step) => step.key)).toEqual([
      'image',
      'refine',
      'video',
    ]);
    expect(selectedSteps[2]!.dependsOn).toEqual(['refine']);
  });

  it('requires refine_model to accept image input', () => {
    const template = getChainTemplate('chain');

    expect(() =>
      parseTemplateInput(template!, {
        image_model: REFINE_IMAGE_MODEL,
        refine_model: VIDEO_MODEL,
        video_model: VIDEO_MODEL,
        video_model_input: {
          generation_duration: 4,
        },
      }),
    ).toThrow('selected refine_model does not accept image input');
  });

  it('requires the built-in chain video_model to accept image input', () => {
    const template = getChainTemplate('chain');

    expect(() =>
      parseTemplateInput(
        template!,
        {
          image_model: TEXT_IMAGE_MODEL,
          video_model: 'runway/act-two',
          video_model_input: {
            reference: {
              type: 'video',
              uri: 'https://cdn.example.com/performance.mp4',
            },
          },
        },
        { byokMode: true },
      ),
    ).toThrow('does not support the image-to-video workflow');
  });

  it('requires the modify_model to accept video input', () => {
    const template = getChainTemplate('chain');

    expect(() =>
      parseTemplateInput(
        template!,
        {
          image_model: TEXT_IMAGE_MODEL,
          video_model: 'runway/gen-4-turbo',
          modify_model: 'runway/gen-4.5',
          video_model_input: {
            duration: 5,
            promptText: 'Animate the generated image',
          },
          modify_model_input: {
            promptText: 'Modify the video after generation',
          },
        },
        { byokMode: true },
      ),
    ).toThrow('does not support the video-to-video workflow');

    expect(() =>
      parseTemplateInput(
        template!,
        {
          image_model: TEXT_IMAGE_MODEL,
          video_model: 'runway/gen-4-turbo',
          modify_model: 'runway/aleph-2',
          video_model_input: {
            duration: 5,
            promptText: 'Animate the generated image',
          },
          modify_model_input: {
            promptText: 'Modify the video after generation',
          },
        },
        { byokMode: true },
      ),
    ).not.toThrow();

    expect(() =>
      parseTemplateInput(
        template!,
        {
          image_model: TEXT_IMAGE_MODEL,
          video_model: 'wan/2.7-i2v-2026-04-25',
          modify_model: 'wan/2.7-videoedit',
          video_model_input: {
            duration: 4,
            prompt: 'Animate the generated image',
          },
          modify_model_input: {
            prompt: 'Modify the video after generation',
          },
        },
        { byokMode: true },
      ),
    ).not.toThrow();

    expect(() =>
      parseTemplateInput(
        template!,
        {
          image_model: TEXT_IMAGE_MODEL,
          video_model: 'google/veo-3.1-lite',
          modify_model: 'wan/2.7-videoedit',
          video_model_input: {
            parameters: { durationSeconds: '4', resolution: '720p' },
            prompt: 'Animate the generated image',
          },
          modify_model_input: {
            input: { prompt: 'Modify the video after generation' },
          },
        },
        { byokMode: true },
      ),
    ).toThrow('cannot accept the selected video_model output');
  });

  it('rejects video-to-video models as image-to-video steps', () => {
    const template = getChainTemplate('chain');

    expect(() =>
      parseTemplateInput(
        template!,
        {
          image_model: TEXT_IMAGE_MODEL,
          video_model: 'wan/2.7-videoedit',
          video_model_input: {
            duration: 4,
            prompt: 'Animate the generated image',
          },
        },
        { byokMode: true },
      ),
    ).toThrow('does not support the image-to-video workflow');
  });

  it('rejects video models that cannot consume the previous image output', () => {
    const template = getChainTemplate('chain');

    for (const videoModel of [
      'happyhorse/1.0-t2v',
      'wan/2.7-t2v',
      'wan/2.2-animate-mix',
      'wan/2.2-animate-move',
      'runway/act-two',
    ]) {
      expect(() =>
        parseTemplateInput(
          template!,
          {
            image_model: TEXT_IMAGE_MODEL,
            video_model: videoModel,
            video_model_input: {
              duration: 4,
              prompt: 'Animate the generated image.',
            },
          },
          { byokMode: true },
        ),
      ).toThrow('does not support the image-to-video workflow');
    }
  });

  it('rejects models placed in the wrong step role', () => {
    const template = getChainTemplate('chain');

    // Video model in the image slot.
    expect(() =>
      parseTemplateInput(
        template!,
        {
          image_model: VIDEO_MODEL,
          video_model: VIDEO_MODEL,
          video_model_input: {
            generation_duration: 4,
            generation_prompt: 'Animate it.',
          },
        },
        { byokMode: true },
      ),
    ).toThrow('image_model is not an image generation model');

    // Image model in the video slot.
    expect(() =>
      parseTemplateInput(
        template!,
        {
          image_model: TEXT_IMAGE_MODEL,
          video_model: 'gpt/image-2',
          video_model_input: {
            generation_duration: 4,
            generation_prompt: 'Animate it.',
          },
        },
        { byokMode: true },
      ),
    ).toThrow('does not support the image-to-video workflow');

    // Image model in the modify slot.
    expect(() =>
      parseTemplateInput(
        template!,
        {
          image_model: TEXT_IMAGE_MODEL,
          video_model: VIDEO_MODEL,
          video_model_input: {
            generation_duration: 4,
            generation_prompt: 'Animate it.',
          },
          modify_model: 'gpt/image-2',
          modify_model_input: {
            generation_prompt: 'Polish it.',
          },
        },
        { byokMode: true },
      ),
    ).toThrow('does not support the video-to-video workflow');

    // Image-to-video model in the modify slot.
    expect(() =>
      parseTemplateInput(
        template!,
        {
          image_model: TEXT_IMAGE_MODEL,
          video_model: VIDEO_MODEL,
          video_model_input: {
            generation_duration: 4,
            generation_prompt: 'Animate it.',
          },
          modify_model: 'runway/gen-4-turbo',
          modify_model_input: {
            generation_prompt: 'Polish it.',
          },
        },
        { byokMode: true },
      ),
    ).toThrow('does not support the video-to-video workflow');
  });

  it('rejects edit-only image models in the first step without a starting image', () => {
    const template = getChainTemplate('chain');

    // runway/gen-4-image-turbo is image-to-image only (no text-to-image).
    expect(() =>
      parseTemplateInput(
        template!,
        {
          image_model: 'runway/gen-4-image-turbo',
          image_model_input: {
            generation_prompt: 'A robot barista.',
          },
          video_model: VIDEO_MODEL,
          video_model_input: {
            generation_duration: 4,
            generation_prompt: 'Animate it.',
          },
        },
        { byokMode: true },
      ),
    ).toThrow('only supports the image-to-image workflow');

    // With a starting image, the same model is allowed.
    expect(() =>
      parseTemplateInput(
        template!,
        {
          image_model: 'runway/gen-4-image-turbo',
          image_model_input: {
            generation_prompt: 'A robot barista.',
            generation_input_file: ['https://example.com/start.png'],
          },
          video_model: VIDEO_MODEL,
          video_model_input: {
            generation_duration: 4,
            generation_prompt: 'Animate it.',
          },
        },
        { byokMode: true },
      ),
    ).not.toThrow();
  });

  it('accepts Seedance 2.0 as a video-to-video modify model', () => {
    const template = getChainTemplate('chain');

    expect(() =>
      parseTemplateInput(
        template!,
        {
          image_model: TEXT_IMAGE_MODEL,
          video_model: VIDEO_MODEL,
          video_model_input: {
            generation_duration: 4,
            generation_prompt: 'Animate the generated image.',
          },
          modify_model: 'bytedance/seedance-2.0',
          modify_model_input: {
            generation_prompt: 'Re-style the video with cinematic lighting.',
          },
        },
        { byokMode: true },
      ),
    ).not.toThrow();
  });

  it('rejects data-video handoffs into URL-only modify providers', () => {
    const template = getChainTemplate('chain');

    for (const modifyModel of ['wan/2.7-videoedit', 'bytedance/seedance-2.0']) {
      expect(() =>
        parseTemplateInput(
          template!,
          {
            image_model: TEXT_IMAGE_MODEL,
            video_model: 'google/veo-3.1-lite',
            video_model_input: {
              generation_duration: 8,
              generation_prompt: 'Animate the generated image.',
            },
            modify_model: modifyModel,
            modify_model_input: {
              generation_prompt: 'Re-style the video.',
            },
          },
          { byokMode: true },
        ),
      ).toThrow('cannot accept the selected video_model output');
    }
  });

  it('requires a video duration for image-to-video routing', () => {
    const template = getChainTemplate('chain');

    expect(() => parseTemplateInput(template!, withModelSelection())).toThrow(
      'Provide video_model_input.generation_duration',
    );
    expect(() =>
      parseTemplateInput(
        template!,
        withModelSelection({
          video_model_input: {
            generation_duration: '4',
          },
        }),
      ),
    ).toThrow('generation_duration must be a positive number');
    expect(() =>
      parseTemplateInput(
        template!,
        {
          image_model: TEXT_IMAGE_MODEL,
          video_model: 'runway/gen-4-turbo',
          video_model_input: {
            promptImage: 'https://cdn.example.com/source.png',
            promptText: 'Animate the generated image',
          },
        },
        { byokMode: true },
      ),
    ).toThrow('Remove video_model_input.promptImage');
    expect(() =>
      parseTemplateInput(
        template!,
        withModelSelection({
          video_duration: 4,
        }),
      ),
    ).toThrow('top-level video_duration');
    expect(() =>
      parseTemplateInput(
        template!,
        withModelSelection({
          video_model_input: {
            generation_duration: 0,
          },
        }),
      ),
    ).toThrow('generation_duration must be a positive number');
    expect(() =>
      parseTemplateInput(
        template!,
        withModelSelection({
          video_model_input: {
            generation_duration: 4,
          },
        }),
      ),
    ).not.toThrow();
  });

  it('allows raw BYOK video params without BabySea duration fields', () => {
    const template = getChainTemplate('chain');

    expect(() =>
      parseTemplateInput(
        template!,
        {
          image_model: TEXT_IMAGE_MODEL,
          video_model_input: {
            content: [
              {
                text: 'Animate the generated image.',
                type: 'text',
              },
            ],
            duration: 4,
          },
          image_model_input: {
            prompt: 'A product render',
            size: '2K',
          },
          video_model: VIDEO_MODEL,
        },
        { byokMode: true },
      ),
    ).not.toThrow();
  });

  it('lets BabySea apply selected image model defaults', () => {
    const template = getChainTemplate('chain');
    const input = parseTemplateInput(
      template!,
      withModelSelection({
        video_model_input: {
          generation_duration: 4,
        },
      }),
    );
    const textToImageStep = template!.steps[0]!;

    const params = textToImageStep.buildParams({
      input,
      steps: {},
    });

    expect(params).not.toHaveProperty('generation_output_format');
    expect(params).not.toHaveProperty('generation_provider_order');
    expect(params).not.toHaveProperty('generation_input_file');
    expect(params).not.toHaveProperty('generation_size');
  });

  it('normalizes jpeg to jpg for BabySea-shaped image params', () => {
    const template = getChainTemplate('chain');
    const input = parseTemplateInput(
      template!,
      withModelSelection({
        image_model_input: {
          generation_output_format: 'jpeg',
          generation_prompt: 'A product render',
        },
        video_model_input: {
          generation_duration: 4,
        },
      }),
    );
    const textToImageStep = template!.steps[0]!;

    const params = textToImageStep.buildParams({ input, steps: {} });

    expect(input.image_output_format).toBeUndefined();
    expect(params.generation_output_format).toBe('jpg');
  });

  it('passes model-specific generation params through per step', () => {
    const template = getChainTemplate('chain');
    const input = parseTemplateInput(template!, {
      video_model: 'bytedance/seedance-1.5-pro',
      video_model_input: {
        generation_camera_fixed: true,
        generation_duration: 8,
        generation_generate_audio: true,
        generation_prompt: 'Schema video prompt',
        generation_resolution: '720p',
      },
      image_model: 'google/nano-banana-pro',
      image_model_input: {
        generation_output_format: 'jpg',
        generation_prompt: 'Schema image prompt',
        generation_quality: 'high',
        ignored_provider_field: true,
      },
    });
    const textToImageStep = template!.steps[0]!;
    const imageToVideoStep = template!.steps.find(
      (step) => step.key === 'video',
    )!;

    const imageParams = textToImageStep.buildParams({ input, steps: {} });
    const videoParams = imageToVideoStep.buildParams({
      input,
      steps: {
        image: stepOutput({
          modelIdentifier: 'google/nano-banana-pro',
          outputFiles: ['https://cdn.example.com/image.jpg'],
        }),
      },
    });

    expect(imageParams.generation_output_format).toBe('jpg');
    expect(imageParams.generation_prompt).toBe('Schema image prompt');
    expect(imageParams.generation_quality).toBe('high');
    expect(imageParams).not.toHaveProperty('ignored_provider_field');
    expect(videoParams.generation_duration).toBe(8);
    expect(videoParams.generation_prompt).toBe('Schema video prompt');
    expect(videoParams.generation_resolution).toBe('720p');
    expect(videoParams.generation_generate_audio).toBe(true);
    expect(videoParams.generation_camera_fixed).toBe(true);
    expect(videoParams.generation_input_file).toEqual([
      'https://cdn.example.com/image.jpg',
    ]);
  });

  it('allows raw BYOK image inputs for the initial image-to-image step', () => {
    const template = getChainTemplate('chain');

    expect(() =>
      parseTemplateInput(
        template!,
        {
          image_model: REFINE_IMAGE_MODEL,
          image_model_input: {
            image: 'https://cdn.example.com/source.png',
            prompt: 'Refine the source image',
          },
          video_model_input: {
            duration: 4,
          },
          video_model: VIDEO_MODEL,
        },
        { byokMode: true },
      ),
    ).not.toThrow();
  });

  it('rejects downstream image inputs that BabyChain wires from previous steps', () => {
    const template = getChainTemplate('chain');

    expect(() =>
      parseTemplateInput(
        template!,
        {
          image_model: TEXT_IMAGE_MODEL,
          refine_model: REFINE_IMAGE_MODEL,
          refine_model_input: {
            image: 'https://cdn.example.com/source.png',
            prompt: 'Refine the generated image',
          },
          video_model: VIDEO_MODEL,
          video_model_input: {
            duration: 4,
          },
        },
        { byokMode: true },
      ),
    ).toThrow('Remove refine_model_input.image');

    expect(() =>
      parseTemplateInput(
        template!,
        {
          image_model: TEXT_IMAGE_MODEL,
          video_model: 'happyhorse/1.0-i2v',
          video_model_input: {
            input: {
              media: [
                {
                  type: 'first_frame',
                  url: 'https://cdn.example.com/source.png',
                },
              ],
              prompt: 'Animate the generated image',
            },
          },
        },
        { byokMode: true },
      ),
    ).toThrow('Remove video_model_input.input.media');

    expect(() =>
      parseTemplateInput(
        template!,
        {
          image_model: TEXT_IMAGE_MODEL,
          video_model: VIDEO_MODEL,
          video_model_input: {
            generation_input_file: ['https://cdn.example.com/source.png'],
          },
        },
        { byokMode: true },
      ),
    ).toThrow('Remove video_model_input.generation_input_file');

    expect(() =>
      parseTemplateInput(
        template!,
        {
          image_model: TEXT_IMAGE_MODEL,
          video_model: VIDEO_MODEL,
          video_model_input: { generation_duration: 4 },
          modify_model: 'happyhorse/1.0-video-edit',
          modify_model_input: {
            generation_input_video_file: 'https://cdn.example.com/source.mp4',
          },
        },
        { byokMode: true },
      ),
    ).toThrow('Remove modify_model_input.generation_input_video_file');

    expect(() =>
      parseTemplateInput(
        template!,
        {
          image_model: TEXT_IMAGE_MODEL,
          refine_model: 'google/nano-banana-2',
          refine_model_input: {
            contents: [
              {
                role: 'user',
                parts: [{ text: 'Bypass the generated image.' }],
              },
            ],
          },
          video_model: VIDEO_MODEL,
          video_model_input: {
            duration: 4,
          },
        },
        { byokMode: true },
      ),
    ).toThrow('Remove refine_model_input.contents');

    expect(() =>
      parseTemplateInput(
        template!,
        {
          image_model: TEXT_IMAGE_MODEL,
          video_model: 'google/veo-3.1-lite',
          video_model_input: {
            instances: [
              {
                prompt: 'Bypass the generated image.',
              },
            ],
          },
        },
        { byokMode: true },
      ),
    ).toThrow('Remove video_model_input.instances');

    expect(() =>
      parseTemplateInput(
        template!,
        {
          image_model: TEXT_IMAGE_MODEL,
          video_model: 'runway/gen-4-turbo',
          modify_model: 'runway/aleph-2',
          video_model_input: {
            duration: 5,
            promptText: 'Animate the generated image',
          },
          modify_model_input: {
            promptText: 'Modify the video after generation',
            videoUri: 'https://cdn.example.com/source.mp4',
          },
        },
        { byokMode: true },
      ),
    ).toThrow('Remove modify_model_input.videoUri');
  });

  it('rejects provider-specific secret-like model inputs', () => {
    const template = getChainTemplate('chain');

    expect(() =>
      parseTemplateInput(
        template!,
        {
          image_model: TEXT_IMAGE_MODEL,
          image_model_input: {
            generation_prompt: 'A product render',
            dashscope_api_key: 'dashscope_test_key',
          },
          video_model_input: {
            generation_duration: 4,
            nested: {
              access_key_secret: 'provider_secret',
            },
          },
          video_model: VIDEO_MODEL,
        },
        { byokMode: true },
      ),
    ).toThrow('Credential-like keys are not allowed');
  });

  it('rejects provider-controlled model inputs', () => {
    const template = getChainTemplate('chain');

    expect(() =>
      parseTemplateInput(
        template!,
        {
          image_model: TEXT_IMAGE_MODEL,
          image_model_input: {
            generation_model: 'untrusted-generation-model',
            model: 'untrusted-model',
            prompt: 'A product render',
          },
          video_model: VIDEO_MODEL,
          video_model_input: {
            callback_url: 'https://callbacks.example.com/provider',
            duration: 4,
            generation_callback_url: 'https://callbacks.example.com/generated',
          },
        },
        { byokMode: true },
      ),
    ).toThrow('Provider-controlled keys are not allowed');
  });

  it('rejects top-level generation fields and uses nested prompts', () => {
    const template = getChainTemplate('chain');

    expect(() =>
      parseTemplateInput(
        template!,
        withModelSelection({
          prompt: 'Fallback chain prompt',
        }),
      ),
    ).toThrow('top-level prompt');
    expect(() =>
      parseTemplateInput(
        template!,
        withModelSelection({
          generation_prompt: 'Fallback generation prompt',
        }),
      ),
    ).toThrow('top-level prompt');
    expect(() =>
      parseTemplateInput(
        template!,
        withModelSelection({
          image_prompt: 'Root image prompt',
          video_model_input: {
            generation_duration: 4,
          },
        }),
      ),
    ).toThrow('top-level image_prompt');
    expect(() =>
      parseTemplateInput(
        template!,
        withModelSelection({
          video_model_input: {
            generation_duration: 4,
          },
          video_prompt: 'Root video prompt',
        }),
      ),
    ).toThrow('top-level video_prompt');
    expect(() =>
      parseTemplateInput(
        template!,
        withModelSelection({
          provider_order: 'byteplus, replicate, fal',
          video_model_input: {
            generation_duration: 4,
          },
        }),
      ),
    ).toThrow('top-level provider_order');
    expect(() =>
      parseTemplateInput(
        template!,
        withModelSelection({
          video_model_input: {
            generation_duration: 4,
          },
          workflow: 'text-to-image',
        }),
      ),
    ).toThrow('Unsupported top-level input field workflow');

    const input = parseTemplateInput(
      template!,
      withModelSelection({
        video_model_input: {
          generation_duration: 4,
          generation_prompt: 'Schema video prompt',
        },
        image_model_input: {
          generation_prompt: 'Schema image prompt',
        },
      }),
    );

    const imageParams = template!.steps[0]!.buildParams({ input, steps: {} });
    const videoParams = template!.steps
      .find((step) => step.key === 'video')!
      .buildParams({
        input,
        steps: {
          image: stepOutput({
            outputFiles: ['https://cdn.example.com/image.jpg'],
          }),
        },
      });

    expect(imageParams.generation_prompt).toBe('Schema image prompt');
    expect(videoParams.generation_prompt).toBe('Schema video prompt');
  });

  it('uses model inputs consistently for video estimates and execution', () => {
    const template = getChainTemplate('chain');
    const input = parseTemplateInput(
      template!,
      withModelSelection({
        video_model_input: {
          generation_duration: 8,
          generation_resolution: '720p',
        },
      }),
    );
    const imageToVideoStep = template!.steps.find(
      (step) => step.key === 'video',
    )!;

    const estimate = imageToVideoStep.estimate(input);
    const params = imageToVideoStep.buildParams({
      input,
      steps: {
        image: stepOutput({
          outputFiles: ['https://cdn.example.com/image.jpg'],
        }),
      },
    });

    expect(estimate.duration).toBe(8);
    expect(estimate.resolution).toBe('720p');
    expect(params.generation_duration).toBe(8);
    expect(params.generation_resolution).toBe('720p');
  });

  it('requires safe uploaded image URLs inside model inputs', () => {
    const template = getChainTemplate('chain');

    expect(() => parseTemplateInput(template!, {})).toThrow();
    expect(() =>
      parseTemplateInput(template!, {
        image_model: REFINE_IMAGE_MODEL,
        image_model_input: {
          generation_input_file: ['http://localhost/image.png'],
        },
        video_model: VIDEO_MODEL,
      }),
    ).toThrow();
    expect(() =>
      parseTemplateInput(template!, {
        image_model: REFINE_IMAGE_MODEL,
        image_model_input: {
          generation_input_file: ['https://100.64.0.1/image.png'],
        },
        video_model_input: {
          generation_duration: 4,
        },
        video_model: VIDEO_MODEL,
      }),
    ).toThrow('generation_input_file must be an array of HTTPS public URLs.');
    expect(() =>
      parseTemplateInput(template!, {
        image_model: REFINE_IMAGE_MODEL,
        image_model_input: {
          generation_input_file: ['https://[2001:2::1]/image.png'],
        },
        video_model_input: {
          generation_duration: 4,
        },
        video_model: VIDEO_MODEL,
      }),
    ).toThrow('generation_input_file must be an array of HTTPS public URLs.');
    expect(() =>
      parseTemplateInput(template!, {
        image_model: REFINE_IMAGE_MODEL,
        image_model_input: {
          generation_input_file: ['http://localhost/image.png'],
          generation_input_image_file: ['http://localhost/image.png'],
        },
        video_model: VIDEO_MODEL,
      }),
    ).toThrow(
      'generation_input_image_file must be an array of HTTPS public URLs.',
    );
  });

  it('rejects unsafe input file URLs inside model inputs', () => {
    const template = getChainTemplate('chain');

    expect(() =>
      parseTemplateInput(
        template!,
        withModelSelection({
          image_model_input: {
            generation_input_file: ['http://localhost/image.png'],
          },
        }),
      ),
    ).toThrow();
    expect(() =>
      parseTemplateInput(
        template!,
        withModelSelection({
          image_model_input: {
            generation_input_file: ['https://[::ffff:808:808:dead]/image.png'],
          },
          video_model_input: {
            generation_duration: 4,
          },
        }),
      ),
    ).toThrow('generation_input_file must be an array of HTTPS public URLs.');
  });

  it('rejects unsafe last-content input file URLs inside model inputs', () => {
    const template = getChainTemplate('chain');

    expect(() =>
      parseTemplateInput(
        template!,
        withModelSelection({
          video_model_input: {
            generation_input_file_last_content: 'http://localhost/last.png',
          },
        }),
      ),
    ).toThrow();
    expect(() =>
      parseTemplateInput(
        template!,
        withModelSelection({
          video_model_input: {
            generation_input_file_last_content: 'http://localhost/last.png',
            generation_input_image_file_last_content:
              'http://localhost/last.png',
          },
        }),
      ),
    ).toThrow();
  });

  it('passes provider order through to BabySea without topology caps', () => {
    const template = getChainTemplate('chain');
    const input = parseTemplateInput(
      template!,
      withModelSelection({
        image_model_input: {
          generation_provider_order: 'byteplus, replicate, fal',
        },
        video_model_input: {
          generation_duration: 4,
          generation_provider_order: 'openai, replicate, fal',
        },
      }),
    );
    const textToImageStep = template!.steps[0]!;
    const imageToVideoStep = template!.steps.find(
      (step) => step.key === 'video',
    )!;

    const imageParams = textToImageStep.buildParams({ input, steps: {} });
    const videoParams = imageToVideoStep.buildParams({
      input,
      steps: {
        image: stepOutput({
          outputFiles: ['https://cdn.example.com/image.jpg'],
          providerOrder: ['byteplus', 'replicate', 'fal'],
          providerUsed: 'byteplus',
        }),
      },
    });

    expect(imageParams.generation_provider_order).toBe(
      'byteplus, replicate, fal',
    );
    expect(videoParams.generation_provider_order).toBe(
      'openai, replicate, fal',
    );
  });

  it('handles uploaded-image input as the first image model input', () => {
    const template = getChainTemplate('chain');
    const input = parseTemplateInput(template!, {
      image_model: REFINE_IMAGE_MODEL,
      image_model_input: {
        generation_input_file: ['https://cdn.example.com/source.png'],
        generation_prompt:
          'A restored product image becomes a rotating launch video',
      },
      video_model_input: {
        generation_duration: 4,
      },
      video_model: VIDEO_MODEL,
    });
    const imageToImageStep = template!.steps[0]!;
    const imageToVideoStep = template!.steps.find(
      (step) => step.key === 'video',
    )!;

    const imageParams = imageToImageStep.buildParams({ input, steps: {} });
    const videoParams = imageToVideoStep.buildParams({
      input,
      steps: {
        image: stepOutput({
          outputFiles: ['https://cdn.example.com/transformed.png'],
        }),
      },
    });

    expect(imageParams.generation_input_file).toEqual([
      'https://cdn.example.com/source.png',
    ]);
    expect(videoParams.generation_input_file).toEqual([
      'https://cdn.example.com/transformed.png',
    ]);
  });

  it('keeps text-to-image runs as one image model followed by video', () => {
    const template = getChainTemplate('chain');
    const input = parseTemplateInput(
      template!,
      withModelSelection({
        image_model_input: {
          generation_prompt: 'A miniature harbor scene',
          generation_ratio: '16:9',
        },
        video_model_input: {
          generation_duration: 4,
          generation_prompt: 'Gentle dolly shot over the harbor',
        },
      }),
    );
    const imageStep = template!.steps[0]!;
    const selectedSteps = selectChainTemplateSteps(template!, input);
    const videoStep = selectedSteps.find((step) => step.key === 'video')!;

    const imageParams = imageStep.buildParams({ input, steps: {} });
    const videoParams = videoStep.buildParams({
      input,
      steps: {
        image: stepOutput({
          outputFiles: ['https://cdn.example.com/base.jpg'],
        }),
      },
    });

    expect(selectedSteps.map((step) => step.key)).toEqual(['image', 'video']);
    expect(imageParams).not.toHaveProperty('generation_input_file');
    expect(imageParams.generation_ratio).toBe('16:9');
    expect(videoParams.generation_input_file).toEqual([
      'https://cdn.example.com/base.jpg',
    ]);
    expect(videoParams.generation_duration).toBe(4);
  });

  it('runs an optional second image model before video', () => {
    const template = getChainTemplate('chain');
    const input = parseTemplateInput(template!, {
      image_model: 'bfl/flux-1.1-pro',
      image_model_input: {
        generation_prompt: 'A product frame',
      },
      refine_model: 'bytedance/seedream-5-lite',
      refine_model_input: {
        generation_prompt: 'Add crisp material detail',
      },
      video_model: 'bytedance/seedance-1.5-pro',
      video_model_input: {
        generation_duration: 4,
      },
    });
    const selectedSteps = selectChainTemplateSteps(template!, input);
    const refineStep = selectedSteps.find((step) => step.key === 'refine')!;
    const videoStep = selectedSteps.find((step) => step.key === 'video')!;

    const refineParams = refineStep.buildParams({
      input,
      steps: {
        image: stepOutput({
          outputFiles: ['https://cdn.example.com/flux.png'],
        }),
      },
    });
    const videoParams = videoStep.buildParams({
      input,
      steps: {
        image: stepOutput({
          outputFiles: ['https://cdn.example.com/flux.png'],
        }),
        refine: stepOutput({
          outputFiles: ['https://cdn.example.com/seedream.png'],
        }),
      },
    });

    expect(selectedSteps.map((step) => step.key)).toEqual([
      'image',
      'refine',
      'video',
    ]);
    expect(refineStep.dependsOn).toEqual(['image']);
    expect(videoStep.dependsOn).toEqual(['refine']);
    expect(resolveStepModel(refineStep.model, input)).toBe(
      'bytedance/seedream-5-lite',
    );
    expect(refineParams.generation_input_file).toEqual([
      'https://cdn.example.com/flux.png',
    ]);
    expect(videoParams.generation_input_file).toEqual([
      'https://cdn.example.com/seedream.png',
    ]);
  });

  it('runs an optional video modify model after video', () => {
    const template = getChainTemplate('chain');
    const input = parseTemplateInput(
      template!,
      {
        image_model: TEXT_IMAGE_MODEL,
        image_model_input: {
          generation_prompt: 'A product frame',
        },
        video_model: 'runway/gen-4-turbo',
        video_model_input: {
          duration: 5,
          promptText: 'Animate the generated image',
        },
        modify_model: 'runway/gen-4-aleph',
        modify_model_input: {
          promptText: 'Add a dramatic camera move',
        },
      },
      { byokMode: true },
    );
    const selectedSteps = selectChainTemplateSteps(template!, input);
    const modifyStep = selectedSteps.find((step) => step.key === 'modify')!;

    const modifyParams = modifyStep.buildParams({
      input,
      steps: {
        image: stepOutput({
          outputFiles: ['https://cdn.example.com/flux.png'],
        }),
        video: stepOutput({
          outputFiles: ['https://cdn.example.com/video.mp4'],
        }),
      },
    });

    expect(selectedSteps.map((step) => step.key)).toEqual([
      'image',
      'video',
      'modify',
    ]);
    expect(modifyStep.dependsOn).toEqual(['video']);
    expect(resolveStepModel(modifyStep.model, input)).toBe(
      'runway/gen-4-aleph',
    );
    expect(modifyParams.generation_input_file).toEqual([
      'https://cdn.example.com/video.mp4',
    ]);
  });

  it('builds video params from the previous model output', () => {
    const template = getChainTemplate('chain');
    const input = parseTemplateInput(
      template!,
      withModelSelection({
        video_model_input: {
          generation_duration: 6,
          generation_prompt: 'A neon product turntable with liquid reflections',
        },
      }),
    );
    const imageToVideoStep = template!.steps.find(
      (step) => step.key === 'video',
    )!;

    const params = imageToVideoStep.buildParams({
      input,
      steps: {
        image: stepOutput({
          outputFiles: ['https://cdn.example.com/image.png'],
        }),
      },
    });

    expect(params.generation_input_file).toEqual([
      'https://cdn.example.com/image.png',
    ]);
    expect(params.generation_duration).toBe(6);
    expect(resolveStepModel(imageToVideoStep.model, input)).toBe(
      'bytedance/seedance-1.5-pro',
    );
  });

  it('allows provider-generated data URLs as previous model outputs', () => {
    const template = getChainTemplate('chain');
    const input = parseTemplateInput(
      template!,
      withModelSelection({
        video_model_input: {
          generation_duration: 4,
        },
      }),
    );
    const imageToVideoStep = template!.steps.find(
      (step) => step.key === 'video',
    )!;

    const params = imageToVideoStep.buildParams({
      input,
      steps: {
        image: stepOutput({
          outputFiles: ['data:image/png;base64,aW1hZ2U='],
        }),
      },
    });

    expect(params.generation_input_file).toEqual([
      'data:image/png;base64,aW1hZ2U=',
    ]);
  });

  it('does not reuse unsafe previous model outputs', () => {
    const template = getChainTemplate('chain');
    const input = parseTemplateInput(
      template!,
      withModelSelection({
        video_model_input: {
          generation_duration: 4,
        },
      }),
    );
    const imageToVideoStep = template!.steps.find(
      (step) => step.key === 'video',
    )!;

    expect(() =>
      imageToVideoStep.buildParams({
        input,
        steps: {
          image: stepOutput({
            outputFiles: ['https://[2001:10::1]/image.png'],
          }),
        },
      }),
    ).toThrow('Required previous step output is missing.');

    const params = imageToVideoStep.buildParams({
      input,
      steps: {
        image: stepOutput({
          outputFiles: [
            'https://127.0.0.1/image.png',
            'https://cdn.example.com/image.png',
          ],
        }),
      },
    });

    expect(params.generation_input_file).toEqual([
      'https://cdn.example.com/image.png',
    ]);
  });

  it('rejects contributor templates with future step dependencies', () => {
    expect(() =>
      assertChainTemplateInvariants(
        createTemplate({
          steps: [
            stepTemplate({ key: 'first', dependsOn: ['second'] }),
            stepTemplate({ key: 'second' }),
          ],
        }),
      ),
    ).toThrow('depends on unknown or later step');
  });

  it('rejects contributor templates with unknown model input tokens', () => {
    expect(() =>
      assertChainTemplateInvariants(
        createTemplate({
          steps: [stepTemplate({ model: '${missing_model}' })],
        }),
      ),
    ).toThrow('references unknown model input');
  });
});

function createTemplate(overrides: Partial<ChainTemplate> = {}): ChainTemplate {
  return {
    description: 'Test chain template',
    inputFields: [
      {
        description: 'Model input',
        name: 'model',
        required: false,
        type: 'string',
      },
    ],
    inputSchema: z.record(z.unknown()),
    slug: 'test-chain',
    steps: [stepTemplate()],
    title: 'Test chain',
    version: 'test-version',
    ...overrides,
  };
}

function stepTemplate(
  overrides: Partial<ChainTemplate['steps'][number]> = {},
): ChainTemplate['steps'][number] {
  return {
    buildParams: () => ({}) as GenerationParams,
    dependsOn: [],
    estimate: () => ({}),
    key: 'step',
    kind: 'image',
    model: '${model}',
    title: 'Step',
    ...overrides,
  };
}

function stepOutput(overrides: Partial<ChainStepOutput> = {}): ChainStepOutput {
  return {
    generationId: 'gen_123',
    modelIdentifier: 'bytedance/seedream-4.5',
    outputFiles: ['https://cdn.example.com/image.jpg'],
    predictionId: 'pred_123',
    providerOrder: ['fastest'],
    providerUsed: 'replicate',
    status: 'succeeded',
    ...overrides,
  };
}

function workflowInput({
  initialImage,
  modify,
  refine,
}: {
  initialImage: boolean;
  modify: boolean;
  refine: boolean;
}) {
  return {
    image_model: 'bfl/flux-2-pro',
    ...(refine ? { refine_model: 'google/nano-banana-2' } : {}),
    video_model: 'wan/2.7-i2v-2026-04-25',
    ...(modify ? { modify_model: 'wan/2.7-videoedit' } : {}),
    image_model_input: {
      generation_prompt: 'A compact product photo on a clean background.',
      ...(initialImage
        ? { generation_input_file: [VALIDATION_IMAGE_URL] }
        : {}),
    },
    ...(refine
      ? {
          refine_model_input: {
            generation_prompt:
              'Refine this image while preserving the subject.',
          },
        }
      : {}),
    video_model_input: {
      input: { prompt: 'Animate the image with a short slow camera move.' },
      parameters: { duration: 2, resolution: '720P', watermark: false },
    },
    ...(modify
      ? {
          modify_model_input: {
            input: { prompt: 'Polish the generated video motion subtly.' },
            parameters: { duration: 0, resolution: '720P', watermark: false },
          },
        }
      : {}),
  };
}

function withModelSelection(input: Record<string, unknown> = {}) {
  return {
    image_model: TEXT_IMAGE_MODEL,
    video_model: VIDEO_MODEL,
    ...input,
  };
}
