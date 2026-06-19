import 'server-only';

import { BabyChainError } from '@/lib/utils/errors';

import {
  createShowrunnerSuggestionSystemPrompt,
  createShowrunnerSuggestionUserPrompt,
} from './prompts';
import {
  NextPromptSuggestionSetSchema,
  SuggestNextPromptsInputSchema,
  type NextPromptSuggestionResult,
} from './schemas';

type QwenChoice = {
  message?: {
    content?: unknown;
  };
};

type QwenChatResponse = {
  choices?: QwenChoice[];
  error?: {
    message?: string;
  };
};

const QWEN_REQUEST_TIMEOUT_MS = 20_000;

export type QwenCloudConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

export async function createQwenNextPromptSuggestions(
  input: unknown,
): Promise<NextPromptSuggestionResult> {
  const parsed = SuggestNextPromptsInputSchema.parse(input);
  const config = readQwenCloudConfig();

  if (!config) {
    throw new BabyChainError(
      'qwen_cloud_not_configured',
      'Set QWEN_CLOUD_API_KEY or DASHSCOPE_API_KEY to generate Qwen Cloud next-scene options.',
      500,
    );
  }

  const abortController = new AbortController();
  const timeout = setTimeout(
    () => abortController.abort(),
    QWEN_REQUEST_TIMEOUT_MS,
  );
  const response = await fetch(
    `${trimTrailingSlash(config.baseUrl)}/chat/completions`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: createShowrunnerSuggestionSystemPrompt() },
          {
            role: 'user',
            content: createShowrunnerSuggestionUserPrompt(parsed),
          },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 2_000,
        temperature: 0.75,
      }),
      signal: abortController.signal,
    },
  ).finally(() => clearTimeout(timeout));
  const json = (await response.json().catch(() => ({}))) as QwenChatResponse;

  if (!response.ok) {
    throw new BabyChainError(
      'qwen_cloud_request_failed',
      json.error?.message || 'Qwen Cloud next-scene request failed.',
      response.status,
    );
  }

  const content = json.choices?.[0]?.message?.content;
  const suggestionSet = NextPromptSuggestionSetSchema.parse(
    parseQwenJsonContent(content),
  );

  return {
    ...suggestionSet,
    provider: 'qwen-cloud',
    providerModel: config.model,
    warning: null,
  };
}

export function readQwenCloudConfig(): QwenCloudConfig | null {
  const apiKey =
    process.env.QWEN_CLOUD_API_KEY?.trim() ||
    process.env.DASHSCOPE_API_KEY?.trim();

  if (!apiKey) {
    return null;
  }

  const baseUrl =
    process.env.QWEN_CLOUD_BASE_URL?.trim() ||
    'https://dashscope.aliyuncs.com/compatible-mode/v1';
  const model = process.env.QWEN_CLOUD_MODEL?.trim() || 'qwen-plus';
  const url = new URL(baseUrl);

  if (url.protocol !== 'https:') {
    throw new BabyChainError(
      'invalid_qwen_cloud_config',
      'QWEN_CLOUD_BASE_URL must use HTTPS.',
      500,
    );
  }

  if (!isAllowedQwenBaseUrl(url)) {
    throw new BabyChainError(
      'invalid_qwen_cloud_config',
      'QWEN_CLOUD_BASE_URL must use a Qwen Cloud or DashScope host. Set QWEN_CLOUD_ALLOW_CUSTOM_BASE_URL=true only for an endpoint you control.',
      500,
    );
  }

  return { apiKey, baseUrl, model };
}

function isAllowedQwenBaseUrl(url: URL) {
  const hostname = url.hostname.toLowerCase();

  if (
    hostname === 'dashscope.aliyuncs.com' ||
    hostname.endsWith('.dashscope.aliyuncs.com') ||
    hostname === 'qwencloud.com' ||
    hostname.endsWith('.qwencloud.com')
  ) {
    return true;
  }

  return process.env.QWEN_CLOUD_ALLOW_CUSTOM_BASE_URL?.trim() === 'true';
}

function parseQwenJsonContent(content: unknown) {
  if (typeof content !== 'string') {
    throw new BabyChainError(
      'qwen_cloud_invalid_response',
      'Qwen Cloud returned an invalid next-scene response.',
      502,
    );
  }

  try {
    return JSON.parse(stripJsonFence(content));
  } catch {
    throw new BabyChainError(
      'qwen_cloud_invalid_response',
      'Qwen Cloud returned malformed next-scene JSON.',
      502,
    );
  }
}

function stripJsonFence(value: string) {
  return value
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/g, '');
}
