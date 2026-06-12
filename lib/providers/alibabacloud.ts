import 'server-only';

import { lookupAllowedNetworkAddress } from '@/lib/security/network-safety';
import type { JsonObject, JsonValue } from '@/lib/chains/types';
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
 * Alibaba Cloud Model Studio / DashScope — direct BYOK adapter.
 *
 * BabyChain supports the raw DashScope HTTP shapes from the supplied schema:
 * synchronous multimodal image calls and asynchronous image/video task calls.
 * Auth uses `Authorization: Bearer <DASHSCOPE_API_KEY>`.
 */
export type AlibabaCloudProviderConfig = {
  apiKey: string;
  fetchImpl?: typeof fetch;
};

const ALIBABA_CLOUD_HOST = 'dashscope-intl.aliyuncs.com';
const ALIBABA_CLOUD_REGION = 'singapore';
const SUBMIT_TIMEOUT_MS = 60_000;
const POLL_TIMEOUT_MS = 10_000;

const MULTIMODAL_SYNC_IMAGE_MODELS = new Set([
  'qwen-image-2.0-pro',
  'qwen-image-2.0',
  'qwen-image-max',
  'qwen-image-plus',
  'qwen-image',
  'qwen-image-edit-max',
  'qwen-image-edit-plus',
  'qwen-image-edit',
  'z-image-turbo',
  'wan2.7-image-pro',
  'wan2.7-image',
  'wan2.6-image',
  'wan2.6-t2i',
]);

const ASYNC_IMAGE_TO_IMAGE_MODELS = new Set([
  'wan2.5-i2i-preview',
  'wanx2.1-imageedit',
]);

const VIDEO_GENERATION_MODELS = new Set([
  'happyhorse-1.0-t2v',
  'happyhorse-1.0-i2v',
  'happyhorse-1.0-r2v',
  'happyhorse-1.0-video-edit',
  'wan2.7-t2v',
  'wan2.7-i2v-2026-04-25',
  'wan2.7-r2v',
  'wan2.7-videoedit',
]);

const ANIMATE_IMAGE_TO_VIDEO_MODELS = new Set([
  'wan2.2-animate-mix',
  'wan2.2-animate-move',
]);

