import 'server-only';

import { Buffer } from 'node:buffer';
import type { LookupAddress } from 'node:dns';
import type { IncomingMessage } from 'node:http';
import { request as httpsRequest } from 'node:https';

import { parseDataUrlOutputFile } from '@/lib/chains/output-files';
import type { JsonObject, JsonValue } from '@/lib/chains/types';
import { lookupAllowedNetworkAddress } from '@/lib/security/network-safety';
import { getEnv } from '@/lib/utils/env';
import { BabyChainError, toErrorMessage } from '@/lib/utils/errors';

import type {
  ChainAgent,
  ChainAgentPromptContext,
  ChainAgentResult,
  ChainAgentSuggestion,
} from './types';
import {
  buildChainAgentInstruction,
  CHAIN_AGENT_INSTRUCTION_VERSION,
} from './instructions';

const BEDROCK_DEFAULT_MODEL = 'us.amazon.nova-pro-v1:0';
const BEDROCK_DEFAULT_REGION = 'us-east-1';
const BEDROCK_TIMEOUT_MS = 120_000;
const MEDIA_DOWNLOAD_TIMEOUT_MS = 60_000;
const MAX_AGENT_MEDIA_BYTES = 24 * 1024 * 1024;

type BedrockNovaConfig = {
  apiKey?: string;
  fetchImpl?: typeof fetch;
  modelIdentifier?: string;
  region?: string;
};

type DownloadedMedia = {
  bytes: Buffer;
  mediaType: string;
};

export function createBedrockNovaAgent(
  config: BedrockNovaConfig = {},
): ChainAgent {
  const env = getEnv();
  const fetchImpl = config.fetchImpl ?? fetch;
  const apiKey = config.apiKey ?? env.AWS_BEARER_TOKEN_BEDROCK;
  const region = config.region ?? env.BEDROCK_REGION ?? BEDROCK_DEFAULT_REGION;
  const modelIdentifier =
    config.modelIdentifier ??
    env.BEDROCK_NOVA_AGENT_MODEL ??
    BEDROCK_DEFAULT_MODEL;

  return {
    async suggestNextStep(
      input: ChainAgentPromptContext,
    ): Promise<ChainAgentResult> {
      if (!apiKey) {
        throw new BabyChainError(
          'chain_agent_not_configured',
          'Chain Agent requires AWS_BEARER_TOKEN_BEDROCK on the BabyChain server.',
          500,
        );
      }

      const startedAt = Date.now();
      const first = await invokeAgent({
        apiKey,
        context: input,
        fetchImpl,
        modelIdentifier,
        region,
      });
      const firstValidation = validateAgentResult(first.result, input);

      if (firstValidation.ok) {
        return withObservability(first.result, {
          latencyMs: Date.now() - startedAt,
          modelIdentifier,
          repaired: false,
          requestCount: 1,
          usage: first.usage,
          validation: firstValidation,
        });
      }

      const repair = await invokeAgent({
        apiKey,
        context: input,
        fetchImpl,
        modelIdentifier,
        previousJson: first.result.rawText,
        region,
        repairError: firstValidation.error,
      });
      const repairValidation = validateAgentResult(repair.result, input);

      if (!repairValidation.ok) {
        throw new BabyChainError(
          'chain_agent_invalid_response',
          `Chain Agent repair failed validation: ${repairValidation.error}`,
          502,
        );
      }

      return withObservability(repair.result, {
        latencyMs: Date.now() - startedAt,
        modelIdentifier,
        repaired: true,
        requestCount: 2,
        usage: mergeUsage(first.usage, repair.usage),
        validation: repairValidation,
      });
    },
  };
}

export function defaultBedrockNovaModelIdentifier() {
  return getEnv().BEDROCK_NOVA_AGENT_MODEL ?? BEDROCK_DEFAULT_MODEL;
}

