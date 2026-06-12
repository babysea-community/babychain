import { describe, expect, it } from 'vitest';

import {
  assertSafeCallbackUrl,
  cancelRun,
  prepareStepParamsForProvider,
  processRun,
} from '@/lib/chains/runner';
import { serializeRunWithSteps } from '@/lib/chains/presenters';
import type { ChainRunWithSteps } from '@/lib/chains/types';
import { BabyChainError } from '@/lib/utils/errors';

describe('runner callback validation', () => {
  it('accepts https callback URLs', () => {
    expect(() =>
      assertSafeCallbackUrl('https://api.example.com/babychain/callback'),
    ).not.toThrow();
  });

  it('rejects non-https callback URLs', () => {
    expect(() =>
      assertSafeCallbackUrl('http://api.example.com/callback'),
    ).toThrow('Callback URL must use HTTPS.');
  });

  it('rejects callback URLs with credentials', () => {
    expect(() =>
      assertSafeCallbackUrl('https://user:pass@api.example.com/callback'),
    ).toThrow('Callback URL must not include credentials.');
  });

  it('rejects obvious local callback hosts', () => {
    expect(() => assertSafeCallbackUrl('https://localhost/callback')).toThrow(
      'Callback URL host is not allowed.',
    );
    expect(() => assertSafeCallbackUrl('https://[::1]/callback')).toThrow(
      'Callback URL host is not allowed.',
    );
  });

  it('rejects special-use callback network targets', () => {
    for (const url of [
      'https://100.64.0.1/callback',
      'https://198.18.0.1/callback',
      'https://[100::1]/callback',
      'https://[2001::1]/callback',
      'https://[2001:2::1]/callback',
      'https://[2001:10::1]/callback',
      'https://[2001:20::1]/callback',
      'https://[3fff::1]/callback',
      'https://[::ffff:127.0.0.1]/callback',
      'https://[::ffff:808:808:dead]/callback',
      'https://[fe90::1]/callback',
      'https://[fec0::1]/callback',
    ]) {
      expect(() => assertSafeCallbackUrl(url)).toThrow(
        'Callback URL host is not allowed.',
      );
    }
  });

  it('accepts public IPv6 callback URLs', () => {
    expect(() =>
      assertSafeCallbackUrl('https://[2606:4700:4700::1111]/callback'),
    ).not.toThrow();
  });

  it('rejects malformed callback URLs as validation errors', () => {
    expect(() => assertSafeCallbackUrl('not a url')).toThrow(
      'Callback URL must be a valid URL.',
    );
  });
});

