import { describe, expect, it } from 'vitest';

import { getChainTemplate, parseTemplateInput } from '@/lib/chains/templates';
import {
  createNextPromptSuggestionsWithFallback,
  mapStorySceneToChainInput,
  StorySceneRunDraftSchema,
} from '@/lib/showrunner';

describe('interactive showrunner', () => {
  it('maps one story scene into a BabyChain-compatible chain input', () => {
    const draft = StorySceneRunDraftSchema.parse({
      prompt:
        'A courier opens a package from tomorrow inside a neon night market.',
      settings: {
        imageModel: 'qwen/image',
        videoModel: 'happyhorse/1.0-i2v',
        modifyModel: 'happyhorse/1.0-video-edit',
        durationSeconds: 5,
        visualFormat: '16:9 cinematic frame',
      },
    });
    const input = mapStorySceneToChainInput(draft);
    const template = getChainTemplate('chain');

    expect(input).toMatchObject({
      chain_models: {
        image_model: 'qwen/image',
        video_model: 'happyhorse/1.0-i2v',
        modify_model: 'happyhorse/1.0-video-edit',
      },
      image_model_input: {
        generation_prompt: expect.stringContaining('neon night market'),
      },
      video_model_input: {
        generation_duration: 5,
        generation_prompt: expect.stringContaining('16:9 cinematic frame'),
      },
    });
    expect(() =>
      parseTemplateInput(template!, input, { byokMode: true }),
    ).not.toThrow();
  });

  it('returns four local next-scene options when Qwen is unavailable', async () => {
    const result = await createNextPromptSuggestionsWithFallback({
      storyTitle: 'Tomorrow Delivery',
      visualStyle: 'neon-lit cinematic realism',
      language: 'English',
      scenes: [
        {
          sceneNumber: 1,
          prompt:
            'A courier opens a package from tomorrow inside a neon night market.',
          outputFiles: ['https://cdn.example.com/scene-1.mp4'],
          runId: 'run_1',
          status: 'succeeded',
        },
      ],
      lastScene: {
        sceneNumber: 1,
        prompt:
          'A courier opens a package from tomorrow inside a neon night market.',
        outputFiles: ['https://cdn.example.com/scene-1.mp4'],
        runId: 'run_1',
        status: 'succeeded',
      },
    });

    expect(result.provider).toBe('local-draft');
    expect(result.suggestions).toHaveLength(4);
    expect(result.suggestions.map((option) => option.id)).toEqual([
      'continue-tension',
      'reveal-clue',
      'emotional-beat',
      'twist-escalation',
    ]);
    expect(result.suggestions[0]?.imagePrompt).toContain('scene 1');
  });

  it('falls back to local suggestions if Qwen suggestion generation fails', async () => {
    const result = await createNextPromptSuggestionsWithFallback(
      {
        visualStyle: 'documentary realism',
        scenes: [
          {
            sceneNumber: 1,
            prompt: 'A child finds a silent robot under a flooded station.',
            outputFiles: ['https://cdn.example.com/scene-1.mp4'],
            status: 'succeeded',
          },
        ],
        lastScene: {
          sceneNumber: 1,
          prompt: 'A child finds a silent robot under a flooded station.',
          outputFiles: ['https://cdn.example.com/scene-1.mp4'],
          status: 'succeeded',
        },
      },
      {
        provider: async () => {
          throw new Error('qwen unavailable');
        },
        useQwen: true,
      },
    );

    expect(result.provider).toBe('local-draft');
    expect(result.warning).toContain('local next-scene options');
    expect(result.suggestions).toHaveLength(4);
  });

  it('requires a successful output before suggesting next prompts', async () => {
    await expect(
      createNextPromptSuggestionsWithFallback({
        visualStyle: 'documentary realism',
        scenes: [
          {
            sceneNumber: 1,
            prompt: 'A child finds a silent robot under a flooded station.',
            status: 'running',
          },
        ],
        lastScene: {
          sceneNumber: 1,
          prompt: 'A child finds a silent robot under a flooded station.',
          status: 'running',
        },
      }),
    ).rejects.toThrow('must succeed');
  });
});
