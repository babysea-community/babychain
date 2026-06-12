import 'server-only';

import type { LookupAddress } from 'node:dns';
import type { IncomingMessage } from 'node:http';
import { request as httpsRequest } from 'node:https';

import type {
  BabySea,
  EstimateData,
  Generation,
  GenerationParams,
  GenerationWebhookPayload,
} from 'babysea';

import { createBabySeaClient } from '@/lib/babysea';
import {
  getProvider,
  readByokRunConfig,
  resolveProvider,
  type ByokProviderName,
  type ByokRunConfig,
  type Provider,
  type ProviderName,
} from '@/lib/providers';
import { createBabySeaProvider } from '@/lib/providers/babysea';
import type { ProviderSubmitResult } from '@/lib/providers/types';
import { signJsonPayload } from '@/lib/security/crypto';
import { getEnv } from '@/lib/utils/env';
import { BabyChainError, toErrorMessage } from '@/lib/utils/errors';
import {
  isBlockedNetworkHostname,
  lookupAllowedNetworkAddress,
  normalizeHostname,
} from '@/lib/security/network-safety';

import {
  serializeCompletedRunOutput,
  serializeRunWithSteps,
} from './presenters';
import { BABYCHAIN_SDK_REQUEST_TIMEOUT_MS } from './shared-constants';
import { createChainStore, type ChainStore } from './store';
import {
  assertSafeGenerationParamsTargets,
  getChainTemplate,
  resolveStepModel,
} from './templates';
import type {
  ChainEstimate,
  ChainExecutionContext,
  ChainInput,
  ChainRunWithSteps,
  ChainStepOutput,
  ChainStepRecord,
  ChainStepTemplate,
  ChainTemplate,
  JsonObject,
} from './types';

const TERMINAL_RUN_STATUSES = new Set(['succeeded', 'failed', 'canceled']);
const CALLBACK_TIMEOUT_MS = 10_000;
const CALLBACK_RESPONSE_TEXT_LIMIT = 2_000;
const STARTING_STEP_STALE_MS = BABYCHAIN_SDK_REQUEST_TIMEOUT_MS + 60_000;
const TRANSIENT_PROVIDER_ERROR_CODES = new Set([
  'provider_network_error',
  'provider_rate_limited',
]);

export type RunnerDependencies = {
  babysea?: BabySea;
  store?: ChainStore;
};

export async function estimateChain(
  template: ChainTemplate,
  input: ChainInput,
  babysea?: BabySea,
  options: {
    byokMode?: boolean;
    byokProviders?: ByokProviderName[];
    steps?: ChainStepTemplate[];
  } = {},
): Promise<ChainEstimate> {
  const byokMode = options.byokMode ?? false;
  const steps = options.steps ?? template.steps;
  const estimates: EstimateData[] = [];
  const resolutions = steps.map((step) => ({
    step,
    modelIdentifier: resolveStepModel(step.model, input),
    resolution: resolveProvider(resolveStepModel(step.model, input), {
      byokMode,
    }),
  }));

  if (byokMode) {
    const incompatible = resolutions.find(
      (entry) => entry.resolution.provider === 'babysea',
    );

    if (incompatible) {
      throw new BabyChainError(
        'byok_credentials_missing',
        `Model "${incompatible.modelIdentifier}" routes to the BabySea SDK provider, which is not BYOK-compatible. Use an Alibaba Cloud, Black Forest Labs, BytePlus, Google, OpenAI, or Runway-backed model for BYOK mode.`,
        400,
      );
    }

    const configuredProviders = new Set(options.byokProviders ?? []);
    const missingProvider = resolutions
      .map((entry) => {
        const provider = entry.resolution.provider;

        return isByokProviderName(provider) ? { entry, provider } : null;
      })
      .find(
        (entry): entry is NonNullable<typeof entry> =>
          entry !== null && !configuredProviders.has(entry.provider),
      );

    if (missingProvider) {
      throw new BabyChainError(
        'byok_credentials_missing',
        `Model "${missingProvider.entry.modelIdentifier}" requires ${serverKeyNameForProvider(missingProvider.provider)} on the BabyChain server.`,
        400,
      );
    }
  }

  const needsBabySea = resolutions.some(
    (entry) => entry.resolution.provider === 'babysea',
  );
  const babyseaProvider = needsBabySea
    ? createBabySeaProvider(babysea ?? createBabySeaClient())
    : null;

  for (const { step, modelIdentifier, resolution } of resolutions) {
    const options = step.estimate(input);

    if (resolution.provider === 'babysea') {
      const estimate = await babyseaProvider!.estimate({
        modelIdentifier,
        stepKind: step.kind,
        options,
      });
      estimates.push(estimate);
    } else {
      // BYOK providers bill the caller's account — surface a zero cost.
      estimates.push({
        model_identifier: modelIdentifier,
        model_type: step.kind,
        assets_count: options.count ?? 1,
        cost_per_generation: 0,
        cost_total_consumed: 0,
        credit_balance: null,
        credit_balance_can_afford: null,
        credit_balance_max_affordable: null,
      });
    }
  }

  return {
    currency: 'credits',
    steps: steps.map((step, index) => ({
      cost_total_consumed: estimates[index]?.cost_total_consumed ?? null,
      model_identifier:
        estimates[index]?.model_identifier ??
        resolveStepModel(step.model, input),
      step_key: step.key,
    })),
    total: estimates.reduce(
      (sum, estimate) => sum + estimate.cost_total_consumed,
      0,
    ),
  };
}

