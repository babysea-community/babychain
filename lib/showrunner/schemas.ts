import { z } from 'zod';

export const SHOWRUNNER_MIN_SCENES = 1;
export const SHOWRUNNER_MAX_SCENES = 6;
export const SHOWRUNNER_MIN_DURATION_SECONDS = 15;
export const SHOWRUNNER_MAX_DURATION_SECONDS = 180;

export const ShowrunnerBriefSchema = z.object({
  idea: z.string().trim().min(8).max(2_000),
  genre: z.string().trim().min(1).max(80).default('short drama'),
  tone: z.string().trim().min(1).max(120).default('cinematic'),
  visualStyle: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .default('grounded cinematic realism'),
  audience: z.string().trim().min(1).max(120).default('general audience'),
  language: z.string().trim().min(1).max(80).default('English'),
  sceneCount: z.coerce
    .number()
    .int()
    .min(SHOWRUNNER_MIN_SCENES)
    .max(SHOWRUNNER_MAX_SCENES)
    .default(3),
  durationSeconds: z.coerce
    .number()
    .int()
    .min(SHOWRUNNER_MIN_DURATION_SECONDS)
    .max(SHOWRUNNER_MAX_DURATION_SECONDS)
    .default(45),
  characterNotes: z.string().trim().max(1_500).optional().default(''),
  imageModel: z.string().trim().min(1).default('qwen/image'),
  videoModel: z.string().trim().min(1).default('happyhorse/1.0-i2v'),
  modifyModel: z.string().trim().max(120).optional().default(''),
});

export const ShowrunnerCharacterSchema = z.object({
  name: z.string().trim().min(1).max(80),
  role: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(500),
  continuityPrompt: z.string().trim().min(1).max(500),
});

export const ShowrunnerSceneSchema = z.object({
  sceneNumber: z.number().int().min(1).max(SHOWRUNNER_MAX_SCENES),
  title: z.string().trim().min(1).max(120),
  storyBeat: z.string().trim().min(1).max(700),
  dialogue: z.string().trim().max(900).default(''),
  imagePrompt: z.string().trim().min(1).max(1_500),
  videoPrompt: z.string().trim().min(1).max(1_500),
  cameraDirection: z.string().trim().min(1).max(500),
  editInstruction: z.string().trim().max(500).default(''),
});

export const ShowrunnerPlanSchema = z.object({
  title: z.string().trim().min(1).max(120),
  logline: z.string().trim().min(1).max(500),
  synopsis: z.string().trim().min(1).max(1_000),
  styleBible: z.string().trim().min(1).max(1_200),
  characters: z.array(ShowrunnerCharacterSchema).min(1).max(6),
  scenes: z
    .array(ShowrunnerSceneSchema)
    .min(SHOWRUNNER_MIN_SCENES)
    .max(SHOWRUNNER_MAX_SCENES),
});

export type ShowrunnerBrief = z.infer<typeof ShowrunnerBriefSchema>;
export type ShowrunnerCharacter = z.infer<typeof ShowrunnerCharacterSchema>;
export type ShowrunnerScene = z.infer<typeof ShowrunnerSceneSchema>;
export type ShowrunnerPlan = z.infer<typeof ShowrunnerPlanSchema>;

export type ShowrunnerPlanResult = {
  plan: ShowrunnerPlan;
  provider: 'local-draft' | 'qwen-cloud';
  providerModel: string;
};

export function parseShowrunnerPlanForBrief(
  input: unknown,
  brief: ShowrunnerBrief,
): ShowrunnerPlan {
  const plan = ShowrunnerPlanSchema.parse(input);
  const sceneCount = brief.sceneCount;

  if (plan.scenes.length !== sceneCount) {
    throw new Error(
      `Showrunner plan must contain exactly ${sceneCount} scenes.`,
    );
  }

  const sceneNumbers = plan.scenes.map((scene) => scene.sceneNumber);

  if (new Set(sceneNumbers).size !== sceneNumbers.length) {
    throw new Error('Showrunner plan scene numbers must be unique.');
  }

  const expectedNumbers = new Set(
    Array.from({ length: sceneCount }, (_, index) => index + 1),
  );

  if (!sceneNumbers.every((sceneNumber) => expectedNumbers.has(sceneNumber))) {
    throw new Error(
      `Showrunner plan scene numbers must be exactly 1 through ${sceneCount}.`,
    );
  }

  return plan;
}