async function invokeAgent(args: {
  apiKey: string;
  context: ChainAgentPromptContext;
  fetchImpl: typeof fetch;
  modelIdentifier: string;
  previousJson?: string | null;
  region: string;
  repairError?: string | null;
}) {
  const body = await buildConverseBody(args.context, args.fetchImpl, {
    previousJson: args.previousJson ?? null,
    repairError: args.repairError ?? null,
  });
  const response = await fetchBedrockConverse({
    apiKey: args.apiKey,
    body,
    fetchImpl: args.fetchImpl,
    modelIdentifier: args.modelIdentifier,
    region: args.region,
  });
  const rawText = extractTextResponse(response);

  return {
    result: normalizeAgentOutput(rawText),
    usage: isRecord(response.usage) ? toJsonObject(response.usage) : {},
  };
}

async function buildConverseBody(
  context: ChainAgentPromptContext,
  fetchImpl: typeof fetch,
  options: { repairError?: string | null; previousJson?: string | null } = {},
) {
  const content: JsonObject[] = [];

  for (const outputFile of context.previousStep.outputFiles.slice(0, 2)) {
    const media = await readAgentMedia(outputFile, fetchImpl);
    const kind = media.mediaType.startsWith('video/') ? 'video' : 'image';
    const format = mediaFormat(media.mediaType, kind);

    content.push({
      text: `${kind === 'video' ? 'Video' : 'Image'} ${content.length + 1}:`,
    });
    content.push({
      [kind]: {
        format,
        source: {
          bytes: media.bytes.toString('base64'),
        },
      },
    });
  }

  content.push({ text: buildChainAgentInstruction(context, options) });

  return {
    messages: [
      {
        role: 'user',
        content,
      },
    ],
    inferenceConfig: {
      maxTokens: 1800,
      temperature: context.flow.mode === 'autopilot' ? 0 : 0.35,
    },
  };
}