describe('runner step claiming', () => {
  it('keeps raw model inputs for direct providers only', () => {
    const params = {
      generation_prompt: 'BabySea prompt',
      generation_ratio: '16:9',
    };
    const input = {
      image_model_input: {
        output_format: 'jpg',
        prompt: 'Raw provider prompt',
        size: '2K',
        skipped: undefined,
      },
    };

    expect(
      prepareStepParamsForProvider({
        input,
        params,
        providerName: 'babysea',
        stepKey: 'image',
      }),
    ).toEqual(params);

    expect(
      prepareStepParamsForProvider({
        input,
        params,
        providerName: 'byteplus',
        stepKey: 'image',
      }),
    ).toEqual({
      generation_prompt: 'BabySea prompt',
      generation_ratio: '16:9',
      output_format: 'jpg',
      prompt: 'Raw provider prompt',
      size: '2K',
    });
  });

  it('rejects provider-controlled raw model inputs before direct provider submit', () => {
    expect(() =>
      prepareStepParamsForProvider({
        input: {
          video_model_input: {
            callback_url: 'https://callbacks.example.com/provider',
            generation_callback_url: 'https://callbacks.example.com/generated',
            generation_model: 'untrusted-generation-model',
            model: 'untrusted-model',
          },
        },
        params: { generation_prompt: 'BabySea prompt' },
        providerName: 'byteplus',
        stepKey: 'video',
      }),
    ).toThrow('Provider-controlled model input key is not allowed');
  });

  it('keeps a recently started BabySea step running while the generation id is pending', async () => {
    const record = createRunWithSteps({
      run: {
        currentStepKey: 'image',
        status: 'running',
      },
      step: {
        startedAt: new Date().toISOString(),
        status: 'running',
      },
    });

    const result = await processRun(record, {
      babysea: {} as never,
      store: {} as never,
    });

    expect(result.run.status).toBe('running');
    expect(result.steps[0]!.status).toBe('running');
    expect(result.steps[0]!.babyseaGenerationId).toBeNull();
  });

  it('fails an abandoned BabySea start after the stale-start deadline', async () => {
    const record = createRunWithSteps({
      run: {
        currentStepKey: 'image',
        status: 'running',
      },
      step: {
        startedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
        status: 'running',
      },
    });
    let updatedRecord = record;
    const store = {
      getRunWithSteps: async () => updatedRecord,
      updateRunningStep: async (
        _stepId: string,
        patch: Record<string, unknown>,
      ) => {
        const step = updatedRecord.steps[0]!;

        if (step.status !== 'running') {
          return null;
        }

        updatedRecord = {
          ...updatedRecord,
          steps: [
            {
              ...step,
              ...patch,
            },
          ],
        };

        return updatedRecord.steps[0]!;
      },
      updateActiveRun: async (
        _runId: string,
        patch: Record<string, unknown>,
      ) => {
        updatedRecord = {
          ...updatedRecord,
          run: {
            ...updatedRecord.run,
            ...patch,
          },
        };

        return updatedRecord.run;
      },
    };

    const result = await processRun(record, {
      babysea: {} as never,
      store: store as never,
    });

    expect(result.run.status).toBe('failed');
    expect(result.run.errorCode).toBe('babysea_start_timed_out');
    expect(result.steps[0]!.status).toBe('failed');
    expect(result.steps[0]!.errorCode).toBe('babysea_start_timed_out');
  });

  it('does not start BabySea generation when another processor claimed the queued step', async () => {
    const record = createRunWithSteps();
    let generateCalled = false;
    const store = {
      claimQueuedStep: async () => null,
      getRunWithSteps: async () => record,
    };
    const babysea = {
      generate: async () => {
        generateCalled = true;
        throw new Error('generate should not be called');
      },
    };

    const result = await processRun(record, {
      babysea: babysea as never,
      store: store as never,
    });

    expect(generateCalled).toBe(false);
    expect(result.run.status).toBe('queued');
  });

  it('requeues a step when provider submit is rate limited', async () => {
    let updatedRecord = createRunWithSteps();
    let generateCalled = false;
    const store = {
      claimQueuedStep: async (
        stepId: string,
        patch: Record<string, unknown>,
      ) => {
        const step = updatedRecord.steps.find(
          (candidate) =>
            candidate.id === stepId && candidate.status === 'queued',
        );

        if (!step) {
          return null;
        }

        updatedRecord = {
          ...updatedRecord,
          steps: [
            {
              ...step,
              ...patch,
            } as ChainRunWithSteps['steps'][number],
          ],
        };

        return updatedRecord.steps[0]!;
      },
      getRunWithSteps: async () => updatedRecord,
      updateActiveRun: async (
        _runId: string,
        patch: Record<string, unknown>,
      ) => {
        if (!['queued', 'running'].includes(updatedRecord.run.status)) {
          return null;
        }

        updatedRecord = {
          ...updatedRecord,
          run: {
            ...updatedRecord.run,
            ...patch,
          },
        };

        return updatedRecord.run;
      },
      updateRunningStep: async (
        stepId: string,
        patch: Record<string, unknown>,
      ) => {
        const step = updatedRecord.steps.find(
          (candidate) =>
            candidate.id === stepId && candidate.status === 'running',
        );

        if (!step) {
          return null;
        }

        updatedRecord = {
          ...updatedRecord,
          steps: [
            {
              ...step,
              ...patch,
            } as ChainRunWithSteps['steps'][number],
          ],
        };

        return updatedRecord.steps[0]!;
      },
    };
    const babysea = {
      generate: async () => {
        generateCalled = true;
        throw new BabyChainError(
          'provider_rate_limited',
          'Provider responded 429.',
          429,
        );
      },
    };

    const result = await processRun(updatedRecord, {
      babysea: babysea as never,
      store: store as never,
    });

    expect(generateCalled).toBe(true);
    expect(result.run.status).toBe('queued');
    expect(result.run.currentStepKey).toBeNull();
    expect(result.run.errorCode).toBeNull();
    expect(result.steps[0]!.status).toBe('queued');
    expect(result.steps[0]!.startedAt).toBeNull();
    expect(result.steps[0]!.errorCode).toBeNull();
  });

  it('does not start BabySea generation when the run became terminal after step claim', async () => {
    const record = createRunWithSteps();
    const canceledRecord = createRunWithSteps({
      run: {
        completedAt: new Date().toISOString(),
        status: 'canceled',
      },
      step: {
        completedAt: new Date().toISOString(),
        status: 'canceled',
      },
    });
    let generateCalled = false;
    let localStepCanceled = false;
    const store = {
      claimQueuedStep: async (
        _stepId: string,
        patch: Record<string, unknown>,
      ) =>
        ({
          ...record.steps[0]!,
          ...patch,
        }) as ChainRunWithSteps['steps'][number],
      getRunWithSteps: async () => canceledRecord,
      updateActiveRun: async () => null,
      updateRunningStep: async (
        _stepId: string,
        patch: Record<string, unknown>,
      ) => {
        localStepCanceled = patch.status === 'canceled';

        return {
          ...record.steps[0]!,
          ...patch,
        } as ChainRunWithSteps['steps'][number];
      },
    };
    const babysea = {
      generate: async () => {
        generateCalled = true;
        throw new Error('generate should not be called');
      },
    };

    const result = await processRun(record, {
      babysea: babysea as never,
      store: store as never,
    });

    expect(generateCalled).toBe(false);
    expect(localStepCanceled).toBe(true);
    expect(result.run.status).toBe('canceled');
  });

  it('cancels the BabySea generation when local cancellation wins during start', async () => {
    const record = createRunWithSteps();
    const canceledRecord = createRunWithSteps({
      run: {
        completedAt: new Date().toISOString(),
        status: 'canceled',
      },
      step: {
        completedAt: new Date().toISOString(),
        status: 'canceled',
      },
    });
    let canceledGenerationId: string | null = null;
    const store = {
      claimQueuedStep: async (
        _stepId: string,
        patch: Record<string, unknown>,
      ) =>
        ({
          ...record.steps[0]!,
          ...patch,
        }) as ChainRunWithSteps['steps'][number],
      getRunWithSteps: async () => canceledRecord,
      updateActiveRun: async (_runId: string, patch: Record<string, unknown>) =>
        ({
          ...record.run,
          ...patch,
        }) as ChainRunWithSteps['run'],
      updateRunningStep: async () => null,
    };
    const babysea = {
      cancelGeneration: async (generationId: string) => {
        canceledGenerationId = generationId;
      },
      generate: async () => ({
        data: {
          generation_id: 'gen_canceled_after_start',
        },
        idempotency_replayed: false,
        request_id: 'req_canceled_after_start',
      }),
    };

    const result = await processRun(record, {
      babysea: babysea as never,
      store: store as never,
    });

    expect(canceledGenerationId).toBe('gen_canceled_after_start');
    expect(result.run.status).toBe('canceled');
  });

  it('does not cancel BabySea when client cancellation loses to a terminal run', async () => {
    const record = createRunWithSteps({
      run: {
        currentStepKey: 'image',
        status: 'running',
      },
      step: {
        babyseaGenerationId: 'gen_already_succeeded',
        startedAt: new Date().toISOString(),
        status: 'running',
      },
    });
    const succeededRecord = createRunWithSteps({
      run: {
        completedAt: new Date().toISOString(),
        status: 'succeeded',
      },
      step: {
        babyseaGenerationId: 'gen_already_succeeded',
        completedAt: new Date().toISOString(),
        status: 'succeeded',
      },
    });
    let getCalls = 0;
    let cancelGenerationCalled = false;
    const store = {
      getRunWithSteps: async () => {
        getCalls += 1;

        return getCalls === 1 ? record : succeededRecord;
      },
      updateActiveRun: async () => null,
    };
    const babysea = {
      cancelGeneration: async () => {
        cancelGenerationCalled = true;
      },
    };

    const result = await cancelRun(record.run.id, {
      babysea: babysea as never,
      store: store as never,
    });

    expect(cancelGenerationCalled).toBe(false);
    expect(result.run.status).toBe('succeeded');
  });

  it('marks client cancellation locally before canceling BabySea generation', async () => {
    let updatedRecord = createRunWithSteps({
      run: {
        currentStepKey: 'image',
        status: 'running',
      },
      step: {
        babyseaGenerationId: 'gen_client_canceled',
        startedAt: new Date().toISOString(),
        status: 'running',
      },
    });
    const order: string[] = [];
    const store = {
      claimCallbackDelivery: async () => false,
      getRunWithSteps: async () => updatedRecord,
      recordAuditEvent: async () => {
        order.push('audit');
      },
      updateActiveRun: async (
        _runId: string,
        patch: Record<string, unknown>,
      ) => {
        order.push('run');
        updatedRecord = {
          ...updatedRecord,
          run: {
            ...updatedRecord.run,
            ...patch,
          },
        };

        return updatedRecord.run;
      },
      updateRunningStep: async (
        _stepId: string,
        patch: Record<string, unknown>,
      ) => {
        order.push('step');
        updatedRecord = {
          ...updatedRecord,
          steps: [
            {
              ...updatedRecord.steps[0]!,
              ...patch,
            },
          ],
        };

        return updatedRecord.steps[0]!;
      },
    };
    const babysea = {
      cancelGeneration: async () => {
        order.push('babysea');
      },
    };

    const result = await cancelRun(updatedRecord.run.id, {
      babysea: babysea as never,
      store: store as never,
    });

    expect(order).toEqual(['run', 'step', 'babysea', 'audit']);
    expect(result.run.status).toBe('canceled');
    expect(result.steps[0]!.status).toBe('canceled');
  });

  it('ignores BabySea status updates after local cancellation wins', async () => {
    const record = createRunWithSteps({
      run: {
        currentStepKey: 'image',
        status: 'running',
      },
      step: {
        babyseaGenerationId: 'gen_late_webhook',
        startedAt: new Date().toISOString(),
        status: 'running',
      },
    });
    const canceledRecord = createRunWithSteps({
      run: {
        completedAt: new Date().toISOString(),
        status: 'canceled',
      },
      step: {
        babyseaGenerationId: 'gen_late_webhook',
        completedAt: new Date().toISOString(),
        status: 'canceled',
      },
    });
    let updateStepCalled = false;
    const store = {
      getRunWithSteps: async () => canceledRecord,
      updateRunningStep: async () => null,
      updateStep: async () => {
        updateStepCalled = true;
        throw new Error('late webhook should not update a terminal step');
      },
    };
    const babysea = {
      getGeneration: async () => ({
        data: {
          generation_completed_at: new Date().toISOString(),
          generation_id: 'gen_late_webhook',
          generation_output_file: ['https://cdn.example.com/output.png'],
          generation_provider_order: ['byteplus'],
          generation_provider_used: 'byteplus',
          generation_status: 'succeeded',
        },
        request_id: 'req_late_webhook',
      }),
    };

    const result = await processRun(record, {
      babysea: babysea as never,
      store: store as never,
    });

    expect(updateStepCalled).toBe(false);
    expect(result.run.status).toBe('canceled');
    expect(result.steps[0]!.status).toBe('canceled');
  });

  it('skips queued steps when an earlier step fails', async () => {
    const failedStepRecord = createRunWithSteps({
      run: {
        currentStepKey: null,
        status: 'running',
      },
      step: {
        completedAt: new Date().toISOString(),
        errorCode: 'provider_invalid_request',
        errorMessage: 'Alibaba Cloud responded 400.',
        status: 'failed',
      },
    });
    const queuedVideoStep = {
      ...failedStepRecord.steps[0]!,
      completedAt: null,
      dependsOn: ['image'],
      errorCode: null,
      errorMessage: null,
      id: '5f1c6f0a-95c5-4f1d-9f74-8f2f5b8f1c11',
      modelIdentifier: 'bytedance/seedance-1.5-pro',
      status: 'queued' as const,
      stepIndex: 1,
      stepKey: 'video',
      stepKind: 'video' as const,
    };
    let updatedRecord: ChainRunWithSteps = {
      ...failedStepRecord,
      steps: [failedStepRecord.steps[0]!, queuedVideoStep],
    };
    const store = {
      getRunWithSteps: async () => updatedRecord,
      updateActiveRun: async (
        _runId: string,
        patch: Record<string, unknown>,
      ) => {
        updatedRecord = {
          ...updatedRecord,
          run: { ...updatedRecord.run, ...patch },
        };
        return updatedRecord.run;
      },
      updateQueuedStep: async (
        stepId: string,
        patch: Record<string, unknown>,
      ) => {
        const stepIndex = updatedRecord.steps.findIndex(
          (step) => step.id === stepId && step.status === 'queued',
        );

        if (stepIndex < 0) {
          return null;
        }

        const updatedStep = {
          ...updatedRecord.steps[stepIndex]!,
          ...patch,
        } as ChainRunWithSteps['steps'][number];

        updatedRecord = {
          ...updatedRecord,
          steps: updatedRecord.steps.map((step, index) =>
            index === stepIndex ? updatedStep : step,
          ),
        };

        return updatedStep;
      },
    };

    const result = await processRun(updatedRecord, {
      store: store as never,
    });

    expect(result.run.status).toBe('failed');
    expect(result.run.errorCode).toBe('provider_invalid_request');
    // No input will ever arrive for the queued video step once the image
    // step has failed — it must be skipped immediately, not left queued.
    expect(result.steps[1]!.status).toBe('skipped');
    expect(result.steps[1]!.completedAt).toBeTruthy();
  });

  it('fails the chain when the next step cannot use a previous output', async () => {
    const firstStepRecord = createRunWithSteps({
      run: {
        currentStepKey: null,
        status: 'running',
      },
      step: {
        babyseaGenerationId: 'gen_empty_image',
        completedAt: new Date().toISOString(),
        outputFiles: [],
        status: 'succeeded',
      },
    });
    const videoStep = {
      ...firstStepRecord.steps[0]!,
      babyseaGenerationId: null,
      completedAt: null,
      dependsOn: ['image'],
      id: 'd432191c-f4b4-4ed9-b121-d2bd893d7e16',
      modelIdentifier: 'bytedance/seedance-1.5-pro',
      outputFiles: [],
      requestParams: null,
      startedAt: null,
      status: 'queued' as const,
      stepIndex: 1,
      stepKey: 'video',
      stepKind: 'video' as const,
    };
    let updatedRecord: ChainRunWithSteps = {
      ...firstStepRecord,
      steps: [firstStepRecord.steps[0]!, videoStep],
    };
    let claimQueuedStepCalled = false;
    const store = {
      claimQueuedStep: async () => {
        claimQueuedStepCalled = true;
        return null;
      },
      getRunWithSteps: async () => updatedRecord,
      updateActiveRun: async (
        _runId: string,
        patch: Record<string, unknown>,
      ) => {
        updatedRecord = {
          ...updatedRecord,
          run: {
            ...updatedRecord.run,
            ...patch,
          },
        };

        return updatedRecord.run;
      },
      updateQueuedStep: async (
        stepId: string,
        patch: Record<string, unknown>,
      ) => {
        const stepIndex = updatedRecord.steps.findIndex(
          (step) => step.id === stepId && step.status === 'queued',
        );

        if (stepIndex < 0) {
          return null;
        }

        const updatedStep = {
          ...updatedRecord.steps[stepIndex]!,
          ...patch,
        } as ChainRunWithSteps['steps'][number];

        updatedRecord = {
          ...updatedRecord,
          steps: updatedRecord.steps.map((step, index) =>
            index === stepIndex ? updatedStep : step,
          ),
        };

        return updatedStep;
      },
    };
    const babysea = {
      generate: async () => {
        throw new Error('generate should not be called');
      },
    };

    const result = await processRun(updatedRecord, {
      babysea: babysea as never,
      store: store as never,
    });

    expect(claimQueuedStepCalled).toBe(false);
    expect(result.run.status).toBe('failed');
    expect(result.run.errorCode).toBe('chain_step_params_failed');
    expect(result.steps[1]!.status).toBe('failed');
    expect(result.steps[1]!.errorMessage).toBe(
      'Required previous step output is missing.',
    );
  });
});