export async function processRunById(
  runId: string,
  dependencies: RunnerDependencies = {},
) {
  const store = dependencies.store ?? createChainStore();
  const record = await store.getRunWithSteps(runId);

  if (!record) {
    throw new BabyChainError('run_not_found', 'Chain run was not found.', 404);
  }

  return processRun(record, { ...dependencies, store });
}

export async function processRun(
  initialRecord: ChainRunWithSteps,
  dependencies: RunnerDependencies = {},
) {
  const store = dependencies.store ?? createChainStore();
  let record = initialRecord;
  const byokConfig = readRunByokConfig(record);
  const providerOverrides = { babysea: dependencies.babysea };

  for (let attempt = 0; attempt < 10; attempt++) {
    if (TERMINAL_RUN_STATUSES.has(record.run.status)) {
      await deliverTerminalCallback(record, store);
      return record;
    }

    const template = getChainTemplate(record.run.chainSlug);

    if (!template || template.version !== record.run.chainVersion) {
      return failRun(
        record,
        store,
        'template_not_found',
        'Chain template is no longer available.',
      );
    }

    const runningStep = record.steps.find((step) => step.status === 'running');

    if (runningStep) {
      if (!runningStep.babyseaGenerationId) {
        if (isStartingStepStale(runningStep)) {
          const errorMessage =
            'BabySea generation did not return a generation id before the step start deadline.';

          const failedStep = await store.updateRunningStep(runningStep.id, {
            completedAt: new Date().toISOString(),
            errorCode: 'babysea_start_timed_out',
            errorMessage,
            status: 'failed',
          });

          if (!failedStep) {
            return mustGetRun(store, record.run.id);
          }

          record = await failRun(
            record,
            store,
            'babysea_start_timed_out',
            errorMessage,
          );
          continue;
        }

        return record;
      }

      await refreshStepFromProvider(
        runningStep,
        byokConfig,
        providerOverrides,
        store,
      );
      record = await mustGetRun(store, record.run.id);

      if (record.steps.some((step) => step.status === 'running')) {
        return record;
      }

      continue;
    }

    const failedStep = record.steps.find((step) => step.status === 'failed');

    if (failedStep) {
      record = await failRun(
        record,
        store,
        failedStep.errorCode ?? 'step_failed',
        failedStep.errorMessage ?? 'A chain step failed.',
      );
      continue;
    }

    const canceledStep = record.steps.find(
      (step) => step.status === 'canceled',
    );

    if (canceledStep) {
      record = await cancelRunRecord(record, store, 'step_canceled');
      continue;
    }

    if (record.steps.every((step) => step.status === 'succeeded')) {
      record = await completeRun(record, store);
      continue;
    }

    const readyStep = findReadyQueuedStep(record.steps);

    if (!readyStep) {
      return record;
    }

    await startStep(
      record,
      readyStep,
      template,
      byokConfig,
      providerOverrides,
      store,
    );
    return mustGetRun(store, record.run.id);
  }

  return mustGetRun(store, record.run.id);
}

