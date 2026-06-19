import type { Metadata } from 'next';
import { NextRequest } from 'next/server';

import { GET as getRunRoute } from '@/app/api/v1/chains/get/[runId]/route';
import { POST as createRunRoute } from '@/app/api/v1/chains/runs/route';
import { requireOwnerSession } from '@/lib/auth/owner';
import { formatPublicModelName } from '@/lib/models/display';
import type { ModelProvider } from '@/lib/models/model-catalog';
import { listModelCatalog } from '@/lib/models/model-library';
import {
  isImageChainModel,
  isImageToVideoChainModel,
  isTextToImageCapableModel,
  isVideoToVideoChainModel,
} from '@/lib/models/semantic-schema';
import type { ByokProviderName } from '@/lib/providers';
import {
  createNextPromptSuggestionsWithFallback,
  createQwenNextPromptSuggestions,
  mapStorySceneToChainInput,
  readQwenCloudConfig,
  StorySceneRunDraftSchema,
  SuggestNextPromptsInputSchema,
} from '@/lib/showrunner';
import { BabyChainError } from '@/lib/utils/errors';
import {
  getBabyChainApiKeys,
  getEnv,
  type BabyChainEnv,
} from '@/lib/utils/env';

import { StoryClient } from './story-client';
import type {
  StoryModelOption,
  StoryRunActionResult,
  StorySuggestActionResult,
} from './story-client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Story' };

const INTERNAL_ROUTE_ORIGIN = 'http://localhost';
type InternalRequestInit = ConstructorParameters<typeof NextRequest>[1];

type StoryRuntimeConfig = {
  byokProviders: ByokProviderName[];
  providerMode: 'babysea' | 'byok';
};

const PROVIDER_LABELS: Record<string, string> = {
  'alibaba-cloud': 'Alibaba Cloud',
  'black-forest-labs': 'Black Forest Labs',
  byteplus: 'BytePlus',
  google: 'Google',
  openai: 'OpenAI',
  runway: 'Runway',
};

async function runStorySceneAction(
  input: Record<string, unknown>,
  metadata: Record<string, unknown>,
): Promise<StoryRunActionResult> {
  'use server';
  await requireOwnerSession();

  try {
    const draft = StorySceneRunDraftSchema.parse(input);
    const response = await createRunRoute(
      internalRequest('/api/v1/chains/runs', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${callerKey()}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          input: mapStorySceneToChainInput(draft),
          metadata: {
            ...metadata,
            source: 'babychain-interactive-showrunner',
          },
        }),
        cache: 'no-store',
      }),
    );
    const json = (await response.json()) as Record<string, unknown>;

    if (!response.ok) {
      return { ok: false, error: extractError(json) };
    }

    return { ok: true, run: json };
  } catch (error) {
    return { ok: false, error: formatStoryActionError(error) };
  }
}

async function getStoryRunAction(runId: string): Promise<StoryRunActionResult> {
  'use server';
  await requireOwnerSession();

  try {
    const response = await getRunRoute(
      internalRequest(`/api/v1/chains/get/${encodeURIComponent(runId)}`, {
        method: 'GET',
        headers: {
          authorization: `Bearer ${callerKey()}`,
        },
        cache: 'no-store',
      }),
      { params: { runId } },
    );
    const json = (await response.json()) as Record<string, unknown>;

    if (!response.ok) {
      return { ok: false, error: extractError(json) };
    }

    return { ok: true, run: json };
  } catch (error) {
    return { ok: false, error: formatStoryActionError(error) };
  }
}

async function suggestNextPromptsAction(
  input: Record<string, unknown>,
): Promise<StorySuggestActionResult> {
  'use server';
  await requireOwnerSession();

  try {
    const parsed = SuggestNextPromptsInputSchema.parse(input);
    const { useQwen, warning } = readQwenSuggestionState();
    const result = await createNextPromptSuggestionsWithFallback(parsed, {
      provider: createQwenNextPromptSuggestions,
      useQwen,
      warning,
    });

    return { ok: true, result };
  } catch (error) {
    return { ok: false, error: formatStoryActionError(error) };
  }
}

export default async function StoryPage() {
  await requireOwnerSession();
  const env = getEnv();
  const runtime: StoryRuntimeConfig = {
    byokProviders:
      env.BABYCHAIN_PROVIDER_MODE === 'byok'
        ? configuredByokProvidersForStory(env)
        : [],
    providerMode: env.BABYCHAIN_PROVIDER_MODE === 'byok' ? 'byok' : 'babysea',
  };
  const modelOptions = listStoryModelOptions(runtime);
  const qwenConfig = readOptionalQwenConfig();

  return (
    <StoryClient
      defaultDraft={{
        editInstruction: '',
        imagePrompt: '',
        prompt:
          'A night market courier receives a delivery from tomorrow and opens it under neon rain.',
        settings: {
          durationSeconds: 5,
          imageModel: firstAvailable(modelOptions.imageModels, 'qwen/image'),
          modifyModel: '',
          videoModel: firstAvailable(
            modelOptions.videoModels,
            'happyhorse/1.0-i2v',
          ),
          visualFormat: '16:9 cinematic frame, neon-lit realism',
        },
        videoPrompt: '',
      }}
      getStoryRunAction={getStoryRunAction}
      modelOptions={modelOptions}
      providerMode={runtime.providerMode}
      qwenConfigured={qwenConfig !== null}
      qwenModel={qwenConfig?.model ?? 'qwen-plus'}
      runStorySceneAction={runStorySceneAction}
      suggestNextPromptsAction={suggestNextPromptsAction}
    />
  );
}

