import type {
  ShowrunnerBrief,
  ShowrunnerPlan,
  ShowrunnerScene,
} from './schemas';

export type ShowrunnerChainScene = {
  sceneNumber: number;
  title: string;
  storyBeat: string;
  chainInput: Record<string, unknown>;
};

export type ShowrunnerChainMapping = {
  scenes: ShowrunnerChainScene[];
  imageModel: string;
  videoModel: string;
  modifyModel: string | null;
  sceneDurationSeconds: number;
};

export function mapShowrunnerPlanToChainInputs(
  plan: ShowrunnerPlan,
  brief: ShowrunnerBrief,
): ShowrunnerChainMapping {
  const imageModel = brief.imageModel;
  const videoModel = brief.videoModel;
  const modifyModel = brief.modifyModel.trim() || null;
  const sceneDurationSeconds = sceneDurationForBrief(brief);

  return {
    imageModel,
    videoModel,
    modifyModel,
    sceneDurationSeconds,
    scenes: plan.scenes.map((scene) => ({
      sceneNumber: scene.sceneNumber,
      title: scene.title,
      storyBeat: scene.storyBeat,
      chainInput: createSceneChainInput(scene, {
        imageModel,
        modifyModel,
        sceneDurationSeconds,
        videoModel,
      }),
    })),
  };
}

function createSceneChainInput(
  scene: ShowrunnerScene,
  options: {
    imageModel: string;
    modifyModel: string | null;
    sceneDurationSeconds: number;
    videoModel: string;
  },
) {
  const chainModels: Record<string, string> = {
    image_model: options.imageModel,
    video_model: options.videoModel,
  };
  const input: Record<string, unknown> = {
    chain_models: chainModels,
    image_model_input: {
      generation_prompt: scene.imagePrompt,
    },
    video_model_input: {
      generation_duration: options.sceneDurationSeconds,
      generation_prompt: [scene.videoPrompt, scene.cameraDirection]
        .filter(Boolean)
        .join(' '),
    },
  };

  if (options.modifyModel) {
    chainModels.modify_model = options.modifyModel;
    input.modify_model_input = {
      generation_prompt:
        scene.editInstruction ||
        `Polish the shot while preserving the story beat: ${scene.storyBeat}`,
    };
  }

  return input;
}

function sceneDurationForBrief(brief: ShowrunnerBrief) {
  const rawDuration = Math.round(brief.durationSeconds / brief.sceneCount);

  return clamp(rawDuration, 3, 10);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