export async function applyBabySeaWebhook(
  payload: GenerationWebhookPayload,
  dependencies: RunnerDependencies = {},
) {
  const store = dependencies.store ?? createChainStore();
  const step = await store.findStepByBabySeaGenerationId(
    payload.webhook_data.generation_id,
  );

  if (!step) {
    return null;
  }

  const currentRecord = await mustGetRun(store, step.runId);

  // Webhooks only originate from BabySea — ignore if the step has been routed
  // to a BYOK provider (defence-in-depth against generation-id collisions).
  if (
    resolveProvider(step.modelIdentifier, {
      byokMode: readRunByokConfig(currentRecord) !== null,
    }).provider !== 'babysea'
  ) {
    return null;
  }

  await applyGenerationStatus(step, generationFromWebhook(payload), store);

  const record = await mustGetRun(store, step.runId);
  return processRun(record, { ...dependencies, store });
}

export async function cancelRun(
  runId: string,
  dependencies: RunnerDependencies = {},
) {
  const store = dependencies.store ?? createChainStore();
  const record = await mustGetRun(store, runId);
  const byokConfig = readRunByokConfig(record);
  const providerOverrides = { babysea: dependencies.babysea };

  if (TERMINAL_RUN_STATUSES.has(record.run.status)) {
    return record;
  }

  const canceledRun = await store.updateActiveRun(runId, {
    completedAt: new Date().toISOString(),
    currentStepKey: null,
    errorCode: 'client_canceled',
    errorMessage: 'Chain run was canceled.',
    status: 'canceled',
  });

  if (!canceledRun) {
    return mustGetRun(store, runId);
  }

  const cancellations: Array<{
    generationId: string;
    modelIdentifier: string;
    providerMetadata: JsonObject | null;
  }> = [];

  for (const step of record.steps) {
    if (step.status === 'running') {
      const canceledStep = await store.updateRunningStep(step.id, {
        completedAt: new Date().toISOString(),
        status: 'canceled',
      });

      if (canceledStep && step.babyseaGenerationId) {
        cancellations.push({
          generationId: step.babyseaGenerationId,
          modelIdentifier: step.modelIdentifier,
          providerMetadata: step.providerMetadata,
        });
      }
    }

    if (step.status === 'queued') {
      await store.updateQueuedStep(step.id, {
        completedAt: new Date().toISOString(),
        status: 'skipped',
      });
    }
  }

  for (const cancellation of cancellations) {
    try {
      const resolution = resolveProvider(cancellation.modelIdentifier, {
        byokMode: byokConfig !== null,
      });
      const provider = getProvider(resolution, byokConfig, providerOverrides);
      await provider.cancel({
        generationId: cancellation.generationId,
        modelIdentifier: resolution.modelIdentifier,
        providerMetadata: cancellation.providerMetadata,
      });
    } catch {
      // The local run already moved to canceled; provider cancel is best-effort.
    }
  }

  const updated = await mustGetRun(store, runId);
  await deliverTerminalCallback(updated, store);
  await store.recordAuditEvent({
    action: 'run.canceled',
    apiKeyId: updated.run.apiKeyId,
    details: { reason: 'client_request' },
    runId,
  });

  return updated;
}

function findReadyQueuedStep(steps: ChainStepRecord[]) {
  return steps.find(
    (step) =>
      step.status === 'queued' &&
      step.dependsOn.every((dependency) =>
        steps.some(
          (candidate) =>
            candidate.stepKey === dependency &&
            candidate.status === 'succeeded',
        ),
      ),
  );
}

