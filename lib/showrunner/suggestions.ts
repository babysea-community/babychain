import {
  NextPromptSuggestionSetSchema,
  SuggestNextPromptsInputSchema,
  type NextPromptSuggestion,
  type NextPromptSuggestionResult,
  type SuggestNextPromptsInput,
} from './schemas';

export type StorySuggestionProvider = (
  input: SuggestNextPromptsInput,
) => Promise<NextPromptSuggestionResult> | NextPromptSuggestionResult;

export async function createNextPromptSuggestionsWithFallback(
  input: unknown,
  options: {
    provider?: StorySuggestionProvider;
    useQwen?: boolean;
    warning?: string | null;
  } = {},
): Promise<NextPromptSuggestionResult> {
  const parsed = SuggestNextPromptsInputSchema.parse(input);

  if (options.useQwen && options.provider) {
    try {
      const result = await options.provider(parsed);

      return { ...result, warning: options.warning ?? result.warning ?? null };
    } catch {
      return createLocalNextPromptSuggestions(parsed, {
        warning:
          options.warning ??
          'Qwen Cloud failed, so BabyChain generated local next-scene options instead.',
      });
    }
  }

  return createLocalNextPromptSuggestions(parsed, {
    warning: options.warning ?? null,
  });
}

export function createLocalNextPromptSuggestions(
  input: unknown,
  options: { warning?: string | null } = {},
): NextPromptSuggestionResult {
  const parsed = SuggestNextPromptsInputSchema.parse(input);
  const latest = parsed.lastScene;
  const outputHint = latest.outputFiles.length
    ? `Reference the latest generated output: ${latest.outputFiles.join(', ')}.`
    : 'Use the latest prompt as the continuity anchor.';
  const suggestions: NextPromptSuggestion[] = [
    {
      id: 'continue-tension',
      title: 'Continue the tension',
      narrativeIntent:
        'Carry the current conflict forward without revealing the full answer yet.',
      imagePrompt: `${parsed.visualStyle}. Next scene after scene ${latest.sceneNumber}: the protagonist reacts to the consequence of "${latest.prompt}". Keep the same character, location logic, wardrobe, and emotional tone. ${outputHint}`,
      videoPrompt:
        'Animate a controlled escalation with subtle character movement, environmental detail, and a clear unresolved choice.',
      editInstruction:
        'Preserve continuity and hold the final frame long enough to invite the next decision.',
      continuityNotes:
        'Keep identity, wardrobe, lighting palette, and the unresolved story question consistent.',
    },
    {
      id: 'reveal-clue',
      title: 'Reveal a clue',
      narrativeIntent:
        'Give the viewer one concrete piece of information while opening a bigger question.',
      imagePrompt: `${parsed.visualStyle}. Show a close visual clue connected to "${latest.prompt}" while keeping the main character present or implied. ${outputHint}`,
      videoPrompt:
        'Animate a reveal through camera movement, focus shift, or object motion; make the clue readable without exposition.',
      editInstruction:
        'Emphasize the clue with clean pacing and avoid changing the character design.',
      continuityNotes:
        'The clue should feel discovered from the previous scene, not randomly introduced.',
    },
    {
      id: 'emotional-beat',
      title: 'Emotional beat',
      narrativeIntent:
        'Slow the story for a character decision so the next action feels motivated.',
      imagePrompt: `${parsed.visualStyle}. Create an intimate reaction frame after "${latest.prompt}" with the protagonist making a visible emotional choice. ${outputHint}`,
      videoPrompt:
        'Animate restrained facial expression, breath, posture, and a small decisive movement.',
      editInstruction:
        'Keep motion minimal and expressive; prioritize continuity over spectacle.',
      continuityNotes:
        'The emotional state should be a direct response to the latest scene.',
    },
    {
      id: 'twist-escalation',
      title: 'Twist escalation',
      narrativeIntent:
        'Introduce a surprising but logical complication that changes what the viewer expects.',
      imagePrompt: `${parsed.visualStyle}. Stage a twist that grows naturally from "${latest.prompt}" without breaking continuity. ${outputHint}`,
      videoPrompt:
        'Animate the twist through a reveal, interruption, or sudden environmental change while keeping the camera readable.',
      editInstruction:
        'Make the twist clear but not chaotic; preserve the story world rules.',
      continuityNotes:
        'The twist must connect to prior scene details and keep the same visual world.',
    },
  ];
  const parsedSet = NextPromptSuggestionSetSchema.parse({
    storySummary: summarizeStory(parsed),
    suggestions,
  });

  return {
    ...parsedSet,
    provider: 'local-draft',
    providerModel: 'deterministic-local-suggestions',
    warning: options.warning ?? null,
  };
}

function summarizeStory(input: SuggestNextPromptsInput) {
  const sceneSummary = input.scenes
    .map((scene) => `Scene ${scene.sceneNumber}: ${scene.prompt}`)
    .join(' ');

  return sceneSummary.length > 0
    ? sceneSummary.slice(0, 1_000)
    : 'The story has one generated scene and is ready for the next human choice.';
}
