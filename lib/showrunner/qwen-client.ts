import 'server-only';

import { BabyChainError } from '@/lib/utils/errors';

import {
  createShowrunnerSystemPrompt,
  createShowrunnerUserPrompt,
} from './prompts';
import {
  ShowrunnerBriefSchema,
  parseShowrunnerPlanForBrief,
  type ShowrunnerPlanResult,
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

export type QwenCloudConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

export async function createQwenShowrunnerPlan(
  input: unknown,
): Promise<ShowrunnerPlanResult> {
  const brief = ShowrunnerBriefSchema.parse(input);
  const config = readQwenCloudConfig();

  if (!config) {
    throw new BabyChainError(
      'qwen_cloud_not_configured',
      'Set QWEN_CLOUD_API_KEY or DASHSCOPE_API_KEY to generate a Qwen Cloud showrunner plan.',
      500,
    );
  }

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
          { role: 'system', content: createShowrunnerSystemPrompt() },
          { role: 'user', content: createShowrunnerUserPrompt(brief) },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 2_500,
        temperature: 0.7,
      }),
    },
  );
  const json = (await response.json().catch(() => ({}))) as QwenChatResponse;

  if (!response.ok) {
    throw new BabyChainError(
      'qwen_cloud_request_failed',
      json.error?.message || 'Qwen Cloud showrunner request failed.',
      response.status,
    );
  }

  const content = json.choices?.[0]?.message?.content;
  const parsed = parseQwenJsonContent(content);

  return {
    plan: parseShowrunnerPlanForBrief(parsed, brief),
    provider: 'qwen-cloud',
    providerModel: config.model,
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
      'Qwen Cloud returned an invalid showrunner response.',
      502,
    );
  }

  try {
    return JSON.parse(stripJsonFence(content));
  } catch {
    throw new BabyChainError(
      'qwen_cloud_invalid_response',
      'Qwen Cloud returned malformed showrunner JSON.',
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
