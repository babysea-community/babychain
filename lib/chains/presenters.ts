import { getErrorGuidance } from '@/lib/utils/error-guidance';

import type { ChainRunWithSteps, JsonObject } from './types';

/**
 * Discriminator describing how the run was executed.
 *
 * - `babysea`: BabySea-managed inference (credits, failover, callbacks).
 * - `byok`: server-side provider env keys are used for direct providers;
 *   BabySea-only fields are stripped from the response.
 */
export type RunResponseMode = 'babysea' | 'byok';

/**
 * Field grouping per mode:
 *
 * - **general**: present in BOTH modes. The minimal portable contract.
 * - **babysea-only**: present only when `mode === 'babysea'`. These describe
 *   BabySea-managed concerns (failover routing, SDK identifiers, request ids).
 * - **byok-only**: present only when `mode === 'byok'`. These describe the
 *   direct provider task using provider-neutral names instead of `babysea_*`.
 */

type Step = ChainRunWithSteps['steps'][number];

export function getRunResponseMode(record: ChainRunWithSteps): RunResponseMode {
  const configMode = record.run.byokCredentials?.mode;

  return configMode === 'server_env' ? 'byok' : 'babysea';
}

function serializeStepGeneral(step: Step, mode: RunResponseMode) {
  const serialized: JsonObject = {
    id: step.id,
    step_index: step.stepIndex,
    step_key: step.stepKey,
    step_kind: step.stepKind,
    model_identifier: step.modelIdentifier,
    status: step.status,
    created_at: step.createdAt,
    updated_at: step.updatedAt,
    depends_on: step.dependsOn,
    started_at: step.startedAt,
    completed_at: step.completedAt,
  };

  const generationInputFile = getGenerationInputFile(step, mode);

  if (generationInputFile) {
    serialized.generation_input_file = generationInputFile;
  }

  if (step.outputFiles.length > 0) {
    serialized.generation_output_file = step.outputFiles;
  }

  if (step.errorCode) {
    serialized.error = serializePublicError(
      step.errorCode,
      step.errorMessage ?? 'A chain step failed.',
    );
  }

  return serialized;
}

function serializeStepBabyseaOnly(step: Step): JsonObject {
  const babysea: JsonObject = {};

  if (step.providerOrder.length > 0) {
    babysea.provider_order = step.providerOrder;
  }

  if (step.providerUsed) {
    babysea.provider_used = step.providerUsed;
  }

  if (step.babyseaGenerationId) {
    babysea.babysea_generation_id = step.babyseaGenerationId;
  }

  if (step.babyseaPredictionId) {
    babysea.babysea_prediction_id = step.babyseaPredictionId;
  }

  if (step.babyseaRequestId) {
    babysea.babysea_request_id = step.babyseaRequestId;
  }

  if (step.babyseaIdempotencyReplayed !== null) {
    babysea.babysea_idempotency_replayed = step.babyseaIdempotencyReplayed;
  }

  return babysea;
}

function serializeStepByokOnly(step: Step): JsonObject {
  const byok: JsonObject = {};
  const providerMetadata = serializeSafeByokProviderMetadata(
    step.providerMetadata,
  );

  if (providerMetadata) {
    byok.provider_metadata = providerMetadata;
  }

  return byok;
}

function serializeSafeByokProviderMetadata(metadata: JsonObject | null) {
  if (!metadata) {
    return null;
  }

  const safeMetadata: JsonObject = {};

  for (const key of ['last_frame_url', 'output_expires_at'] as const) {
    const value = metadata[key];

    if (typeof value === 'string' && value.length > 0) {
      safeMetadata[key] = value;
    }
  }

  return Object.keys(safeMetadata).length > 0 ? safeMetadata : null;
}

function serializeStep(step: Step, mode: RunResponseMode) {
  const general = serializeStepGeneral(step, mode);
  if (mode === 'byok') {
    return { ...general, ...serializeStepByokOnly(step) };
  }
  return { ...general, ...serializeStepBabyseaOnly(step) };
}

export function serializeRunTimeline(record: ChainRunWithSteps): JsonObject[] {
  return record.steps.map((step) => {
    const event: JsonObject = {
      object: 'chain_run_timeline_event',
      step_index: step.stepIndex,
      step_key: step.stepKey,
      step_kind: step.stepKind,
      model_identifier: step.modelIdentifier,
      status: step.status,
      depends_on: step.dependsOn,
      created_at: step.createdAt,
      updated_at: step.updatedAt,
    };

    if (step.startedAt) {
      event.started_at = step.startedAt;
    }

    if (step.completedAt) {
      event.completed_at = step.completedAt;
    }

    const durationMs = stepDurationMs(step);
    if (durationMs !== null) {
      event.duration_ms = durationMs;
    }

    if (step.providerUsed) {
      event.provider_used = step.providerUsed;
    }

    if (step.outputFiles.length > 0) {
      event.output_files_count = step.outputFiles.length;
    }

    if (step.errorCode) {
      event.error = serializePublicError(
        step.errorCode,
        step.errorMessage ?? 'A chain step failed.',
      );
    }

    return event;
  });
}