async function startStep(
  record: ChainRunWithSteps,
  step: ChainStepRecord,
  template: ChainTemplate,
  byokConfig: ByokRunConfig | null,
  providerOverrides: { babysea?: BabySea },
  store: ChainStore,
) {
  const stepTemplate = template.steps.find(
    (candidate) => candidate.key === step.stepKey,
  );

  if (!stepTemplate) {
    throw new BabyChainError(
      'step_template_not_found',
      'Step template was not found.',
      500,
    );
  }

  const context: ChainExecutionContext = {
    input: record.run.input,
    steps: toStepContext(record.steps),
  };
  let params: GenerationParams;
  const modelIdentifier = step.modelIdentifier;
  const resolution = resolveProvider(modelIdentifier, {
    byokMode: byokConfig !== null,
  });

  try {
    params = stepTemplate.buildParams(context);
    params = prepareStepParamsForProvider({
      input: context.input,
      params,
      providerName: resolution.provider,
      stepKey: step.stepKey,
    });
    await assertSafeGenerationParamsTargets(params);
  } catch (error) {
    const errorMessage = toErrorMessage(error);
    const failedStep = await store.updateQueuedStep(step.id, {
      completedAt: new Date().toISOString(),
      errorCode: 'chain_step_params_failed',
      errorMessage,
      status: 'failed',
    });

    if (failedStep) {
      await failRun(record, store, 'chain_step_params_failed', errorMessage);
    }

    return;
  }

  // Use the resolved (provider-prefixed raw) identifier when talking to the
  // adapter so BYOK endpoints receive the real provider model id, not the
  // BabySea-style display name persisted on the step record.
  const providerModelIdentifier = resolution.modelIdentifier;

  let provider: Provider;
  try {
    provider = getProvider(resolution, byokConfig, providerOverrides);
  } catch (error) {
    const errorMessage = toErrorMessage(error);
    const code =
      error instanceof BabyChainError
        ? error.code
        : 'provider_resolution_failed';
    const failedStep = await store.updateQueuedStep(step.id, {
      completedAt: new Date().toISOString(),
      errorCode: code,
      errorMessage,
      status: 'failed',
    });
    if (failedStep) {
      await failRun(record, store, code, errorMessage);
    }
    return;
  }

  const startedAt = new Date().toISOString();

  const claimedStep = await store.claimQueuedStep(step.id, {
    requestParams: toJsonObject(params),
    startedAt,
    status: 'running',
  });

  if (!claimedStep) {
    return;
  }

  const runningRun = await store.updateActiveRun(record.run.id, {
    currentStepKey: step.stepKey,
    status: 'running',
  });

  if (!runningRun) {
    await store.updateRunningStep(claimedStep.id, {
      completedAt: new Date().toISOString(),
      status: 'canceled',
    });
    return;
  }

  try {
    const result = await provider.submit({
      modelIdentifier: providerModelIdentifier,
      stepKind: stepTemplate.kind,
      params,
      idempotencyKey: createStepIdempotencyKey(record, claimedStep),
    });

    const updatedStep = await store.updateRunningStep(
      claimedStep.id,
      submitResultPatch(result, provider.name),
    );

    if (!updatedStep) {
      await cancelStartedGeneration(result, provider, providerModelIdentifier);
    }
  } catch (error) {
    const errorMessage = toErrorMessage(error);
    const code =
      error instanceof BabyChainError ? error.code : 'babysea_generate_failed';

    if (isTransientProviderErrorCode(code)) {
      const retryableStep = await store.updateRunningStep(claimedStep.id, {
        completedAt: null,
        errorCode: null,
        errorMessage: null,
        startedAt: null,
        status: 'queued',
      });

      if (!retryableStep) {
        return;
      }

      await store.updateActiveRun(record.run.id, {
        currentStepKey: null,
        errorCode: null,
        errorMessage: null,
        status: 'queued',
      });
      return;
    }

    const failedStep = await store.updateRunningStep(claimedStep.id, {
      completedAt: new Date().toISOString(),
      errorCode: code,
      errorMessage,
      status: 'failed',
    });

    if (!failedStep) {
      return;
    }

    await store.updateActiveRun(record.run.id, {
      completedAt: new Date().toISOString(),
      errorCode: code,
      errorMessage,
      status: 'failed',
    });
  }
}

async function cancelStartedGeneration(
  result: ProviderSubmitResult,
  provider: Provider,
  modelIdentifier: string,
) {
  if (result.kind === 'completed') {
    return;
  }
  try {
    await provider.cancel({
      generationId: result.generationId,
      modelIdentifier,
      providerMetadata: result.providerMetadata ?? null,
    });
  } catch {
    // Local cancellation already won; provider cancel is best-effort cleanup.
  }
}

