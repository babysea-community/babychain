import { describe, expect, it } from 'vitest';

import { getChainTemplate, parseTemplateInput } from '@/lib/chains/templates';
import {
  createShowrunnerPlanWithFallback,
  createLocalShowrunnerPlan,
  mapShowrunnerPlanToChainInputs,
  parseShowrunnerPlanForBrief,
  ShowrunnerBriefSchema,
} from '@/lib/showrunner';

describe('showrunner mapper', () => {
  it('maps a story plan into BabyChain-compatible run inputs', () => {
    const brief = ShowrunnerBriefSchema.parse({
      idea: 'A lighthouse keeper discovers a signal from her future self.',
      genre: 'mystery drama',
      sceneCount: 2,
      durationSeconds: 20,
      imageModel: 'qwen/image',
      videoModel: 'happyhorse/1.0-i2v',
      modifyModel: 'happyhorse/1.0-video-edit',
    });
    const template = getChainTemplate('chain');
    const result = createLocalShowrunnerPlan(brief);
    const mapping = mapShowrunnerPlanToChainInputs(result.plan, brief);

    expect(mapping.scenes).toHaveLength(2);
    expect(mapping.sceneDurationSeconds).toBe(10);

    for (const scene of mapping.scenes) {
      expect(scene.chainInput).toMatchObject({
        chain_models: {
          image_model: 'qwen/image',
          video_model: 'happyhorse/1.0-i2v',
          modify_model: 'happyhorse/1.0-video-edit',
        },
      });
      expect(() =>
        parseTemplateInput(template!, scene.chainInput, { byokMode: true }),
      ).not.toThrow();
    }
  });

  it('validates scene count and scene numbering against the brief', () => {
    const brief = ShowrunnerBriefSchema.parse({
      idea: 'A lighthouse keeper discovers a signal from her future self.',
      sceneCount: 2,
    });
    const plan = createLocalShowrunnerPlan(brief).plan;

    expect(() =>
      parseShowrunnerPlanForBrief(
        { ...plan, scenes: plan.scenes.slice(0, 1) },
        brief,
      ),
    ).toThrow('exactly 2 scenes');

    expect(() =>
      parseShowrunnerPlanForBrief(
        {
          ...plan,
          scenes: plan.scenes.map((scene, index) =>
            index === 1 ? { ...scene, sceneNumber: 1 } : scene,
          ),
        },
        brief,
      ),
    ).toThrow('unique');
  });

  it('falls back to a local draft when Qwen planning fails', async () => {
    const brief = ShowrunnerBriefSchema.parse({
      idea: 'A street magician realizes every vanished coin removes a memory.',
      sceneCount: 2,
    });
    const result = await createShowrunnerPlanWithFallback(brief, {
      qwenPlanner: async () => {
        throw new Error('upstream unavailable');
      },
      useQwen: true,
    });

    expect(result.provider).toBe('local-draft');
    expect(result.warning).toContain('local draft');
    expect(result.plan.scenes).toHaveLength(2);
  });
});