async function fetchBedrockConverse(args: {
  apiKey: string;
  body: JsonObject;
  fetchImpl: typeof fetch;
  modelIdentifier: string;
  region: string;
}) {
  const response = await args.fetchImpl(
    `https://bedrock-runtime.${args.region}.amazonaws.com/model/${encodeURIComponent(args.modelIdentifier)}/converse`,
    {
      method: 'POST',
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${args.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(args.body),
      signal: AbortSignal.timeout(BEDROCK_TIMEOUT_MS),
    },
  );

  const payload = (await response
    .json()
    .catch(() => null)) as JsonObject | null;

  if (!response.ok) {
    const message = bedrockErrorMessage(payload);

    throw new BabyChainError(
      response.status === 429
        ? 'chain_agent_rate_limited'
        : 'chain_agent_failed',
      message
        ? `Bedrock Nova agent request failed with status ${response.status}: ${message}`
        : `Bedrock Nova agent request failed with status ${response.status}.`,
      response.status === 429 ? 429 : 502,
      payload ?? undefined,
    );
  }

  return payload ?? {};
}

function bedrockErrorMessage(payload: JsonObject | null) {
  if (!payload) return null;

  return (
    stringValue(payload.message) ??
    stringValue(payload.Message) ??
    stringValue(payload.error) ??
    stringValue(payload.errorMessage)
  );
}

function extractTextResponse(payload: JsonObject) {
  const output = payload.output;
  if (!isRecord(output)) return '';
  const message = output.message;
  if (!isRecord(message) || !Array.isArray(message.content)) return '';

  return message.content
    .map((part) =>
      isRecord(part) && typeof part.text === 'string' ? part.text : '',
    )
    .join('\n')
    .trim();
}

function normalizeAgentOutput(rawText: string): ChainAgentResult {
  const parsed = parseAgentJson(rawText);
  const suggestions = normalizeSuggestions(parsed.suggestions);
  const selectedPrompt =
    stringValue(parsed.selected_prompt) ?? suggestions[0]?.prompt ?? '';
  const selectedParams = normalizeSelectedParams(
    parsed.selected_params,
    selectedPrompt,
  );

  if (!selectedPrompt.trim()) {
    throw new BabyChainError(
      'chain_agent_invalid_response',
      'Chain Agent response did not include a usable prompt.',
      502,
    );
  }

  return {
    observations: isRecord(parsed.observations)
      ? toJsonObject(parsed.observations)
      : {},
    observability: {},
    suggestions,
    selectedPrompt,
    selectedParams,
    rawText,
  };
}

type AgentValidationResult =
  | { ok: true; checkedParams: string[] }
  | { ok: false; checkedParams: string[]; error: string };

function validateAgentResult(
  result: ChainAgentResult,
  context: ChainAgentPromptContext,
): AgentValidationResult {
  const schema = context.nextStep.schema;
  const baseParams = isRecord(context.nextStep.requestParams)
    ? toJsonObject(context.nextStep.requestParams)
    : {};
  const params: JsonObject = {
    ...baseParams,
    generation_prompt: result.selectedPrompt,
  };
  const checkedParams = ['generation_prompt'];

  if (!schema || typeof schema !== 'object') {
    return validatePromptEnhancement(result, context, checkedParams);
  }

  const required = Array.isArray(schema.required)
    ? schema.required.filter(
        (entry): entry is string => typeof entry === 'string',
      )
    : [];
  const properties =
    schema.properties &&
    typeof schema.properties === 'object' &&
    !Array.isArray(schema.properties)
      ? (schema.properties as Record<string, JsonObject>)
      : {};

  for (const fieldName of required) {
    if (!hasProvidedAgentValue(params[fieldName])) {
      return {
        ok: false,
        checkedParams,
        error: `${fieldName} must be filled by the user before the agent run starts.`,
      };
    }
  }

  for (const [key, value] of Object.entries(params)) {
    const field = properties[key];

    if (!field) {
      return {
        ok: false,
        checkedParams,
        error: `${key} is not supported by the downstream schema.`,
      };
    }

    const error = validateAgentFieldValue(key, value, field);
    if (error) {
      return { ok: false, checkedParams, error };
    }
  }

  return validatePromptEnhancement(result, context, checkedParams);
}

function validatePromptEnhancement(
  result: ChainAgentResult,
  context: ChainAgentPromptContext,
  checkedParams: string[],
): AgentValidationResult {
  const selected = normalizeComparablePrompt(result.selectedPrompt);
  const existing = normalizeComparablePrompt(
    stringValue(
      isRecord(context.nextStep.requestParams)
        ? context.nextStep.requestParams.generation_prompt
        : undefined,
    ) ?? '',
  );
  const previous = normalizeComparablePrompt(
    stringValue(
      isRecord(context.previousStep.requestParams)
        ? context.previousStep.requestParams.generation_prompt
        : undefined,
    ) ?? '',
  );
  const prompts = result.suggestions.map((suggestion) =>
    normalizeComparablePrompt(suggestion.prompt),
  );
  const uniquePrompts = new Set(prompts.filter(Boolean));

  if (existing && selected === existing) {
    return {
      ok: false,
      checkedParams,
      error:
        'selected_prompt is the same as the existing downstream prompt. Rewrite it with clearly improved motion, camera, pacing, and continuity details.',
    };
  }

  if (previous && selected === previous) {
    return {
      ok: false,
      checkedParams,
      error:
        'selected_prompt is the same as the previous step prompt. Rewrite it for the next step instead of copying the source prompt.',
    };
  }

  if (uniquePrompts.size < Math.min(3, result.suggestions.length)) {
    return {
      ok: false,
      checkedParams,
      error: 'suggestions must be meaningfully distinct from each other.',
    };
  }

  return { ok: true, checkedParams };
}

function normalizeComparablePrompt(value: string) {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function validateAgentFieldValue(
  key: string,
  value: JsonValue,
  field: JsonObject,
) {
  const enumValues = Array.isArray(field.enum) ? field.enum : [];
  if (enumValues.length > 0 && !enumValues.includes(value)) {
    return `${key} must be one of: ${enumValues.join(', ')}.`;
  }

  if (field.type === 'number' || field.type === 'integer') {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return `${key} must be a finite number.`;
    }

    if (field.type === 'integer' && !Number.isInteger(value)) {
      return `${key} must be an integer.`;
    }

    if (typeof field.minimum === 'number' && value < field.minimum) {
      return `${key} must be >= ${field.minimum}.`;
    }

    if (typeof field.maximum === 'number' && value > field.maximum) {
      return `${key} must be <= ${field.maximum}.`;
    }
  }

  if (field.type === 'boolean' && typeof value !== 'boolean') {
    return `${key} must be a boolean.`;
  }

  if (field.type === 'string' && typeof value !== 'string') {
    return `${key} must be a string.`;
  }

  if (field.type === 'array' && !Array.isArray(value)) {
    return `${key} must be an array.`;
  }

  if (
    field.type === 'object' &&
    (!value || typeof value !== 'object' || Array.isArray(value))
  ) {
    return `${key} must be an object.`;
  }

  return null;
}

function hasProvidedAgentValue(value: JsonValue | undefined) {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function withObservability(
  result: ChainAgentResult,
  input: {
    latencyMs: number;
    modelIdentifier: string;
    repaired: boolean;
    requestCount: number;
    usage: JsonObject;
    validation: AgentValidationResult;
  },
): ChainAgentResult {
  return {
    ...result,
    observability: {
      instruction_version: CHAIN_AGENT_INSTRUCTION_VERSION,
      latency_ms: input.latencyMs,
      model_identifier: input.modelIdentifier,
      repair_attempted: input.repaired,
      request_count: input.requestCount,
      schema_version: schemaVersion(),
      selected_suggestion_index: selectedSuggestionIndex(result),
      token_usage: input.usage,
      validation: input.validation as unknown as JsonObject,
    },
  };
}

function selectedSuggestionIndex(result: ChainAgentResult) {
  return result.suggestions.findIndex(
    (suggestion) => suggestion.prompt === result.selectedPrompt,
  );
}

function schemaVersion() {
  return 'semantic-lady-runtime-schema';
}

function mergeUsage(left: JsonObject, right: JsonObject) {
  const merged: JsonObject = { ...left };

  for (const [key, value] of Object.entries(right)) {
    const existing = merged[key];
    merged[key] =
      typeof existing === 'number' && typeof value === 'number'
        ? existing + value
        : value;
  }

  return merged;
}

function parseAgentJson(rawText: string) {
  const trimmed = rawText.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  const jsonText = fenced?.[1] ?? trimmed;

  try {
    return JSON.parse(jsonText) as Record<string, unknown>;
  } catch (error) {
    throw new BabyChainError(
      'chain_agent_invalid_response',
      `Chain Agent returned invalid JSON: ${toErrorMessage(error)}`,
      502,
    );
  }
}

function normalizeSuggestions(value: unknown): ChainAgentSuggestion[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index): ChainAgentSuggestion | null => {
      if (!isRecord(item)) return null;
      const prompt = stringValue(item.prompt);
      if (!prompt) return null;
      const rationale = stringValue(item.rationale);
      const suggestion: ChainAgentSuggestion = {
        title: stringValue(item.title) ?? `Option ${index + 1}`,
        prompt,
      };

      if (isRecord(item.params)) {
        suggestion.params = toJsonObject(item.params);
      }

      if (rationale) {
        suggestion.rationale = rationale;
      }

      return suggestion;
    })
    .filter((item): item is ChainAgentSuggestion => item !== null)
    .slice(0, 5);
}

