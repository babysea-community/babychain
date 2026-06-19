import type { ShowrunnerBrief } from './schemas';

export function createShowrunnerSystemPrompt() {
  return [
    'You are BabyChain Showrunner, an AI short-drama director.',
    'Create compact, production-ready story plans for image-to-video generation chains.',
    'Return only valid JSON. Do not wrap the JSON in markdown.',
    'Every scene must be visually executable by image and video generation models.',
    'Keep character continuity explicit across imagePrompt and videoPrompt.',
    'Avoid copyrighted characters, brands, lyrics, and third-party trademarked material.',
  ].join(' ');
}

export function createShowrunnerUserPrompt(brief: ShowrunnerBrief) {
  return JSON.stringify(
    {
      task: 'Create a short-drama showrunner plan for BabyChain.',
      output_schema: {
        title: 'string',
        logline: 'string',
        synopsis: 'string',
        styleBible: 'string',
        characters: [
          {
            name: 'string',
            role: 'string',
            description: 'string',
            continuityPrompt: 'string',
          },
        ],
        scenes: [
          {
            sceneNumber: 'number starting at 1',
            title: 'string',
            storyBeat: 'string',
            dialogue: 'brief optional dialogue or voiceover',
            imagePrompt: 'single detailed first-frame prompt',
            videoPrompt: 'single detailed motion prompt',
            cameraDirection: 'camera movement and framing',
            editInstruction: 'optional post-video edit instruction',
          },
        ],
      },
      constraints: {
        scene_count: brief.sceneCount,
        total_duration_seconds: brief.durationSeconds,
        language: brief.language,
        genre: brief.genre,
        tone: brief.tone,
        visual_style: brief.visualStyle,
        audience: brief.audience,
        character_notes: brief.characterNotes,
      },
      creator_idea: brief.idea,
    },
    null,
    2,
  );
}
