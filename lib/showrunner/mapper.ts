import type { StorySceneRunDraft } from './schemas';

export function mapStorySceneToChainInput(draft: StorySceneRunDraft) {
  const settings = draft.settings;
  const modifyModel = settings.modifyModel.trim();
  const chainModels: Record<string, string> = {
    image_model: settings.imageModel,
    video_model: settings.videoModel,
  };
  const imagePrompt = promptWithFormat(
    draft.imagePrompt || draft.prompt,
    settings.visualFormat,
  );
  const videoPrompt = promptWithFormat(
    draft.videoPrompt || draft.prompt,
    settings.visualFormat,
  );
  const input: Record<string, unknown> = {
    chain_models: chainModels,
    image_model_input: {
      generation_prompt: imagePrompt,
    },
    video_model_input: {
      generation_duration: settings.durationSeconds,
      generation_prompt: videoPrompt,
    },
  };

  if (modifyModel) {
    chainModels.modify_model = modifyModel;
    input.modify_model_input = {
      generation_prompt:
        draft.editInstruction ||
        `Polish the scene while preserving the selected story direction: ${draft.prompt}`,
    };
  }

  return input;
}

function promptWithFormat(prompt: string, visualFormat: string) {
  return `${prompt.trim()} Visual format: ${visualFormat.trim()}.`;
}