async function refreshStepFromProvider(
  step: ChainStepRecord,
  byokConfig: ByokRunConfig | null,
  providerOverrides: { babysea?: BabySea },
  store: ChainStore,
) {
  if (!step.babyseaGenerationId) {
    return;
  }

  const resolution = resolveProvider(step.modelIdentifier, {
    byokMode: byokConfig !== null,
  });
  let provider: Provider;
  try {
    provider = getProvider(resolution, byokConfig, providerOverrides);
  } catch (error) {
    const errorMessage = toErrorMessage(error);
    const code =
      error instanceof BabyChainError
        ? error.code
        : 'provider_resolution_failed';
    await store.updateRunningStep(step.id, {
      completedAt: new Date().toISOString(),
      errorCode: code,
      errorMessage,
      status: 'failed',
    });
    return;
  }

  try {
    const status = await provider.poll({
      generationId: step.babyseaGenerationId,
      modelIdentifier: resolution.modelIdentifier,
      providerMetadata: step.providerMetadata,
    });
    await applyGenerationStatus(step, status, store);
  } catch (error) {
    const errorMessage = toErrorMessage(error);
    const code =
      error instanceof BabyChainError ? error.code : 'provider_poll_failed';
    // Transient poll failures must not flip the step to failed prematurely;
    // only persisted state moves on success. Caller (cron) retries next tick.
    if (isTransientProviderErrorCode(code)) {
      return;
    }
    await store.updateRunningStep(step.id, {
      completedAt: new Date().toISOString(),
      errorCode: code,
      errorMessage,
      status: 'failed',
    });
  }
}

export function prepareStepParamsForProvider({
  input,
  params,
  providerName,
  stepKey,
}: {
  input: ChainInput;
  params: GenerationParams;
  providerName: ProviderName;
  stepKey: string;
}): GenerationParams {
  if (providerName === 'babysea') {
    return params;
  }

  return {
    ...params,
    ...rawStepParamOverrides(input[`${stepKey}_model_input`]),
  } as GenerationParams;
}

function rawStepParamOverrides(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const credentialPath = findCredentialLikeParamPath(value);
  const providerControlledPath = findProviderControlledParamPath(value);

  if (credentialPath) {
    throw new BabyChainError(
      'invalid_chain_input',
      `Credential-like model input key is not allowed: ${credentialPath.join('.')}`,
      400,
      { path: credentialPath },
    );
  }

  if (providerControlledPath) {
    throw new BabyChainError(
      'invalid_chain_input',
      `Provider-controlled model input key is not allowed: ${providerControlledPath.join('.')}`,
      400,
      { path: providerControlledPath },
    );
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      ([, entryValue]) => entryValue !== undefined,
    ),
  );
}

function serverKeyNameForProvider(provider: ByokProviderName) {
  switch (provider) {
    case 'alibabacloud':
      return 'DASHSCOPE_API_KEY';
    case 'bfl':
      return 'BFL_API_KEY';
    case 'byteplus':
      return 'ARK_API_KEY';
    case 'google':
      return 'GEMINI_API_KEY or GOOGLE_API_KEY';
    case 'openai':
      return 'OPENAI_API_KEY';
    case 'runway':
      return 'RUNWAYML_API_SECRET';
    default: {
      const exhaustive: never = provider;
      return exhaustive;
    }
  }
}

function findCredentialLikeParamPath(
  value: unknown,
  currentPath: (string | number)[] = [],
): (string | number)[] | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const nested = findCredentialLikeParamPath(value[index], [
        ...currentPath,
        index,
      ]);
      if (nested) {
        return nested;
      }
    }
    return null;
  }

  for (const [key, nestedValue] of Object.entries(
    value as Record<string, unknown>,
  )) {
    if (isCredentialLikeKey(key)) {
      return [...currentPath, key];
    }

    const nested = findCredentialLikeParamPath(nestedValue, [
      ...currentPath,
      key,
    ]);
    if (nested) {
      return nested;
    }
  }

  return null;
}

function isCredentialLikeKey(key: string) {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');

  if (normalized.startsWith('xbabychainprovider')) {
    return true;
  }

  return (
    [
      'apikey',
      'authorization',
      'authtoken',
      'accesstoken',
      'bearertoken',
      'dashscopeapikey',
      'secret',
      'secretkey',
      'accesskeyid',
      'accesskeysecret',
      'token',
      'xapikey',
      'xkey',
    ].includes(normalized) ||
    normalized.endsWith('apikey') ||
    normalized.endsWith('secretkey') ||
    normalized.endsWith('accesskeysecret')
  );
}

function findProviderControlledParamPath(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  for (const key of Object.keys(value as Record<string, unknown>)) {
    if (isProviderControlledStepParamKey(key)) {
      return [key];
    }
  }

  return null;
}

function isProviderControlledStepParamKey(key: string) {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');

  return (
    normalized === 'callbackurl' ||
    normalized === 'generationcallbackurl' ||
    normalized === 'generationmodel' ||
    normalized === 'model'
  );
}

