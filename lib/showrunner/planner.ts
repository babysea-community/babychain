import {
  ShowrunnerBriefSchema,
  parseShowrunnerPlanForBrief,
  type ShowrunnerPlan,
  type ShowrunnerPlanResult,
  type ShowrunnerBrief,
} from './schemas';

export type ShowrunnerPlanner = (
  brief: ShowrunnerBrief,
) => Promise<ShowrunnerPlanResult> | ShowrunnerPlanResult;

export type ShowrunnerPlanWithFallbackResult = ShowrunnerPlanResult & {
  warning: string | null;
};

export async function createShowrunnerPlanWithFallback(
  input: unknown,
  options: {
    qwenPlanner?: ShowrunnerPlanner;
    useQwen?: boolean;
    warning?: string | null;
  } = {},
): Promise<ShowrunnerPlanWithFallbackResult> {
  const brief = ShowrunnerBriefSchema.parse(input);

  if (options.useQwen && options.qwenPlanner) {
    try {
      const result = await options.qwenPlanner(brief);

      return { ...result, warning: options.warning ?? null };
    } catch {
      const local = createLocalShowrunnerPlan(brief);

      return {
        ...local,
        warning:
          options.warning ??
          'Qwen Cloud failed, so BabyChain generated a local draft plan instead.',
      };
    }
  }

  const local = createLocalShowrunnerPlan(brief);

  return { ...local, warning: options.warning ?? null };
}

export function createLocalShowrunnerPlan(
  input: unknown,
): ShowrunnerPlanResult {
  const brief = ShowrunnerBriefSchema.parse(input);
  const plan: ShowrunnerPlan = {
    title: titleFromIdea(brief.idea),
    logline: `A ${brief.tone} ${brief.genre} about ${brief.idea}`,
    synopsis: `A compact ${brief.durationSeconds}-second drama shaped for ${brief.audience}. The story uses ${brief.visualStyle} and keeps the conflict readable across ${brief.sceneCount} generated scenes.`,
    styleBible: `${brief.visualStyle}. Keep faces, wardrobe, palette, location logic, and camera language consistent across every scene. Use ${brief.language} for any visible text or dialogue cues.`,
    characters: [
      {
        name: 'Lead',
        role: 'protagonist',
        description:
          brief.characterNotes ||
          'A focused protagonist with a clear emotional objective.',
        continuityPrompt:
          brief.characterNotes ||
          'Same protagonist, consistent face, wardrobe, age, and silhouette.',
      },
    ],
    scenes: Array.from({ length: brief.sceneCount }, (_, index) => {
      const sceneNumber = index + 1;
      const phase = scenePhase(index, brief.sceneCount);

      return {
        sceneNumber,
        title: `${phase} ${sceneNumber}`,
        storyBeat: `${phase}: ${brief.idea}`,
        dialogue:
          sceneNumber === brief.sceneCount
            ? 'A brief closing line or silent emotional resolution.'
            : 'A short line of dialogue or restrained voiceover.',
        imagePrompt: [
          `${brief.visualStyle} first frame for a ${brief.genre}.`,
          `Scene ${sceneNumber}: ${phase.toLowerCase()} moment from: ${brief.idea}.`,
          brief.characterNotes ||
            'The protagonist is visually consistent and immediately readable.',
          `Tone: ${brief.tone}.`,
        ].join(' '),
        videoPrompt: [
          `Animate scene ${sceneNumber} as a ${brief.tone} short-drama beat.`,
          `Show ${phase.toLowerCase()} through controlled character motion and environmental detail.`,
          'Keep continuity with the first frame and avoid abrupt identity changes.',
        ].join(' '),
        cameraDirection:
          sceneNumber === 1
            ? 'Slow push-in establishing the character, place, and conflict.'
            : sceneNumber === brief.sceneCount
              ? 'Steady closing shot with a clean emotional hold.'
              : 'Measured tracking movement that reveals the next decision.',
        editInstruction:
          sceneNumber === brief.sceneCount
            ? 'Refine pacing and hold the final expression for a clear ending.'
            : 'Keep motion coherent and preserve character continuity.',
      };
    }),
  };

  return {
    plan: parseShowrunnerPlanForBrief(plan, brief),
    provider: 'local-draft',
    providerModel: 'deterministic-local-draft',
  };
}

function titleFromIdea(idea: string) {
  const trimmed = idea.trim().replace(/[.!?]+$/g, '');
  const words = trimmed.split(/\s+/).slice(0, 8).join(' ');

  return words.length > 0 ? words : 'Untitled Short Drama';
}

function scenePhase(index: number, total: number) {
  if (index === 0) {
    return 'Setup';
  }

  if (index === total - 1) {
    return 'Resolution';
  }

  return index < total / 2 ? 'Escalation' : 'Turn';
}