describe('runner response presentation', () => {
  it('keeps BabySea SDK identifiers in BabySea mode', () => {
    const record = createRunWithSteps({
      run: {
        output: { final_step_key: 'image' },
        status: 'succeeded',
      },
      step: {
        babyseaGenerationId: 'gen_babysea_123',
        babyseaIdempotencyReplayed: false,
        babyseaPredictionId: 'pred_babysea_123',
        babyseaRequestId: 'req_babysea_123',
        completedAt: new Date().toISOString(),
        outputFiles: ['https://cdn.example.com/babysea.png'],
        providerOrder: ['byteplus', 'fal'],
        providerUsed: 'byteplus',
        status: 'succeeded',
      },
    });

    const response = serializeRunWithSteps(record) as SerializedRunResponse;
    const step = response.steps[0]!;

    expect(response.mode).toBe('babysea');
    expect(response).not.toHaveProperty('estimate');
    expect(response).not.toHaveProperty('output');
    expect(response).not.toHaveProperty('completed_at');
    expect(response.current_step_key).toBe('completed');
    expect(response.input.chain_models).toEqual({
      image_model: 'bytedance/seedream-4.5',
    });
    expect(step).toMatchObject({
      babysea_generation_id: 'gen_babysea_123',
      babysea_idempotency_replayed: false,
      completed_at: expect.any(String),
      generation_output_file: ['https://cdn.example.com/babysea.png'],
      babysea_prediction_id: 'pred_babysea_123',
      babysea_request_id: 'req_babysea_123',
      provider_order: ['byteplus', 'fal'],
      provider_used: 'byteplus',
      started_at: null,
    });
    expect(step).not.toHaveProperty('provider_generation_id');
    expect(step).not.toHaveProperty('output_files');
    expect(step).not.toHaveProperty('request_params');
  });

  it('uses provider identifiers and strips BabySea-only fields in BYOK mode', () => {
    const record = createRunWithSteps({
      run: {
        byokCredentials: { mode: 'server_env', providers: ['bfl'] },
        output: {
          final_step_key: 'image',
          model_results: [{ babysea_generation_id: 'old_leaked_id' }],
          output_files: ['https://cdn.example.com/old.png'],
          steps: {
            image: { babysea_generation_id: 'old_leaked_id' },
          },
        },
        status: 'succeeded',
      },
      step: {
        babyseaGenerationId: 'bfl_task_123',
        babyseaPredictionId: null,
        babyseaRequestId: null,
        completedAt: new Date().toISOString(),
        dependsOn: ['image'],
        modelIdentifier: 'bfl/flux-1.1-pro',
        outputFiles: ['https://cdn.example.com/byok.png'],
        providerOrder: ['bfl'],
        providerMetadata: {
          output_expires_at: '2026-06-03T10:10:00.000Z',
          polling_url: 'https://api.bfl.ai/v1/get_result?id=bfl_task_123',
        },
        providerUsed: 'bfl',
        requestParams: {
          babysea_generation_id: 'internal_babysea_id',
          generation_input_file: ['https://cdn.example.com/input.png'],
          generation_output_file: ['https://cdn.example.com/output.png'],
          generation_output_format: 'png',
          generation_output_number: 1,
          generation_provider_order: ['bfl'],
          provider_request_id: 'internal_provider_request_id',
          prompt: 'A product render',
        },
        status: 'succeeded',
      },
    });

    const response = serializeRunWithSteps(record) as SerializedRunResponse;
    const step = response.steps[0]!;

    expect(response.mode).toBe('byok');
    expect(response).not.toHaveProperty('estimate');
    expect(response).not.toHaveProperty('output');
    expect(response).not.toHaveProperty('completed_at');
    expect(response.current_step_key).toBe('completed');
    expect(step).not.toHaveProperty('babysea_generation_id');
    expect(step).not.toHaveProperty('babysea_prediction_id');
    expect(step).not.toHaveProperty('babysea_request_id');
    expect(step).not.toHaveProperty('provider_generation_id');
    expect(step).not.toHaveProperty('provider_prediction_id');
    expect(step).not.toHaveProperty('provider_request_id');
    expect(step).not.toHaveProperty('provider_order');
    expect(step).not.toHaveProperty('provider_used');
    expect(step).not.toHaveProperty('request_params');
    expect(step).not.toHaveProperty('output_files');
    expect(step).not.toHaveProperty('generation_output_format');
    expect(step).not.toHaveProperty('generation_output_number');
    expect(step).not.toHaveProperty('generation_provider_order');
    expect(step.provider_metadata).toEqual({
      output_expires_at: '2026-06-03T10:10:00.000Z',
    });
    expect(step).toMatchObject({
      completed_at: expect.any(String),
      generation_input_file: ['https://cdn.example.com/input.png'],
      generation_output_file: ['https://cdn.example.com/byok.png'],
      started_at: null,
    });
  });

  it('does not duplicate caller-provided initial image inputs at step level', () => {
    const record = createRunWithSteps({
      run: {
        input: {
          image_model: 'bytedance/seedream-5-lite',
          image_model_input: {
            generation_input_file: ['https://cdn.example.com/source.jpg'],
            generation_prompt: 'Refine the source image',
          },
        },
      },
      step: {
        modelIdentifier: 'bytedance/seedream-5-lite',
        requestParams: {
          generation_input_file: ['https://cdn.example.com/source.jpg'],
          generation_prompt: 'Refine the source image',
        },
        stepKey: 'image',
      },
    });

    const response = serializeRunWithSteps(record) as SerializedRunResponse;
    const step = response.steps[0]!;

    expect(response.input.image_model_input).toEqual({
      generation_input_file: ['https://cdn.example.com/source.jpg'],
      generation_prompt: 'Refine the source image',
    });
    expect(step).not.toHaveProperty('generation_input_file');
  });

  it('keeps the test-3 base step fields with nullable timing fields', () => {
    const record = createRunWithSteps();

    const response = serializeRunWithSteps(record) as SerializedRunResponse;
    const step = response.steps[0]!;

    expect(response).not.toHaveProperty('output');
    expect(response).not.toHaveProperty('estimate');
    expect(response).not.toHaveProperty('error');
    expect(response.current_step_key).toBe('processing');
    expect(response).not.toHaveProperty('callback_status');
    expect(response).not.toHaveProperty('client_request_id');
    expect(response).not.toHaveProperty('completed_at');
    expect(response).not.toHaveProperty('metadata');
    expect(step.depends_on).toEqual([]);
    expect(step.started_at).toBeNull();
    expect(step.completed_at).toBeNull();
    expect(step).not.toHaveProperty('request_params');
    expect(step).not.toHaveProperty('output_files');
    expect(step).not.toHaveProperty('generation_input_file');
    expect(step).not.toHaveProperty('generation_output_file');
    expect(step).not.toHaveProperty('error');
  });

  it('keeps the same top-level lifecycle response shape as values arrive', () => {
    const queued = serializeRunWithSteps(
      createRunWithSteps({
        run: {
          estimate: {
            currency: 'credits',
            steps: [],
            total: 0,
          },
        },
      }),
    ) as SerializedRunResponse;
    const running = serializeRunWithSteps(
      createRunWithSteps({
        run: {
          currentStepKey: 'image',
          estimate: {
            currency: 'credits',
            steps: [],
            total: 0,
          },
          status: 'running',
        },
        step: {
          requestParams: { prompt: 'A product render' },
          startedAt: new Date().toISOString(),
          status: 'running',
        },
      }),
    ) as SerializedRunResponse;
    const succeeded = serializeRunWithSteps(
      createRunWithSteps({
        run: {
          completedAt: new Date().toISOString(),
          output: { final_step_key: 'image' },
          status: 'succeeded',
        },
        step: {
          completedAt: new Date().toISOString(),
          outputFiles: ['https://cdn.example.com/output.png'],
          requestParams: { prompt: 'A product render' },
          status: 'succeeded',
        },
      }),
    ) as SerializedRunResponse;

    expect(Object.keys(queued)).toEqual(Object.keys(running));
    expect(Object.keys(running)).toEqual(Object.keys(succeeded));
    expect(queued.current_step_key).toBe('processing');
    expect(running.current_step_key).toBe('image');
    expect(succeeded.current_step_key).toBe('completed');
    expect(queued.steps[0]).toMatchObject({
      started_at: null,
      completed_at: null,
    });
    expect(running.steps[0]).toMatchObject({
      started_at: expect.any(String),
      completed_at: null,
    });
    expect(succeeded.steps[0]).toMatchObject({
      completed_at: expect.any(String),
      generation_output_file: ['https://cdn.example.com/output.png'],
    });
  });

  it('adds actionable guidance to failed run and step errors', () => {
    const record = createRunWithSteps({
      run: {
        completedAt: new Date().toISOString(),
        errorCode: 'provider_unexpected_response',
        errorMessage: 'BytePlus image response contained no URLs.',
        status: 'failed',
      },
      step: {
        completedAt: new Date().toISOString(),
        errorCode: 'provider_unexpected_response',
        errorMessage: 'BytePlus image response contained no URLs.',
        status: 'failed',
      },
    });

    const response = serializeRunWithSteps(record) as SerializedRunResponse;

    expect(response.error).toMatchObject({
      code: 'provider_unexpected_response',
      guidance: {
        summary: 'The provider completed without a usable media URL.',
        what_to_try_next: expect.arrayContaining([
          'Retry with a simpler prompt or a model that is known to return URL media.',
        ]),
      },
    });
    expect(response.steps[0]!.error).toEqual(response.error);
    expect(response.timeline[0]!.error).toEqual(response.error);
  });

  it('groups multi-step selected models under input.chain_models', () => {
    const base = createRunWithSteps({
      run: {
        input: {
          image_model: 'bfl/flux-1.1-pro',
          video_model: 'bytedance/seedance-1-pro-fast',
          image_model_input: { prompt: 'A product render' },
          video_model_input: { duration: 2, ratio: '16:9' },
        },
      },
      step: {
        modelIdentifier: 'bfl/flux-1.1-pro',
        stepKey: 'image',
      },
    });
    const record: ChainRunWithSteps = {
      ...base,
      steps: [
        base.steps[0]!,
        {
          ...base.steps[0]!,
          dependsOn: ['image'],
          id: '7a53c981-fc9d-4d85-aab4-8363b5ee1a8c',
          modelIdentifier: 'bytedance/seedance-1-pro-fast',
          stepIndex: 1,
          stepKey: 'video',
          stepKind: 'video',
        },
      ],
    };

    const response = serializeRunWithSteps(record) as SerializedRunResponse;

    expect(Object.keys(response.input)).toEqual([
      'chain_models',
      'image_model_input',
      'video_model_input',
    ]);
    expect(response.input.chain_models).toEqual({
      image_model: 'bfl/flux-1.1-pro',
      video_model: 'bytedance/seedance-1-pro-fast',
    });
    expect(response.input).not.toHaveProperty('image_model');
    expect(response.input).not.toHaveProperty('video_model');
  });
});