function normalizeSelectedParams(value: unknown, selectedPrompt: string) {
  return {
    generation_prompt: selectedPrompt,
  } satisfies JsonObject;
}

async function readAgentMedia(
  value: string,
  fetchImpl: typeof fetch,
): Promise<DownloadedMedia> {
  const dataUrl = parseDataUrlOutputFile(value);
  if (dataUrl) {
    if (dataUrl.bytes.byteLength > MAX_AGENT_MEDIA_BYTES) {
      throw new BabyChainError(
        'chain_agent_media_too_large',
        'Chain Agent inline media must be 24MB or smaller until BabyChain media storage is enabled.',
        400,
      );
    }

    return {
      bytes: dataUrl.bytes,
      mediaType: dataUrl.mediaType,
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new BabyChainError(
      'chain_agent_media_invalid',
      'Chain Agent media references must be data URLs or HTTPS URLs.',
      400,
    );
  }

  if (parsed.protocol !== 'https:') {
    throw new BabyChainError(
      'chain_agent_media_invalid',
      'Chain Agent media references must use HTTPS.',
      400,
    );
  }

  const resolved = await lookupAllowedNetworkAddress(parsed.hostname);
  if (!resolved) {
    throw new BabyChainError(
      'chain_agent_media_blocked',
      'Chain Agent media URL resolves to a blocked address.',
      400,
    );
  }

  return fetchImpl === fetch
    ? downloadAgentMediaWithPinnedAddress(parsed, resolved)
    : downloadAgentMediaWithFetch(parsed, fetchImpl);
}

function downloadAgentMediaWithPinnedAddress(
  parsed: URL,
  resolved: LookupAddress,
) {
  return new Promise<DownloadedMedia>((resolve, reject) => {
    const request = httpsRequest(
      parsed,
      {
        headers: { accept: 'image/*,video/*' },
        lookup: (_hostname, options, callback) => {
          if (typeof options === 'object' && options.all) {
            const allCallback = callback as unknown as (
              error: NodeJS.ErrnoException | null,
              addresses: LookupAddress[],
            ) => void;

            allCallback(null, [resolved]);
            return;
          }

          callback(null, resolved.address, resolved.family);
        },
        method: 'GET',
      },
      (response) => {
        void readAgentMediaResponse(response, parsed.pathname)
          .then(resolve)
          .catch(reject);
      },
    );
    const timeout = setTimeout(() => {
      request.destroy(
        new BabyChainError(
          'chain_agent_media_download_failed',
          'Chain Agent media download timed out.',
          502,
        ),
      );
    }, MEDIA_DOWNLOAD_TIMEOUT_MS);

    request.on('error', reject);
    request.on('close', () => clearTimeout(timeout));
    request.end();
  }).catch((error: unknown) => {
    if (error instanceof BabyChainError) {
      throw error;
    }

    throw new BabyChainError(
      'chain_agent_media_download_failed',
      `Chain Agent media download failed: ${toErrorMessage(error)}`,
      502,
    );
  });
}

async function downloadAgentMediaWithFetch(
  parsed: URL,
  fetchImpl: typeof fetch,
) {
  const response = await fetchImpl(parsed.href, {
    method: 'GET',
    redirect: 'manual',
    headers: { accept: 'image/*,video/*' },
    signal: AbortSignal.timeout(MEDIA_DOWNLOAD_TIMEOUT_MS),
  }).catch((error: unknown) => {
    throw new BabyChainError(
      'chain_agent_media_download_failed',
      `Chain Agent media download failed: ${toErrorMessage(error)}`,
      502,
    );
  });

  return readAgentMediaFetchResponse(response, parsed.pathname);
}

async function readAgentMediaFetchResponse(
  response: Response,
  pathname: string,
): Promise<DownloadedMedia> {
  assertAgentMediaStatus(response.status);
  assertAgentMediaContentLength(response.headers.get('content-length'));

  const bytes = Buffer.from(await response.arrayBuffer());

  return normalizeDownloadedAgentMedia({
    bytes,
    contentType: response.headers.get('content-type'),
    pathname,
  });
}

function readAgentMediaResponse(response: IncomingMessage, pathname: string) {
  return new Promise<DownloadedMedia>((resolve, reject) => {
    try {
      assertAgentMediaStatus(response.statusCode ?? null);
      assertAgentMediaContentLength(response.headers['content-length']);
    } catch (error) {
      response.resume();
      reject(error);
      return;
    }

    const chunks: Buffer[] = [];
    let totalBytes = 0;

    response.on('data', (chunk: Buffer | string) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += buffer.byteLength;

      if (totalBytes > MAX_AGENT_MEDIA_BYTES) {
        reject(
          new BabyChainError(
            'chain_agent_media_too_large',
            'Chain Agent media must be 24MB or smaller until BabyChain media storage is enabled.',
            400,
          ),
        );
        response.destroy();
        return;
      }

      chunks.push(buffer);
    });
    response.on('end', () => {
      try {
        resolve(
          normalizeDownloadedAgentMedia({
            bytes: Buffer.concat(chunks),
            contentType: stringHeader(response.headers['content-type']),
            pathname,
          }),
        );
      } catch (error) {
        reject(error);
      }
    });
    response.on('error', reject);
  });
}

