import 'server-only';

import { lookupAllowedNetworkAddress } from '@/lib/security/network-safety';
import type { JsonObject } from '@/lib/chains/types';
import { BabyChainError } from '@/lib/utils/errors';

import type {
  Provider,
  ProviderCancelContext,
  ProviderEstimateInput,
  ProviderEstimateResult,
  ProviderGenerationStatus,
  ProviderPollContext,
  ProviderSubmitInput,
  ProviderSubmitResult,
} from './types';

/**
 * BytePlus ModelArk — direct BYOK adapter.
 *
 * Surface
 * -------
 * BytePlus exposes both a synchronous image-generation endpoint and an
 * asynchronous task endpoint for video. BabyChain selects per `stepKind`:
 *
 *   - image  : `POST /api/v3/images/generations`  (synchronous)
 *   - video  : `POST /api/v3/contents/generations/tasks`  (async)
 *              `GET  /api/v3/contents/generations/tasks/{id}`
 *              `DELETE /api/v3/contents/generations/tasks/{id}`
 *
 * Auth uses `Authorization: Bearer <api_key>`.
 *
 * Caveats
 * -------
 *   - DELETE returns an error while the task is `running`. We swallow these
 *     errors so the runner's "best-effort cancel" semantics hold.
 *   - BytePlus does not expose a cost-estimation API; estimates report
 *     `cost_total_consumed: 0` (BYOK billing flows through the caller's
 *     BytePlus account, not BabyChain credits).
 */
type BytePlusRegion = 'ap-southeast';

export type BytePlusProviderConfig = {
  apiKey: string;
  fetchImpl?: typeof fetch;
};

const BYTEPLUS_REGION: BytePlusRegion = 'ap-southeast';
const BYTEPLUS_HOSTS: Record<BytePlusRegion, string> = {
  'ap-southeast': 'ark.ap-southeast.bytepluses.com',
};

const SUBMIT_TIMEOUT_MS = 60_000;
const POLL_TIMEOUT_MS = 10_000;