function listStoryModelOptions(runtime: StoryRuntimeConfig) {
  const imageModels: StoryModelOption[] = [];
  const videoModels: StoryModelOption[] = [];
  const modifyModels: StoryModelOption[] = [];

  for (const entry of listModelCatalog()) {
    const option = toStoryModelOption(entry, runtime);

    if (entry.kind === 'image') {
      if (isImageChainModel(entry.modelIdentifier)) {
        const textToImage = isTextToImageCapableModel(entry.modelIdentifier);
        imageModels.push({
          ...option,
          available: option.available && textToImage,
          unavailableReason: textToImage
            ? option.unavailableReason
            : 'This image model needs a starting image, so it is not available for story generation.',
        });
      }

      continue;
    }

    if (isImageToVideoChainModel(entry.modelIdentifier)) {
      videoModels.push(option);
    }

    if (isVideoToVideoChainModel(entry.modelIdentifier)) {
      modifyModels.push(option);
    }
  }

  return {
    imageModels: sortModelOptions(imageModels),
    modifyModels: sortModelOptions(modifyModels),
    videoModels: sortModelOptions(videoModels),
  };
}

function toStoryModelOption(
  entry: ReturnType<typeof listModelCatalog>[number],
  runtime: StoryRuntimeConfig,
): StoryModelOption {
  const providerName = byokProviderName(entry.provider);
  const available =
    runtime.providerMode === 'babysea'
      ? entry.babyseaCompatible !== false
      : runtime.byokProviders.includes(providerName);

  return {
    available,
    id: entry.modelIdentifier,
    label: formatPublicModelName(entry.modelIdentifier),
    providerLabel: PROVIDER_LABELS[entry.provider] ?? entry.provider,
    unavailableReason: available
      ? null
      : runtime.providerMode === 'babysea'
        ? 'This model requires BYOK mode.'
        : `${PROVIDER_LABELS[entry.provider] ?? entry.provider} API key is not configured.`,
  };
}

function sortModelOptions(options: StoryModelOption[]) {
  return [...options].sort((left, right) => {
    if (left.available !== right.available) {
      return left.available ? -1 : 1;
    }

    return left.label.localeCompare(right.label);
  });
}

function byokProviderName(provider: ModelProvider): ByokProviderName {
  switch (provider) {
    case 'alibaba-cloud':
      return 'alibabacloud';
    case 'black-forest-labs':
      return 'bfl';
    case 'byteplus':
    case 'google':
    case 'openai':
    case 'runway':
      return provider;
  }
}

function configuredByokProvidersForStory(env: BabyChainEnv) {
  const providers: ByokProviderName[] = [];

  if (env.DASHSCOPE_API_KEY) providers.push('alibabacloud');
  if (env.BFL_API_KEY) providers.push('bfl');
  if (env.ARK_API_KEY) providers.push('byteplus');
  if (env.GOOGLE_API_KEY || env.GEMINI_API_KEY) providers.push('google');
  if (env.OPENAI_API_KEY) providers.push('openai');
  if (env.RUNWAYML_API_SECRET) providers.push('runway');

  return providers;
}

function firstAvailable(options: StoryModelOption[], fallback: string) {
  return options.find((option) => option.available)?.id ?? fallback;
}

function readOptionalQwenConfig() {
  try {
    return readQwenCloudConfig();
  } catch {
    return null;
  }
}

function readQwenSuggestionState() {
  try {
    return { useQwen: readQwenCloudConfig() !== null, warning: null };
  } catch (error) {
    return {
      useQwen: false,
      warning: `Qwen Cloud config was ignored. ${formatStoryActionError(error)}`,
    };
  }
}

function callerKey(): string {
  const key = getBabyChainApiKeys()[0];

  if (!key) {
    throw new Error('BABYCHAIN_API_KEY is not configured.');
  }

  return key;
}

function internalRequest(path: string, init?: InternalRequestInit) {
  return new NextRequest(new URL(path, INTERNAL_ROUTE_ORIGIN), init);
}

function extractError(json: Record<string, unknown>) {
  const error = json.error;

  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }

  return 'Run failed.';
}

function formatStoryActionError(error: unknown) {
  if (error instanceof BabyChainError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Showrunner action failed.';
}