export function createAlibabaCloudProvider(
  config: AlibabaCloudProviderConfig,
): Provider {
  const fetchImpl = config.fetchImpl ?? fetch;
  const baseUrl = `https://${ALIBABA_CLOUD_HOST}`;

  return {
    name: 'alibabacloud',

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
      const model = stripPrefix(input.modelIdentifier, 'alibabacloud/');
      assertModelId(model);
      const route = routeForModel(model, input.stepKind);
      const body = buildSubmitBody({
        model,
        params: input.params as Record<string, unknown>,
        route,
      });
      const url = `${baseUrl}${route.path}`;
      const headers: Record<string, string> = {
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: `Bearer ${config.apiKey}`,
        'x-idempotency-key': input.idempotencyKey,
      };

      if (route.async) {
        headers['x-dashscope-async'] = 'enable';
      }

      const response = await fetchWithGuards(fetchImpl, url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(SUBMIT_TIMEOUT_MS),
      });
      const payload = (await response.json()) as AlibabaCloudTaskResponse;

      if (!route.async) {
        const outputs = collectOutputUrls(payload);
        if (outputs.length === 0) {
          throw new BabyChainError(
            'provider_unexpected_response',
            'Alibaba Cloud image response contained no output URLs.',
            502,
          );
        }

        return {
          kind: 'completed',
          generationId:
            typeof payload.request_id === 'string'
              ? payload.request_id
              : `alibabacloud_img_${input.idempotencyKey}`,
          providerOrder: ['alibabacloud'],
          providerUsed: 'alibabacloud',
          outputFiles: outputs,
          providerMetadata: {
            provider: 'alibabacloud',
            region: ALIBABA_CLOUD_REGION,
            model,
            kind: 'sync_image',
            request_id:
              typeof payload.request_id === 'string'
                ? payload.request_id
                : null,
            output_files: outputs,
            completed_at: new Date().toISOString(),
          },
        };
      }

      const taskId = readTaskId(payload);
      if (!taskId) {
        throw new BabyChainError(
          'provider_unexpected_response',
          'Alibaba Cloud task submit response is missing `output.task_id`.',
          502,
        );
      }

      return {
        kind: 'async',
        generationId: taskId,
        providerOrder: ['alibabacloud'],
        providerMetadata: {
          provider: 'alibabacloud',
          region: ALIBABA_CLOUD_REGION,
          model,
          kind: route.kind,
          task_id: taskId,
        },
      };
    },

    async poll(
      context: ProviderPollContext,
    ): Promise<ProviderGenerationStatus> {
      const metadata = context.providerMetadata ?? {};

      if (metadata.kind === 'sync_image') {
        const outputs = Array.isArray(metadata.output_files)
          ? (metadata.output_files as unknown[]).filter(isNonEmptyString)
          : [];

        return {
          generation_id: context.generationId,
          generation_status: 'succeeded',
          generation_provider_used: 'alibabacloud',
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
      const url = `${baseUrl}/api/v1/tasks/${encodeURIComponent(taskId)}`;
      const response = await fetchWithGuards(fetchImpl, url, {
        method: 'GET',
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${config.apiKey}`,
        },
        signal: AbortSignal.timeout(POLL_TIMEOUT_MS),
      });
      const payload = (await response.json()) as AlibabaCloudTaskResponse;

      return mapTaskResponseToStatus({
        payload,
        generationId: context.generationId,
        metadata,
      });
    },

    async cancel(_context: ProviderCancelContext): Promise<void> {
      return;
    },
  };
}

type AlibabaCloudRoute = {
  async: boolean;
  kind: 'sync_image' | 'image_task' | 'video_task';
  path: string;
  protocol: 'animate_image_to_video' | 'image_task' | 'multimodal' | 'video';
};

function routeForModel(
  model: string,
  stepKind: 'image' | 'video',
): AlibabaCloudRoute {
  if (stepKind === 'image') {
    if (MULTIMODAL_SYNC_IMAGE_MODELS.has(model)) {
      return {
        async: false,
        kind: 'sync_image',
        path: '/api/v1/services/aigc/multimodal-generation/generation',
        protocol: 'multimodal',
      };
    }

    if (ASYNC_IMAGE_TO_IMAGE_MODELS.has(model)) {
      return {
        async: true,
        kind: 'image_task',
        path: '/api/v1/services/aigc/image2image/image-synthesis',
        protocol: 'image_task',
      };
    }
  }

  if (stepKind === 'video' && ANIMATE_IMAGE_TO_VIDEO_MODELS.has(model)) {
    return {
      async: true,
      kind: 'video_task',
      path: '/api/v1/services/aigc/image2video/video-synthesis',
      protocol: 'animate_image_to_video',
    };
  }

  if (stepKind === 'video' && VIDEO_GENERATION_MODELS.has(model)) {
    return {
      async: true,
      kind: 'video_task',
      path: '/api/v1/services/aigc/video-generation/video-synthesis',
      protocol: 'video',
    };
  }

  throw new BabyChainError(
    'invalid_model_identifier',
    `Alibaba Cloud model "${model}" is not valid for a ${stepKind} step.`,
    400,
  );
}

function buildSubmitBody(args: {
  model: string;
  params: Record<string, unknown>;
  route: AlibabaCloudRoute;
}): JsonObject {
  const input = readJsonObject(args.params.input);
  const parameters = readJsonObject(args.params.parameters);
  const generationPrompt = readNonEmptyString(args.params.generation_prompt);
  const inputFiles = collectStringValues(args.params.generation_input_file);
  const lastFrameFiles = collectStringValues(
    args.params.generation_input_file_last_content,
  );

  if (args.route.protocol === 'multimodal') {
    mergeMultimodalInput(input, generationPrompt, inputFiles);
  } else if (args.route.protocol === 'video') {
    mergeVideoInput({
      input,
      model: args.model,
      prompt: generationPrompt,
      inputFiles,
      lastFrameFiles,
    });
  } else if (args.route.protocol === 'animate_image_to_video') {
    mergeAnimateImageToVideoInput({
      input,
      inputFiles,
    });
  } else {
    mergeImageTaskInput({
      input,
      model: args.model,
      prompt: generationPrompt,
      inputFiles,
    });
  }

  mergeCommonParameters({
    model: args.model,
    params: args.params,
    parameters,
    route: args.route,
  });

  return compactJsonObject({
    model: args.model,
    input,
    parameters,
  });
}

function mergeMultimodalInput(
  input: JsonObject,
  prompt: string | null,
  inputFiles: string[],
) {
  const content = readOrCreateFirstMessageContent(input);

  if (prompt && !content.some(hasTextContent)) {
    content.push({ text: prompt });
  }

  if (!content.some(hasImageContent)) {
    for (const file of inputFiles) {
      content.push({ image: file });
    }
  }
}

function mergeAnimateImageToVideoInput(args: {
  input: JsonObject;
  inputFiles: string[];
}) {
  const [imageFile, videoFile] = args.inputFiles;

  if (args.input.image_url === undefined && imageFile) {
    args.input.image_url = imageFile;
  }

  if (args.input.video_url === undefined && videoFile) {
    args.input.video_url = videoFile;
  }
}

function mergeImageTaskInput(args: {
  input: JsonObject;
  model: string;
  prompt: string | null;
  inputFiles: string[];
}) {
  if (args.prompt && args.input.prompt === undefined) {
    args.input.prompt = args.prompt;
  }

  if (args.inputFiles.length === 0) {
    return;
  }

  if (args.input.images === undefined) {
    args.input.images = args.inputFiles;
  }
}

function mergeVideoInput(args: {
  input: JsonObject;
  model: string;
  prompt: string | null;
  inputFiles: string[];
  lastFrameFiles: string[];
}) {
  if (args.prompt && args.input.prompt === undefined) {
    args.input.prompt = args.prompt;
  }

  if (args.input.media !== undefined || args.inputFiles.length === 0) {
    return;
  }

  const media: JsonObject[] = [];

  if (isVideoEditModel(args.model)) {
    const [videoFile, ...referenceFiles] = args.inputFiles;
    if (videoFile) {
      media.push({ type: 'video', url: videoFile });
    }
    for (const file of referenceFiles) {
      media.push({ type: 'reference_image', url: file });
    }
  } else if (args.model.includes('r2v')) {
    for (const file of args.inputFiles) {
      media.push({ type: 'reference_image', url: file });
    }
  } else {
    const [firstFile, ...referenceFiles] = args.inputFiles;
    if (firstFile) {
      media.push({ type: 'first_frame', url: firstFile });
    }
    for (const file of referenceFiles) {
      media.push({ type: 'reference_image', url: file });
    }
  }

  for (const file of args.lastFrameFiles) {
    media.push({ type: 'last_frame', url: file });
  }

  if (media.length > 0) {
    args.input.media = media;
  }
}

function isVideoEditModel(model: string) {
  return model === 'happyhorse-1.0-video-edit' || model === 'wan2.7-videoedit';
}

function mergeCommonParameters(args: {
  model: string;
  params: Record<string, unknown>;
  parameters: JsonObject;
  route: AlibabaCloudRoute;
}) {
  if (args.route.protocol === 'animate_image_to_video') {
    return;
  }

  if (args.route.protocol === 'video') {
    delete args.parameters.n;
  } else {
    setIfMissing(args.parameters, 'n', args.params.generation_output_number);
  }
  setIfMissing(args.parameters, 'duration', args.params.generation_duration);
  setIfMissing(args.parameters, 'prompt_extend', args.params.prompt_extend);
  setIfMissing(args.parameters, 'watermark', args.params.watermark);
  setIfMissing(args.parameters, 'seed', args.params.seed);

  const outputSize =
    readNonEmptyString(args.params.generation_size) ??
    readNonEmptyString(args.params.size);
  if (outputSize && args.parameters.size === undefined) {
    args.parameters.size = normalizeSize(outputSize);
  }

  const ratio = readNonEmptyString(args.params.generation_ratio);
  const resolution = readNonEmptyString(args.params.generation_resolution);

  if (args.route.protocol === 'video') {
    setIfMissing(
      args.parameters,
      'resolution',
      normalizeResolution(resolution),
    );
    setIfMissing(args.parameters, 'ratio', ratio);
    return;
  }

  if (ratio && args.parameters.size === undefined) {
    const size = mapImageRatioToSize(args.model, ratio);
    if (size) {
      args.parameters.size = size;
    }
  }
}

function readOrCreateFirstMessageContent(input: JsonObject) {
  const existingMessages = Array.isArray(input.messages)
    ? input.messages.filter(isJsonObject)
    : [];

  const firstMessage = existingMessages[0] ?? { role: 'user', content: [] };
  const content = Array.isArray(firstMessage.content)
    ? firstMessage.content.filter(isJsonObject)
    : [];

  firstMessage.role =
    typeof firstMessage.role === 'string' ? firstMessage.role : 'user';
  firstMessage.content = content;
  input.messages = [firstMessage, ...existingMessages.slice(1)];

  return content;
}

function mapTaskResponseToStatus(args: {
  payload: AlibabaCloudTaskResponse;
  generationId: string;
  metadata: JsonObject;
}): ProviderGenerationStatus {
  const status = args.payload.output?.task_status ?? '';
  const providerMetadata: JsonObject = {
    ...args.metadata,
    last_polled_at: new Date().toISOString(),
    last_status: status || null,
    request_id:
      typeof args.payload.request_id === 'string'
        ? args.payload.request_id
        : null,
  };

  if (status === 'SUCCEEDED') {
    const outputs = collectOutputUrls(args.payload);

    if (outputs.length === 0) {
      return {
        generation_id: args.generationId,
        generation_status: 'failed',
        generation_provider_used: 'alibabacloud',
        generation_error:
          'Alibaba Cloud reported SUCCEEDED without output URLs.',
        generation_error_code: 'provider_unexpected_response',
        provider_metadata: providerMetadata,
      };
    }

    return {
      generation_id: args.generationId,
      generation_status: 'succeeded',
      generation_provider_used: 'alibabacloud',
      generation_output_file: outputs,
      generation_completed_at: new Date().toISOString(),
      provider_metadata: providerMetadata,
    };
  }

  if (status === 'FAILED' || status === 'UNKNOWN') {
    return {
      generation_id: args.generationId,
      generation_status: 'failed',
      generation_provider_used: 'alibabacloud',
      generation_error:
        args.payload.output?.message ?? `Alibaba Cloud status: ${status}`,
      generation_error_code:
        args.payload.output?.code ??
        (status === 'UNKNOWN' ? 'provider_task_not_found' : 'provider_failed'),
      provider_metadata: providerMetadata,
    };
  }

  if (status === 'CANCELED') {
    return {
      generation_id: args.generationId,
      generation_status: 'canceled',
      generation_provider_used: 'alibabacloud',
      provider_metadata: providerMetadata,
    };
  }

  return {
    generation_id: args.generationId,
    generation_status: 'processing',
    generation_provider_used: 'alibabacloud',
    provider_metadata: providerMetadata,
  };
}

type AlibabaCloudTaskResponse = {
  request_id?: string;
  code?: string;
  message?: string;
  output?: {
    task_id?: string;
    task_status?: string;
    image_url?: string;
    video_url?: string;
    code?: string;
    message?: string;
    choices?: Array<{
      message?: {
        content?: Array<{ image?: string; video_url?: string; url?: string }>;
      };
    }>;
    results?: Array<{ url?: string; image_url?: string; video_url?: string }>;
  };
};

function collectOutputUrls(payload: AlibabaCloudTaskResponse) {
  const output = payload.output;
  const urls: string[] = [];

  if (!output) {
    return urls;
  }

  for (const value of [output.image_url, output.video_url]) {
    if (isNonEmptyString(value)) {
      urls.push(value);
    }
  }

  for (const choice of output.choices ?? []) {
    for (const item of choice.message?.content ?? []) {
      for (const value of [item.image, item.video_url, item.url]) {
        if (isNonEmptyString(value)) {
          urls.push(value);
        }
      }
    }
  }

  for (const result of output.results ?? []) {
    for (const value of [result.url, result.image_url, result.video_url]) {
      if (isNonEmptyString(value)) {
        urls.push(value);
      }
    }
  }

  return [...new Set(urls)];
}

function readTaskId(payload: AlibabaCloudTaskResponse) {
  const taskId = payload.output?.task_id;
  return isNonEmptyString(taskId) ? taskId : null;
}

async function fetchWithGuards(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
) {
  const parsed = new URL(url);

  if (parsed.protocol !== 'https:') {
    throw new BabyChainError(
      'provider_request_blocked',
      'Alibaba Cloud endpoints must be HTTPS.',
      400,
    );
  }

  if (!isAllowedAlibabaCloudHost(parsed.hostname)) {
    throw new BabyChainError(
      'provider_request_blocked',
      'Alibaba Cloud endpoint host is not in the allowlist.',
      400,
    );
  }

  const resolved = await lookupAllowedNetworkAddress(parsed.hostname);
  if (!resolved) {
    throw new BabyChainError(
      'provider_request_blocked',
      'Alibaba Cloud endpoint host resolves to a blocked address.',
      400,
    );
  }

  let response: Response;
  try {
    response = await fetchImpl(url, init);
  } catch (error) {
    throw new BabyChainError(
      'provider_network_error',
      `Alibaba Cloud request failed: ${error instanceof Error ? error.message : 'network error'}`,
      502,
    );
  }

  if (!response.ok) {
    const text = await safeReadText(response);
    throw new BabyChainError(
      mapAlibabaCloudErrorCode(response.status),
      `Alibaba Cloud responded ${response.status}${text ? `: ${truncate(text, 500)}` : ''}`,
      response.status === 429 ? 429 : 502,
    );
  }

  return response;
}

function isAllowedAlibabaCloudHost(hostname: string) {
  const lower = hostname.toLowerCase();
  return lower === ALIBABA_CLOUD_HOST;
}

function mapAlibabaCloudErrorCode(status: number) {
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
      'Alibaba Cloud model identifier contains invalid characters.',
      400,
    );
  }
}

function readJsonObject(value: unknown): JsonObject {
  if (!isJsonObject(value)) {
    return {};
  }

  return { ...value };
}

function compactJsonObject(value: JsonObject): JsonObject {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined),
  ) as JsonObject;
}

function setIfMissing(target: JsonObject, key: string, value: unknown) {
  if (target[key] !== undefined || value === undefined || value === null) {
    return;
  }

  target[key] = value as JsonValue;
}

function collectStringValues(value: unknown) {
  if (isNonEmptyString(value)) {
    return [value];
  }

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isNonEmptyString);
}

function readNonEmptyString(value: unknown) {
  return isNonEmptyString(value) ? value : null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasTextContent(value: JsonObject) {
  return typeof value.text === 'string' && value.text.length > 0;
}

function hasImageContent(value: JsonObject) {
  return typeof value.image === 'string' && value.image.length > 0;
}

function normalizeResolution(value: string | null) {
  if (!value) return undefined;
  const upper = value.trim().toUpperCase();
  return upper.endsWith('P') ? upper : value;
}

function normalizeSize(value: string) {
  return value.replace(/x/i, '*');
}

// qwen-image / qwen-image-plus accept ONLY these exact sizes (DashScope
// rejects everything else with "The size does not match the allowed size
// 1664*928,1472*1104,1328*1328,1104*1472,928*1664").
const QWEN_SNAPPED_SIZES: Record<string, string> = {
  '1:1': '1328*1328',
  '4:3': '1472*1104',
  '3:4': '1104*1472',
  '16:9': '1664*928',
  '9:16': '928*1664',
};

// Output-size constraints per model, learned from DashScope validation
// responses. Models without a rule keep the legacy fixed table below.
//   fixed : only the listed sizes are accepted.
//   fit   : any size within a pixel budget (and optional per-dimension cap).
const IMAGE_SIZE_RULES: Record<
  string,
  | { kind: 'fixed'; sizes: Record<string, string> }
  | { kind: 'fit'; maxPixels: number; maxDimension?: number }
> = {
  'qwen-image': { kind: 'fixed', sizes: QWEN_SNAPPED_SIZES },
  'qwen-image-plus': { kind: 'fixed', sizes: QWEN_SNAPPED_SIZES },
  // "Size is out of range [512*512, 2048*2048]" — per-dimension bound.
  'qwen-image-max': { kind: 'fit', maxPixels: 4_194_304, maxDimension: 2048 },
  'z-image-turbo': { kind: 'fit', maxPixels: 4_194_304, maxDimension: 2048 },
  // "Total pixels (…) must be between 589824 and 2073600."
  'wan2.6-t2i': { kind: 'fit', maxPixels: 2_073_600 },
  // Area-bound families. These also list exotic ratios (3:1, 4:5, 16:10, …)
  // the legacy table never knew, which used to fall through as a raw ratio
  // string the API rejected. 4 MP keeps outputs in the legacy size range.
  'wan2.6-image': { kind: 'fit', maxPixels: 4_194_304 },
  'wan2.7-image': { kind: 'fit', maxPixels: 4_194_304 },
  'wan2.7-image-pro': { kind: 'fit', maxPixels: 4_194_304 },
};

// Legacy table for models that accept large free-form sizes (qwen-image-2.0
// family, edit models). Kept verbatim so their behavior does not change.
const DEFAULT_RATIO_SIZES: Record<string, string> = {
  '1:1': '2048*2048',
  '4:3': '2304*1728',
  '3:4': '1728*2304',
  '3:2': '2496*1664',
  '2:3': '1664*2496',
  '16:9': '2560*1440',
  '9:16': '1440*2560',
  '21:9': '2520*1080',
  '9:21': '1080*2520',
};

function mapImageRatioToSize(model: string, value: string) {
  const rule = IMAGE_SIZE_RULES[model];

  if (rule?.kind === 'fixed') {
    return rule.sizes[value];
  }
  if (rule?.kind === 'fit') {
    return fitSizeToRatio(value, rule.maxPixels, rule.maxDimension);
  }
  // Unknown ratios return undefined (provider default size) instead of being
  // sent verbatim as a size string the API would reject.
  return DEFAULT_RATIO_SIZES[value];
}

/** Largest W*H matching `ratio` within the pixel budget and dimension cap. */
function fitSizeToRatio(
  ratio: string,
  maxPixels: number,
  maxDimension?: number,
) {
  const match = /^(\d+):(\d+)$/.exec(ratio.trim());
  if (!match) return undefined;
  const w = Number(match[1]);
  const h = Number(match[2]);
  if (!w || !h) return undefined;

  let scale = Math.sqrt(maxPixels / (w * h));
  if (maxDimension) {
    scale = Math.min(scale, maxDimension / w, maxDimension / h);
  }
  const width = Math.floor((w * scale) / 16) * 16;
  const height = Math.floor((h * scale) / 16) * 16;
  if (width <= 0 || height <= 0) return undefined;
  return `${width}*${height}`;
}

async function safeReadText(response: Response) {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max)}...` : text;
}
