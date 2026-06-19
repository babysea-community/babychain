import { afterEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

describe('Bedrock Nova Chain Agent', () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.resetModules();
  });

  it('defaults to a Nova inference profile model id', async () => {
    setMinimalEnv();

    const { defaultBedrockNovaModelIdentifier } =
      await import('@/lib/agents/bedrock-nova');

    expect(defaultBedrockNovaModelIdentifier()).toBe('us.amazon.nova-pro-v1:0');
  });

  it('includes the Bedrock validation message when Converse fails', async () => {
    setMinimalEnv();
    const fetchImpl = vi.fn(async () =>
      Response.json(
        {
          message:
            'Invocation of model ID amazon.nova-premier-v1:0 with on-demand throughput is not supported. Retry your request with the ID or ARN of an inference profile that contains this model.',
        },
        { status: 400 },
      ),
    ) as unknown as typeof fetch;

    const { createBedrockNovaAgent } =
      await import('@/lib/agents/bedrock-nova');
    const agent = createBedrockNovaAgent({
      apiKey: 'bedrock_test_key_12345678',
      fetchImpl,
      modelIdentifier: 'amazon.nova-premier-v1:0',
      region: 'us-east-1',
    });

    await expect(
      agent.suggestNextStep({
        currentInput: {},
        flow: {
          currentStepKey: 'image',
          mode: 'review',
          nextStepKey: 'video',
        },
        nextStep: {
          modelIdentifier: 'google/veo-3.1-lite',
          requestParams: null,
          stepKey: 'video',
          stepKind: 'video',
        },
        previousStep: {
          modelIdentifier: 'bfl/flux-1.1-pro',
          outputFiles: [],
          requestParams: { generation_prompt: 'A product render' },
          stepKey: 'image',
          stepKind: 'image',
        },
      }),
    ).rejects.toMatchObject({
      code: 'chain_agent_failed',
      message: expect.stringContaining('inference profile'),
      status: 502,
    });
  });
});

function setMinimalEnv() {
  process.env = {
    ...ORIGINAL_ENV,
    BABYCHAIN_API_KEY: 'bchn_test_key',
    BABYCHAIN_CALLBACK_SECRET: 'callback_test_secret',
    BABYCHAIN_CRON_SECRET: 'cron_test_secret',
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/postgres',
    NEXT_PUBLIC_SITE_URL: 'https://your-domain.example.com',
  };
}
