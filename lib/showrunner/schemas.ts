import { z } from 'zod';

export const STORY_MAX_SCENES = 8;
export const STORY_NEXT_SUGGESTION_COUNT = 4;

export const StorySceneSettingsSchema = z.object({
  imageModel: z.string().trim().min(1).default('qwen/image'),
  videoModel: z.string().trim().min(1).default('happyhorse/1.0-i2v'),
  modifyModel: z.string().trim().max(120).default(''),
  durationSeconds: z.coerce.number().int().min(3).max(10).default(5),
  visualFormat: z
    .string()
    .trim()
    .min(1)
    .max(160)
    .default('16:9 cinematic frame'),
});

export const StorySceneRunDraftSchema = z.object({
  prompt: z.string().trim().min(8).max(1_500),
  imagePrompt: z.string().trim().max(1_500).optional().default(''),
  videoPrompt: z.string().trim().max(1_500).optional().default(''),
  editInstruction: z.string().trim().max(800).optional().default(''),
  settings: StorySceneSettingsSchema,
});

export const StorySceneContextSchema = z.object({
  sceneNumber: z.coerce.number().int().min(1).max(STORY_MAX_SCENES),
  prompt: z.string().trim().min(1).max(1_500),
  outputFiles: z.array(z.string().trim().min(1)).max(20).default([]),
  runId: z.string().trim().max(120).optional().default(''),
  status: z.string().trim().max(80).optional().default(''),
  note: z.string().trim().max(1_000).optional().default(''),
});

export const NextPromptSuggestionSchema = z.object({
  id: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(120),
  narrativeIntent: z.string().trim().min(1).max(500),
  imagePrompt: z.string().trim().min(8).max(1_500),
  videoPrompt: z.string().trim().min(8).max(1_500),
  editInstruction: z.string().trim().max(800).default(''),
  continuityNotes: z.string().trim().min(1).max(700),
});

export const NextPromptSuggestionSetSchema = z.object({
  storySummary: z.string().trim().min(1).max(1_000),
  suggestions: z
    .array(NextPromptSuggestionSchema)
    .length(STORY_NEXT_SUGGESTION_COUNT),
});

export const SuggestNextPromptsInputSchema = z
  .object({
    storyTitle: z.string().trim().max(120).optional().default(''),
    visualStyle: z.string().trim().min(1).max(240),
    language: z.string().trim().min(1).max(80).default('English'),
    scenes: z.array(StorySceneContextSchema).min(1).max(STORY_MAX_SCENES),
    lastScene: StorySceneContextSchema,
  })
  .superRefine((input, context) => {
    if (input.lastScene.sceneNumber >= STORY_MAX_SCENES) {
      context.addIssue({
        code: 'custom',
        message: `A story can have up to ${STORY_MAX_SCENES} scenes.`,
        path: ['lastScene', 'sceneNumber'],
      });
    }

    if (input.lastScene.status !== 'succeeded') {
      context.addIssue({
        code: 'custom',
        message:
          'The last scene must succeed before next-scene prompts can be suggested.',
        path: ['lastScene', 'status'],
      });
    }

    if (input.lastScene.outputFiles.length === 0) {
      context.addIssue({
        code: 'custom',
        message:
          'The last scene must have output files before next-scene prompts can be suggested.',
        path: ['lastScene', 'outputFiles'],
      });
    }
  });

export type StorySceneSettings = z.infer<typeof StorySceneSettingsSchema>;
export type StorySceneRunDraft = z.infer<typeof StorySceneRunDraftSchema>;
export type StorySceneContext = z.infer<typeof StorySceneContextSchema>;
export type NextPromptSuggestion = z.infer<typeof NextPromptSuggestionSchema>;
export type NextPromptSuggestionSet = z.infer<
  typeof NextPromptSuggestionSetSchema
>;
export type SuggestNextPromptsInput = z.infer<
  typeof SuggestNextPromptsInputSchema
>;

export type NextPromptSuggestionResult = NextPromptSuggestionSet & {
  provider: 'local-draft' | 'qwen-cloud';
  providerModel: string;
  warning: string | null;
};