async function applyGenerationStatus(
  step: ChainStepRecord,
  generation: Partial<Generation> & { provider_metadata?: JsonObject },
  store: ChainStore,
  metadata: { requestId?: string } = {},
) {
  const status = generation.generation_status;
  const providerOrder =
    generation.generation_provider_order ?? step.providerOrder;
  const outputFiles = generation.generation_output_file ?? step.outputFiles;
  const completedAt =
    generation.generation_completed_at ?? new Date().toISOString();
  const mergedProviderMetadata = mergeProviderMetadata(
    step.providerMetadata,
    generation.provider_metadata,
  );
  const requestId =
    metadata.requestId ??
    requestIdFromProviderMetadata(generation.provider_metadata) ??
    step.babyseaRequestId;
  const predictionId =
    typeof generation.generation_prediction_id === 'string' &&
    generation.generation_prediction_id.length > 0
      ? generation.generation_prediction_id
      : step.babyseaPredictionId;

  if (status === 'succeeded') {
    await store.updateRunningStep(step.id, {
      completedAt,
      babyseaPredictionId: predictionId,
      babyseaRequestId: requestId,
      outputFiles,
      providerMetadata: mergedProviderMetadata,
      providerOrder,
      providerUsed: generation.generation_provider_used ?? step.providerUsed,
      status: 'succeeded',
    });
    return;
  }

  if (status === 'failed') {
    await store.updateRunningStep(step.id, {
      completedAt,
      babyseaPredictionId: predictionId,
      babyseaRequestId: requestId,
      errorCode: generation.generation_error_code ?? 'generation_failed',
      errorMessage:
        generation.generation_error ?? 'Provider generation failed.',
      providerMetadata: mergedProviderMetadata,
      providerOrder,
      providerUsed: generation.generation_provider_used ?? step.providerUsed,
      status: 'failed',
    });
    return;
  }

  if (status === 'canceled') {
    await store.updateRunningStep(step.id, {
      completedAt,
      babyseaPredictionId: predictionId,
      babyseaRequestId: requestId,
      providerMetadata: mergedProviderMetadata,
      providerOrder,
      providerUsed: generation.generation_provider_used ?? step.providerUsed,
      status: 'canceled',
    });
    return;
  }

  await store.updateRunningStep(step.id, {
    providerMetadata: mergedProviderMetadata,
    providerOrder,
    providerUsed: generation.generation_provider_used ?? step.providerUsed,
    babyseaPredictionId: predictionId,
    babyseaRequestId: requestId,
    status: 'running',
  });
}

async function completeRun(record: ChainRunWithSteps, store: ChainStore) {
  const output = serializeCompletedRunOutput(record);

  await store.updateActiveRun(record.run.id, {
    completedAt: new Date().toISOString(),
    currentStepKey: null,
    output,
    status: 'succeeded',
  });

  const updated = await mustGetRun(store, record.run.id);
  await deliverTerminalCallback(updated, store);
  return updated;
}

async function failRun(
  record: ChainRunWithSteps,
  store: ChainStore,
  code: string,
  message: string,
) {
  await store.updateActiveRun(record.run.id, {
    completedAt: new Date().toISOString(),
    currentStepKey: null,
    errorCode: code,
    errorMessage: message,
    status: 'failed',
  });

  // Downstream queued steps can never start once the run has failed (their
  // input will never arrive) — mark them skipped immediately instead of
  // leaving them queued forever.
  for (const step of record.steps) {
    if (step.status === 'queued') {
      await store.updateQueuedStep(step.id, {
        completedAt: new Date().toISOString(),
        status: 'skipped',
      });
    }
  }

  const updated = await mustGetRun(store, record.run.id);
  await deliverTerminalCallback(updated, store);
  return updated;
}

async function cancelRunRecord(
  record: ChainRunWithSteps,
  store: ChainStore,
  reason: string,
) {
  await store.updateActiveRun(record.run.id, {
    completedAt: new Date().toISOString(),
    currentStepKey: null,
    errorCode: reason,
    errorMessage: 'Chain run was canceled.',
    status: 'canceled',
  });

  const updated = await mustGetRun(store, record.run.id);
  await deliverTerminalCallback(updated, store);
  return updated;
}