function stepDurationMs(step: Step) {
  if (!step.startedAt || !step.completedAt) {
    return null;
  }

  const startedAt = Date.parse(step.startedAt);
  const completedAt = Date.parse(step.completedAt);

  if (!Number.isFinite(startedAt) || !Number.isFinite(completedAt)) {
    return null;
  }

  return Math.max(0, completedAt - startedAt);
}

export function serializeCompletedRunOutput(
  record: ChainRunWithSteps,
  mode: RunResponseMode = getRunResponseMode(record),
): JsonObject {
  void mode;
  const finalStep = [...record.steps]
    .reverse()
    .find((step) => step.status === 'succeeded');
  const output: JsonObject = {};

  if (finalStep) {
    output.final_step_key = finalStep.stepKey;

    if (finalStep.outputFiles.length > 0) {
      output.output_files = finalStep.outputFiles;
    }
  }

  return output;
}

function serializeRequestParams(step: Step, mode: RunResponseMode) {
  if (!step.requestParams) {
    return null;
  }

  if (mode === 'babysea') {
    return step.requestParams;
  }

  const sanitized = Object.fromEntries(
    Object.entries(step.requestParams).filter(
      ([key]) => !isProviderRoutingRequestParam(key),
    ),
  ) as JsonObject;

  return Object.keys(sanitized).length > 0 ? sanitized : null;
}

function isProviderRoutingRequestParam(key: string) {
  return (
    key === 'provider_order' ||
    key === 'provider_used' ||
    key === 'generation_provider_order' ||
    key === 'generation_provider_used' ||
    isHiddenByokGenerationParam(key) ||
    key.startsWith('babysea_') ||
    key.startsWith('provider_')
  );
}

function isHiddenByokGenerationParam(key: string) {
  return (
    key.startsWith('generation_') &&
    key !== 'generation_input_file' &&
    key !== 'generation_output_file'
  );
}

function getGenerationInputFile(step: Step, mode: RunResponseMode) {
  if (step.dependsOn.length === 0) {
    return null;
  }

  const requestParams = serializeRequestParams(step, mode);
  const inputFile = requestParams?.generation_input_file;

  return Array.isArray(inputFile) ? inputFile : null;
}

function serializeRunInput(record: ChainRunWithSteps): JsonObject {
  const modelInputKeys = new Set(
    record.steps.map((step) => `${step.stepKey}_model`),
  );
  const chainModels = Object.fromEntries(
    record.steps.map((step) => [`${step.stepKey}_model`, step.modelIdentifier]),
  ) as JsonObject;
  const input: JsonObject = {
    chain_models: chainModels,
  };

  for (const [key, value] of Object.entries(record.run.input)) {
    if (key === 'chain_models' || modelInputKeys.has(key)) {
      continue;
    }

    input[key] = value as JsonObject[string];
  }

  return input;
}

function serializeCurrentStepKey(record: ChainRunWithSteps) {
  if (record.run.status === 'succeeded') {
    return 'completed';
  }

  if (record.run.status === 'failed') {
    return 'failed';
  }

  if (record.run.status === 'canceled') {
    return 'canceled';
  }

  return record.run.currentStepKey ?? 'processing';
}

export function serializeRunWithSteps(record: ChainRunWithSteps) {
  const mode = getRunResponseMode(record);

  const response: Record<string, unknown> = {
    id: record.run.id,
    object: 'chain_run',
    chain_slug: record.run.chainSlug,
    chain_version: record.run.chainVersion,
    mode,
    status: record.run.status,
    input: serializeRunInput(record),
    created_at: record.run.createdAt,
    updated_at: record.run.updatedAt,
    current_step_key: serializeCurrentStepKey(record),
  };

  if (record.run.errorCode) {
    response.error = serializePublicError(
      record.run.errorCode,
      record.run.errorMessage ?? 'Chain run failed.',
    );
  }

  if (Object.keys(record.run.metadata).length > 0) {
    response.metadata = record.run.metadata;
  }

  if (record.run.clientRequestId) {
    response.client_request_id = record.run.clientRequestId;
  }

  response.steps = record.steps.map((step) => serializeStep(step, mode));
  response.timeline = serializeRunTimeline(record);

  return response;
}

function serializePublicError(code: string, message: string): JsonObject {
  const error: JsonObject = { code, message };
  const guidance = getErrorGuidance({ code, message });

  if (guidance) {
    error.guidance = guidance as unknown as JsonObject;
  }

  return error;
}