function assertAgentMediaStatus(status: number | null) {
  if (status !== null && status >= 300 && status < 400) {
    throw new BabyChainError(
      'chain_agent_media_blocked',
      'Chain Agent media redirects are not allowed.',
      400,
    );
  }

  if (status === null || status < 200 || status >= 300) {
    throw new BabyChainError(
      'chain_agent_media_download_failed',
      `Chain Agent media download responded ${status ?? 'unknown'}.`,
      400,
    );
  }
}

function assertAgentMediaContentLength(
  value: string | string[] | null | undefined,
) {
  const contentLength = Number(Array.isArray(value) ? value[0] : value);

  if (Number.isFinite(contentLength) && contentLength > MAX_AGENT_MEDIA_BYTES) {
    throw new BabyChainError(
      'chain_agent_media_too_large',
      'Chain Agent media must be 24MB or smaller until BabyChain media storage is enabled.',
      400,
    );
  }
}

function normalizeDownloadedAgentMedia({
  bytes,
  contentType,
  pathname,
}: {
  bytes: Buffer;
  contentType: string | null | undefined;
  pathname: string;
}) {
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_AGENT_MEDIA_BYTES) {
    throw new BabyChainError(
      'chain_agent_media_too_large',
      'Chain Agent media must be non-empty and 24MB or smaller until BabyChain media storage is enabled.',
      400,
    );
  }

  const mediaType = contentType?.split(';')[0]?.trim().toLowerCase();

  return {
    bytes,
    mediaType:
      mediaType &&
      (mediaType.startsWith('image/') || mediaType.startsWith('video/'))
        ? mediaType
        : inferMediaType(pathname),
  };
}

function stringHeader(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function mediaFormat(mediaType: string, kind: 'image' | 'video') {
  const subtype = mediaType.split('/')[1]?.toLowerCase() ?? '';

  if (subtype === 'jpeg') return 'jpeg';
  if (['png', 'gif', 'webp'].includes(subtype)) return subtype;
  if (['mp4', 'mov', 'webm'].includes(subtype)) return subtype;

  return kind === 'video' ? 'mp4' : 'png';
}

function inferMediaType(pathname: string) {
  const lower = pathname.toLowerCase();
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.mov')) return 'video/quicktime';
  if (lower.endsWith('.webm')) return 'video/webm';
  if (lower.endsWith('.mp4')) return 'video/mp4';
  return 'image/png';
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toJsonObject(value: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => isJsonValue(entry)),
  ) as JsonObject;
}

function isJsonValue(value: unknown): value is JsonValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }

  return isRecord(value) && Object.values(value).every(isJsonValue);
}