async function deliverTerminalCallback(
  record: ChainRunWithSteps,
  store: ChainStore,
) {
  if (!record.run.callbackUrl || record.run.callbackStatus === 'delivered') {
    return;
  }

  const claimed = await store.claimCallbackDelivery(record.run.id);

  if (!claimed) {
    return;
  }

  const env = getEnv();
  const body = JSON.stringify(serializeRunWithSteps(record));
  const headers: Record<string, string> = {
    'Content-Length': String(Buffer.byteLength(body)),
    'Content-Type': 'application/json',
    'User-Agent': 'BabyChain/0.1',
    'X-BabyChain-Event': 'chain_run.completed',
  };

  if (env.BABYCHAIN_CALLBACK_SECRET) {
    headers['X-BabyChain-Signature'] = signJsonPayload(
      env.BABYCHAIN_CALLBACK_SECRET,
      body,
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CALLBACK_TIMEOUT_MS);

  try {
    const response = await postCallback(record.run.callbackUrl, {
      body,
      headers,
      signal: controller.signal,
    });
    const status = response.ok ? 'delivered' : 'failed';

    await store.recordCallbackDelivery({
      responseText: response.text,
      runId: record.run.id,
      status,
      statusCode: response.status,
    });
    await store.updateRun(record.run.id, {
      callbackClaimedAt: null,
      callbackStatus: status,
    });
  } catch (error) {
    await store.recordCallbackDelivery({
      responseText: toErrorMessage(error),
      runId: record.run.id,
      status: 'failed',
      statusCode: null,
    });
    await store.updateRun(record.run.id, {
      callbackClaimedAt: null,
      callbackStatus: 'failed',
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function postCallback(
  url: string,
  init: {
    body: string;
    headers: Record<string, string>;
    signal: AbortSignal;
  },
) {
  assertSafeCallbackUrl(url);

  return new Promise<{
    ok: boolean;
    status: number | null;
    text: string;
  }>((resolve, reject) => {
    const request = httpsRequest(
      url,
      {
        headers: init.headers,
        lookup: (hostname, options, callback) => {
          void lookupSafeCallbackAddress(hostname)
            .then((address) => {
              if (typeof options === 'object' && options.all) {
                const allCallback = callback as unknown as (
                  error: NodeJS.ErrnoException | null,
                  addresses: LookupAddress[],
                ) => void;

                allCallback(null, [address]);
                return;
              }

              callback(null, address.address, address.family);
            })
            .catch((error: unknown) => callback(toLookupError(error), '', 0));
        },
        method: 'POST',
        signal: init.signal,
      },
      (response) => {
        void readCallbackResponseText(response)
          .then((text) => {
            const status = response.statusCode ?? null;

            resolve({
              ok: status !== null && status >= 200 && status < 300,
              status,
              text,
            });
          })
          .catch(reject);
      },
    );

    request.on('error', reject);
    request.end(init.body);
  });
}

async function lookupSafeCallbackAddress(hostname: string) {
  const address = await lookupAllowedNetworkAddress(
    normalizeHostname(hostname),
  );

  if (!address) {
    throw new BabyChainError(
      'invalid_callback_url',
      'Callback URL host resolves to a blocked address.',
      400,
    );
  }

  return address;
}

function readCallbackResponseText(response: IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    let responseText = '';

    response.setEncoding('utf8');
    response.on('data', (chunk: string) => {
      const remaining = CALLBACK_RESPONSE_TEXT_LIMIT - responseText.length;

      if (remaining > 0) {
        responseText += chunk.slice(0, remaining);
      }
    });
    response.on('end', () => resolve(responseText));
    response.on('error', reject);
  });
}

function toLookupError(error: unknown) {
  return error instanceof Error ? error : new Error(toErrorMessage(error));
}

function requestIdFromProviderMetadata(
  providerMetadata: JsonObject | null | undefined,
) {
  const requestId = providerMetadata?.request_id;

  return typeof requestId === 'string' && requestId.length > 0
    ? requestId
    : null;
}

function submitResultPatch(result: ProviderSubmitResult, providerName: string) {
  if (result.kind === 'completed') {
    return {
      babyseaGenerationId: result.generationId,
      babyseaIdempotencyReplayed: false,
      babyseaPredictionId: null,
      babyseaRequestId: requestIdFromProviderMetadata(result.providerMetadata),
      completedAt: new Date().toISOString(),
      outputFiles: result.outputFiles,
      providerMetadata: result.providerMetadata ?? null,
      providerOrder: result.providerOrder,
      providerUsed: result.providerUsed,
      status: 'succeeded' as const,
    };
  }

  const idempotencyReplayed =
    result.providerMetadata &&
    typeof result.providerMetadata.idempotency_replayed === 'boolean'
      ? (result.providerMetadata.idempotency_replayed as boolean)
      : false;

  return {
    babyseaGenerationId: result.generationId,
    babyseaIdempotencyReplayed: idempotencyReplayed,
    babyseaPredictionId: result.predictionId ?? null,
    babyseaRequestId: requestIdFromProviderMetadata(result.providerMetadata),
    providerMetadata: result.providerMetadata ?? null,
    providerOrder: result.providerOrder,
    providerUsed: providerName === 'babysea' ? null : providerName,
    status: 'running' as const,
  };
}

function mergeProviderMetadata(
  existing: JsonObject | null,
  incoming: JsonObject | undefined,
): JsonObject | null {
  if (!incoming) {
    return existing;
  }
  return { ...(existing ?? {}), ...incoming };
}

function readRunByokConfig(record: ChainRunWithSteps): ByokRunConfig | null {
  return readByokRunConfig(record.run.byokCredentials);
}

function isByokProviderName(
  provider: ProviderName,
): provider is ByokProviderName {
  return provider !== 'babysea';
}

function isTransientProviderErrorCode(code: string) {
  return TRANSIENT_PROVIDER_ERROR_CODES.has(code);
}

function generationFromWebhook(
  payload: GenerationWebhookPayload,
): Partial<Generation> {
  return {
    generation_completed_at:
      payload.webhook_data.generation_status === 'processing'
        ? null
        : payload.webhook_timestamp,
    generation_error: payload.webhook_data.generation_error,
    generation_error_code: payload.webhook_data.generation_error_code,
    generation_id: payload.webhook_data.generation_id,
    generation_output_file: payload.webhook_data.generation_output_file,
    generation_prediction_id: payload.webhook_data.generation_prediction_id,
    generation_provider_used: payload.webhook_data.generation_provider_used,
    generation_status: payload.webhook_data.generation_status,
  };
}

async function mustGetRun(store: ChainStore, runId: string) {
  const record = await store.getRunWithSteps(runId);

  if (!record) {
    throw new BabyChainError('run_not_found', 'Chain run was not found.', 404);
  }

  return record;
}

function isStartingStepStale(step: ChainStepRecord) {
  if (!step.startedAt) {
    return true;
  }

  const startedAtMs = Date.parse(step.startedAt);

  if (!Number.isFinite(startedAtMs)) {
    return true;
  }

  return Date.now() - startedAtMs > STARTING_STEP_STALE_MS;
}

function toStepContext(steps: ChainStepRecord[]) {
  const entries = steps
    .filter((step) => step.status === 'succeeded')
    .map(
      (step) =>
        [
          step.stepKey,
          {
            generationId: step.babyseaGenerationId ?? '',
            modelIdentifier: step.modelIdentifier,
            outputFiles: step.outputFiles,
            predictionId: step.babyseaPredictionId,
            providerOrder: step.providerOrder,
            providerUsed: step.providerUsed,
            status: 'succeeded',
          } satisfies ChainStepOutput,
        ] as const,
    );

  return Object.fromEntries(entries);
}

function toJsonObject(params: Record<string, unknown>) {
  return params as JsonObject;
}

function createStepIdempotencyKey(
  record: ChainRunWithSteps,
  step: ChainStepRecord,
) {
  return `babychain:${record.run.id}:${step.stepKey}:${record.run.chainVersion}`;
}

export function assertSafeCallbackUrl(url: string) {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    throw new BabyChainError(
      'invalid_callback_url',
      'Callback URL must be a valid URL.',
      400,
    );
  }

  if (parsed.protocol !== 'https:') {
    throw new BabyChainError(
      'invalid_callback_url',
      'Callback URL must use HTTPS.',
      400,
    );
  }

  if (parsed.username || parsed.password) {
    throw new BabyChainError(
      'invalid_callback_url',
      'Callback URL must not include credentials.',
      400,
    );
  }

  if (isBlockedNetworkHostname(parsed.hostname)) {
    throw new BabyChainError(
      'invalid_callback_url',
      'Callback URL host is not allowed.',
      400,
    );
  }
}
