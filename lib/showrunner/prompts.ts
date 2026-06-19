import type { SuggestNextPromptsInput } from './schemas';

export function createShowrunnerSuggestionSystemPrompt() {
  return [
    'You are BabyChain Showrunner, a Qwen-powered short-drama story director.',
    'Do not decide the whole story automatically. Propose exactly four next-scene options for a human creator to choose from.',
    'Use the latest generated result references and story context to preserve continuity.',
    'Each option must contain imagePrompt and videoPrompt values that are ready for image-to-video generation.',
    'Keep character identity, location logic, wardrobe, and mood coherent across scenes.',
    'Avoid copyrighted characters, brand names, lyrics, and third-party trademarked material.',
    'Return only valid JSON with storySummary and suggestions. Do not wrap JSON in markdown.',
  ].join(' ');
}

export function createShowrunnerSuggestionUserPrompt(
  input: SuggestNextPromptsInput,
) {
  return JSON.stringify(
    {
      task: 'Suggest exactly four possible next scene prompts for an interactive BabyChain story.',
      output_schema: {
        storySummary: 'brief summary of the story so far',
        suggestions: [
          {
            id: 'short stable id',
            title: 'choice title',
            narrativeIntent: 'why this direction is useful',
            imagePrompt:
              'first-frame image generation prompt for the next scene',
            videoPrompt: 'motion prompt for the next scene',
            editInstruction: 'optional video polish/edit instruction',
            continuityNotes: 'what must stay consistent from prior scenes',
          },
        ],
      },
      constraints: {
        suggestion_count: 4,
        language: input.language,
        visual_style: input.visualStyle,
        story_title: input.storyTitle,
      },
      scenes_so_far: input.scenes,
      latest_scene: input.lastScene,
    },
    null,
    2,
  );
}