type SerializedRunResponse = {
  current_step_key: string;
  error?: Record<string, unknown>;
  input: Record<string, unknown>;
  mode: string;
  steps: Array<Record<string, unknown>>;
  timeline: Array<Record<string, unknown>>;
};

function createRunWithSteps(
  overrides: {
    run?: Partial<ChainRunWithSteps['run']>;
    step?: Partial<ChainRunWithSteps['steps'][number]>;
  } = {},
): ChainRunWithSteps {
  const now = new Date().toISOString();

  return {
    run: {
      apiKeyId: null,
      apiKeyPrefix: 'bchn_alpha',
      callbackClaimedAt: null,
      callbackStatus: null,
      callbackUrl: null,
      chainSlug: 'chain',
      chainVersion: '2026-06-01',
      clientRequestId: null,
      completedAt: null,
      createdAt: now,
      currentStepKey: null,
      errorCode: null,
      errorMessage: null,
      estimate: null,
      id: 'af252a34-977d-4fc5-81ac-502d2fb94421',
      idempotencyKeyHash: null,
      input: {
        image_model: 'bytedance/seedream-4.5',
        image_model_input: {
          generation_prompt: 'A product render',
        },
        video_model_input: {
          generation_duration: 4,
        },
      },
      metadata: {},
      output: null,
      status: 'queued',
      updatedAt: now,
      byokCredentials: null,
      ...overrides.run,
    },
    steps: [
      {
        babyseaGenerationId: null,
        babyseaIdempotencyReplayed: null,
        babyseaPredictionId: null,
        babyseaRequestId: null,
        completedAt: null,
        createdAt: now,
        dependsOn: [],
        errorCode: null,
        errorMessage: null,
        id: '7a53c981-fc9d-4d85-aab4-8363b5ee1a8b',
        modelIdentifier: 'bytedance/seedream-4.5',
        outputFiles: [],
        providerMetadata: null,
        providerOrder: [],
        providerUsed: null,
        requestParams: null,
        runId: 'af252a34-977d-4fc5-81ac-502d2fb94421',
        startedAt: null,
        status: 'queued',
        stepIndex: 0,
        stepKey: 'image',
        stepKind: 'image',
        updatedAt: now,
        ...overrides.step,
      },
    ],
  };
}