export function createBytePlusProvider(
  config: BytePlusProviderConfig,
): Provider {
  const region = BYTEPLUS_REGION;
  const host = BYTEPLUS_HOSTS[region];
  const fetchImpl = config.fetchImpl ?? fetch;
  const baseUrl = `https://${host}`;

  return {
    name: 'byteplus',

    async estimate(
      input: ProviderEstimateInput,
    ): Promise<ProviderEstimateResult> {
      return {
        model_identifier: input.modelIdentifier,
        model_type: input.stepKind,
        assets_count: input.options.count ?? 1,
        cost_per_generation: 0,
        cost_total_consumed: 0,
        credit_balance: null,
        credit_balance_can_afford: null,
        credit_balance_max_affordable: null,
      };
    },

    async submit(input: ProviderSubmitInput): Promise<ProviderSubmitResult> {
      const model = stripPrefix(input.modelIdentifier, 'byteplus/');
      assertModelId(model);

      if (input.stepKind === 'image') {
        return submitImage({
          baseUrl,
          apiKey: config.apiKey,
          fetchImpl,
          model,
          params: input.params as Record<string, unknown>,
          idempotencyKey: input.idempotencyKey,
          region,
        });
      }

      return submitVideoTask({
        baseUrl,
        apiKey: config.apiKey,
        fetchImpl,
        model,
        params: input.params as Record<string, unknown>,
        idempotencyKey: input.idempotencyKey,
        region,
      });
    },

    async poll(
      context: ProviderPollContext,
    ): Promise<ProviderGenerationStatus> {
      const metadata = context.providerMetadata ?? {};

      if (metadata.kind === 'sync_image') {
        const outputs = Array.isArray(metadata.output_files)
          ? (metadata.output_files as unknown[]).filter(
              (item): item is string => typeof item === 'string',
            )
          : [];

        return {
          generation_id: context.generationId,
          generation_status: 'succeeded',
          generation_provider_used: 'byteplus',
          generation_output_file: outputs,
          generation_completed_at:
            (metadata.completed_at as string | undefined) ?? null,
          provider_metadata: metadata,
        };
      }

      const taskId =
        typeof metadata.task_id === 'string'
          ? metadata.task_id
          : context.generationId;

      const url = `${baseUrl}/api/v3/contents/generations/tasks/${encodeURIComponent(taskId)}`;
      const response = await fetchWithGuards(fetchImpl, url, {
        method: 'GET',
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${config.apiKey}`,
        },
        signal: AbortSignal.timeout(POLL_TIMEOUT_MS),
      });
      const payload = (await response.json()) as BytePlusTaskResponse;

      return mapTaskResponseToStatus({
        payload,
        generationId: context.generationId,
        metadata,
      });
    },

    async cancel(context: ProviderCancelContext): Promise<void> {
      const metadata = context.providerMetadata ?? {};

      if (metadata.kind === 'sync_image') {
        return;
      }

      const taskId =
        typeof metadata.task_id === 'string'
          ? metadata.task_id
          : context.generationId;
      const url = `${baseUrl}/api/v3/contents/generations/tasks/${encodeURIComponent(taskId)}`;

      try {
        await fetchWithGuards(fetchImpl, url, {
          method: 'DELETE',
          headers: {
            authorization: `Bearer ${config.apiKey}`,
          },
          signal: AbortSignal.timeout(POLL_TIMEOUT_MS),
        });
      } catch (error) {
        // BytePlus rejects DELETE while the task is running — runner falls back
        // to local cancellation, mirroring the BabySea-default behaviour.
        if (
          !(error instanceof BabyChainError) ||
          (error.code !== 'provider_invalid_request' &&
            error.code !== 'provider_not_found')
        ) {
          throw error;
        }
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Submit paths
// ---------------------------------------------------------------------------

type BytePlusContext = {
  baseUrl: string;
  apiKey: string;
  fetchImpl: typeof fetch;
  model: string;
  params: Record<string, unknown>;
  idempotencyKey: string;
  region: BytePlusRegion;
};

async function submitImage(
  ctx: BytePlusContext,
): Promise<ProviderSubmitResult> {
  const body: JsonObject = { model: ctx.model };

  for (const [rawKey, value] of Object.entries(ctx.params)) {
    if (value === undefined) continue;
    if (isProviderControlledBodyKey(rawKey)) continue;
    if (rawKey === 'generation_prompt') {
      body.prompt = value as never;
      continue;
    }
    if (rawKey === 'generation_ratio') {
      body.size = mapAspectToSize(value) as never;
      continue;
    }
    if (rawKey === 'generation_input_file' && Array.isArray(value)) {
      const urls = (value as unknown[]).filter(
        (item): item is string => typeof item === 'string' && item.length > 0,
      );
      if (urls.length === 1) {
        body.image = urls[0] as never;
      } else if (urls.length > 1) {
        body.image = urls as never;
      }
      continue;
    }
    if (
      rawKey === 'generation_output_number' ||
      rawKey === 'generation_provider_order'
    ) {
      continue;
    }
    if (rawKey.startsWith('generation_')) {
      const providerKey = rawKey.slice('generation_'.length);
      body[providerKey] =
        providerKey === 'output_format'
          ? (normalizeProviderOutputFormat(value) as never)
          : (value as never);
      continue;
    }
    body[rawKey] =
      rawKey === 'output_format'
        ? (normalizeProviderOutputFormat(value) as never)
        : (value as never);
  }

  if (body.response_format === undefined) {
    body.response_format = 'url';
  } else if (body.response_format !== 'url') {
    throw new BabyChainError(
      'invalid_provider_params',
      'BytePlus image response_format must be "url" because BabyChain image steps return output_files URLs.',
      400,
    );
  }

  const url = `${ctx.baseUrl}/api/v3/images/generations`;
  const response = await fetchWithGuards(ctx.fetchImpl, url, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      authorization: `Bearer ${ctx.apiKey}`,
      'x-idempotency-key': ctx.idempotencyKey,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(SUBMIT_TIMEOUT_MS),
  });

  const payload = (await response.json()) as {
    data?: Array<{ url?: string; b64_json?: string }>;
    created?: number;
    model?: string;
  };

  const outputs = (payload.data ?? [])
    .map((item) => item?.url)
    .flatMap((value) => {
      if (typeof value !== 'string') return [];
      const outputUrl = value.trim();
      return outputUrl.length > 0 ? [outputUrl] : [];
    });

  if (outputs.length === 0) {
    throw new BabyChainError(
      'provider_unexpected_response',
      'BytePlus image response contained no URLs.',
      502,
    );
  }

  const completedAt = new Date().toISOString();
  const syntheticId = `byteplus_img_${ctx.idempotencyKey}`;

  return {
    kind: 'completed',
    generationId: syntheticId,
    providerOrder: ['byteplus'],
    providerUsed: 'byteplus',
    outputFiles: outputs,
    providerMetadata: {
      provider: 'byteplus',
      region: ctx.region,
      model: ctx.model,
      kind: 'sync_image',
      output_files: outputs,
      completed_at: completedAt,
    },
  };
}

async function submitVideoTask(
  ctx: BytePlusContext,
): Promise<ProviderSubmitResult> {
  const body: JsonObject = { model: ctx.model };
  const content = readRawContent(ctx.params.content);

  const prompt = ctx.params.generation_prompt;
  if (
    typeof prompt === 'string' &&
    prompt.length > 0 &&
    !content.some(isTextContentItem)
  ) {
    content.push({ type: 'text', text: prompt });
  }

  // Chain handoffs arrive in generation_input_file. Video URLs (e.g. a
  // previous video step output entering a Seedance 2.0 modify step) map to
  // `video_url` reference items; everything else stays an image input.
  const handoffFiles = collectStringValues(ctx.params.generation_input_file);
  const videoFiles = handoffFiles.filter(isVideoInputValue);
  const inputFiles = handoffFiles.filter((file) => !isVideoInputValue(file));

  for (const file of videoFiles) {
    if (file.startsWith('data:')) {
      throw new BabyChainError(
        'invalid_provider_params',
        'BytePlus video input requires a publicly reachable video URL; data URIs are not supported.',
        400,
      );
    }

    content.push({
      type: 'video_url',
      video_url: { url: file },
      role: 'reference_video',
    });
  }

  const hasFirstFrame = content.some((item) => item.role === 'first_frame');

  for (const [index, file] of inputFiles.entries()) {
    content.push({
      type: 'image_url',
      image_url: { url: file },
      role:
        index === 0 && !hasFirstFrame && videoFiles.length === 0
          ? 'first_frame'
          : 'reference_image',
    });
  }

  const lastFrameFiles = collectStringValues(
    ctx.params.generation_input_file_last_content,
  );

  for (const file of lastFrameFiles) {
    content.push({
      type: 'image_url',
      image_url: { url: file },
      role: 'last_frame',
    });
  }

  body.content = content;

  for (const [rawKey, value] of Object.entries(ctx.params)) {
    if (value === undefined) continue;
    if (isProviderControlledBodyKey(rawKey)) continue;
    if (
      rawKey === 'generation_prompt' ||
      rawKey === 'content' ||
      rawKey === 'generation_input_file' ||
      rawKey === 'generation_input_file_last_content' ||
      rawKey === 'generation_output_format' ||
      rawKey === 'generation_output_number' ||
      rawKey === 'generation_provider_order'
    ) {
      continue;
    }
    if (rawKey === 'generation_ratio') {
      body.ratio = value as never;
      continue;
    }
    if (rawKey === 'generation_duration') {
      body.duration = value as never;
      continue;
    }
    if (rawKey === 'generation_resolution') {
      body.resolution = value as never;
      continue;
    }
    if (rawKey === 'generation_generate_audio') {
      body.generate_audio = value as never;
      continue;
    }
    if (rawKey.startsWith('generation_')) {
      const providerKey = rawKey.slice('generation_'.length);
      body[providerKey] =
        providerKey === 'output_format'
          ? (normalizeProviderOutputFormat(value) as never)
          : (value as never);
      continue;
    }
    if (rawKey === 'output_format') {
      continue;
    }

    body[rawKey] = value as never;
  }

  const url = `${ctx.baseUrl}/api/v3/contents/generations/tasks`;
  const response = await fetchWithGuards(ctx.fetchImpl, url, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      authorization: `Bearer ${ctx.apiKey}`,
      'x-idempotency-key': ctx.idempotencyKey,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(SUBMIT_TIMEOUT_MS),
  });

  const payload = (await response.json()) as { id?: string };
  if (!payload.id) {
    throw new BabyChainError(
      'provider_unexpected_response',
      'BytePlus task submit response is missing `id`.',
      502,
    );
  }

  return {
    kind: 'async',
    generationId: payload.id,
    providerOrder: ['byteplus'],
    providerMetadata: {
      provider: 'byteplus',
      region: ctx.region,
      model: ctx.model,
      kind: 'video_task',
      task_id: payload.id,
    },
  };
}

function readRawContent(value: unknown): JsonObject[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isJsonObject).map((item) => ({ ...item }));
}

function collectStringValues(value: unknown) {
  if (typeof value === 'string' && value.length > 0) {
    return [value];
  }

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is string => typeof item === 'string' && item.length > 0,
  );
}

function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isTextContentItem(value: JsonObject) {
  return value.type === 'text' && typeof value.text === 'string';
}

const VIDEO_FILE_EXTENSION_PATTERN = /\.(mp4|mov|webm|mkv|3gp|ogv)$/i;

/**
 * Detect video handoff values inside generation_input_file: data-video URIs
 * or HTTPS URLs whose path ends with a documented BytePlus video extension.
 */
function isVideoInputValue(value: string) {
  if (value.startsWith('data:video/')) {
    return true;
  }

  try {
    return VIDEO_FILE_EXTENSION_PATTERN.test(new URL(value).pathname);
  } catch {
    return false;
  }
}

function normalizeProviderOutputFormat(value: unknown) {
  if (typeof value !== 'string') {
    return value;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === 'jpg' ? 'jpeg' : normalized;
}

function isProviderControlledBodyKey(key: string) {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');

  return (
    normalized === 'callbackurl' ||
    normalized === 'generationcallbackurl' ||
    normalized === 'generationmodel' ||
    normalized === 'model'
  );
}

// ---------------------------------------------------------------------------
// Polling
// ---------------------------------------------------------------------------

type BytePlusTaskResponse = {
  id?: string;
  status?: string;
  content?: {
    video_url?: string;
    image_url?: string;
    last_frame_url?: string;
    [key: string]: unknown;
  } | null;
  error?: { code?: string; message?: string } | null;
  created_at?: number;
  updated_at?: number;
  completed_at?: number;
};

function mapTaskResponseToStatus(args: {
  payload: BytePlusTaskResponse;
  generationId: string;
  metadata: JsonObject;
}): ProviderGenerationStatus {
  const { payload, generationId, metadata } = args;
  const status = payload.status ?? '';
  const baseMetadata: JsonObject = {
    ...metadata,
    last_polled_at: new Date().toISOString(),
    last_status: status || null,
  };

  if (status === 'succeeded') {
    const outputs = collectOutputs(payload.content);
    const lastFrameUrl = readLastFrameUrl(payload.content);
    const providerMetadata = {
      ...baseMetadata,
      ...(lastFrameUrl ? { last_frame_url: lastFrameUrl } : {}),
    };

    if (outputs.length === 0) {
      return {
        generation_id: generationId,
        generation_status: 'failed',
        generation_provider_used: 'byteplus',
        generation_error: 'BytePlus reported succeeded without output URLs.',
        generation_error_code: 'provider_unexpected_response',
        provider_metadata: providerMetadata,
      };
    }

    return {
      generation_id: generationId,
      generation_status: 'succeeded',
      generation_provider_used: 'byteplus',
      generation_output_file: outputs,
      generation_completed_at:
        toIsoFromUnix(payload.completed_at) ?? new Date().toISOString(),
      provider_metadata: providerMetadata,
    };
  }

  if (status === 'failed' || status === 'expired') {
    return {
      generation_id: generationId,
      generation_status: 'failed',
      generation_provider_used: 'byteplus',
      generation_error: payload.error?.message ?? `BytePlus status: ${status}`,
      generation_error_code: payload.error?.code ?? `provider_${status}`,
      provider_metadata: baseMetadata,
    };
  }

  if (status === 'cancelled') {
    return {
      generation_id: generationId,
      generation_status: 'canceled',
      generation_provider_used: 'byteplus',
      provider_metadata: baseMetadata,
    };
  }

  return {
    generation_id: generationId,
    generation_status: 'processing',
    generation_provider_used: 'byteplus',
    provider_metadata: baseMetadata,
  };
}

function collectOutputs(content: BytePlusTaskResponse['content']): string[] {
  if (!content) return [];
  const outputs: string[] = [];
  for (const value of [content.video_url, content.image_url]) {
    if (typeof value !== 'string') continue;
    const outputUrl = value.trim();
    if (outputUrl.length > 0) outputs.push(outputUrl);
  }
  return outputs;
}

function readLastFrameUrl(content: BytePlusTaskResponse['content']) {
  return content && typeof content.last_frame_url === 'string'
    ? content.last_frame_url
    : null;
}

function toIsoFromUnix(value: number | undefined): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return new Date(value * 1_000).toISOString();
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

async function fetchWithGuards(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
) {
  const parsed = new URL(url);

  if (parsed.protocol !== 'https:') {
    throw new BabyChainError(
      'provider_request_blocked',
      'BytePlus endpoints must be HTTPS.',
      400,
    );
  }

  if (!isAllowedBytePlusHost(parsed.hostname)) {
    throw new BabyChainError(
      'provider_request_blocked',
      'BytePlus endpoint host is not in the allowlist.',
      400,
    );
  }

  const resolved = await lookupAllowedNetworkAddress(parsed.hostname);
  if (!resolved) {
    throw new BabyChainError(
      'provider_request_blocked',
      'BytePlus endpoint host resolves to a blocked address.',
      400,
    );
  }

  let response: Response;
  try {
    response = await fetchImpl(url, init);
  } catch (error) {
    throw new BabyChainError(
      'provider_network_error',
      `BytePlus request failed: ${error instanceof Error ? error.message : 'network error'}`,
      502,
    );
  }

  if (!response.ok) {
    const text = await safeReadText(response);
    throw new BabyChainError(
      mapBytePlusErrorCode(response.status),
      `BytePlus responded ${response.status}${text ? `: ${truncate(text, 500)}` : ''}`,
      response.status === 429 ? 429 : 502,
    );
  }

  return response;
}

function isAllowedBytePlusHost(hostname: string) {
  const lower = hostname.toLowerCase();
  return Object.values(BYTEPLUS_HOSTS).includes(lower);
}

function mapBytePlusErrorCode(status: number) {
  if (status === 401 || status === 403) return 'provider_unauthorized';
  if (status === 404) return 'provider_not_found';
  if (status === 409) return 'provider_invalid_request';
  if (status === 429) return 'provider_rate_limited';
  if (status >= 500) return 'provider_unavailable';
  return 'provider_invalid_request';
}

function stripPrefix(modelIdentifier: string, prefix: string) {
  if (!modelIdentifier.startsWith(prefix)) {
    throw new BabyChainError(
      'invalid_model_identifier',
      `Expected model identifier to start with "${prefix}".`,
      400,
    );
  }
  return modelIdentifier.slice(prefix.length);
}

function assertModelId(value: string) {
  if (!/^[A-Za-z0-9._\-/:]+$/.test(value) || value.length === 0) {
    throw new BabyChainError(
      'invalid_model_identifier',
      'BytePlus model identifier contains invalid characters.',
      400,
    );
  }
}

async function safeReadText(response: Response) {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function mapAspectToSize(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  // Accept either explicit `WIDTHxHEIGHT` or a babysea-standard aspect ratio.
  if (/^\d+x\d+$/i.test(value)) return value;
  const aspectToSize: Record<string, string> = {
    '1:1': '2048x2048',
    '4:3': '2304x1728',
    '3:4': '1728x2304',
    '3:2': '2496x1664',
    '2:3': '1664x2496',
    '16:9': '2560x1440',
    '9:16': '1440x2560',
    '21:9': '2520x1080',
    '9:21': '1080x2520',
  };
  return aspectToSize[value] ?? value;
}
