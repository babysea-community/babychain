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

  it('repairs invalid selected params once and records observability', async () => {
    setMinimalEnv();
    const responses = [
      {
        output: {
          message: {
            content: [
              {
                text: JSON.stringify({
                  observations: {},
                  suggestions: [
                    { title: 'Bad', prompt: 'Move too long.', params: {} },
                  ],
                  selected_prompt: 'Animate the frame.',
                  selected_params: {
                    generation_prompt: 'Animate the frame.',
                  },
                }),
              },
            ],
          },
        },
        usage: { inputTokens: 10, outputTokens: 20 },
      },
      {
        output: {
          message: {
            content: [
              {
                text: JSON.stringify({
                  observations: {},
                  suggestions: [
                    {
                      title: 'Dolly Drift',
                      prompt:
                        'A gentle handheld dolly follows her through the crosswalk as neon reflections slide across her hoodie, with small head turns and natural walking rhythm.',
                      params: {},
                    },
                    {
                      title: 'Street Pulse',
                      prompt:
                        'She moves past storefronts in a slow documentary tracking shot, background lights stretching into soft bokeh while her shoulders subtly shift with each step.',
                      params: {},
                    },
                    {
                      title: 'Quiet Turn',
                      prompt:
                        'The camera trails behind, then arcs slightly as she glances toward passing traffic, keeping the city alive with layered motion and shallow focus.',
                      params: {},
                    },
                  ],
                  selected_prompt:
                    'A gentle handheld dolly follows her through the crosswalk as neon reflections slide across her hoodie, with small head turns and natural walking rhythm.',
                  selected_params: {
                    generation_duration: 4,
                    generation_prompt:
                      'A gentle handheld dolly follows her through the crosswalk as neon reflections slide across her hoodie, with small head turns and natural walking rhythm.',
                  },
                }),
              },
            ],
          },
        },
        usage: { inputTokens: 11, outputTokens: 21 },
      },
    ];
    const fetchImpl = vi.fn(async () => Response.json(responses.shift()));

    const { createBedrockNovaAgent } =
      await import('@/lib/agents/bedrock-nova');
    const agent = createBedrockNovaAgent({
      apiKey: 'bedrock_test_key_12345678',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      modelIdentifier: 'us.amazon.nova-pro-v1:0',
      region: 'us-east-1',
    });
    const result = await agent.suggestNextStep({
      currentInput: {},
      flow: {
        currentStepKey: 'image',
        mode: 'autopilot',
        nextStepKey: 'video',
      },
      nextStep: {
        modelIdentifier: 'google/veo-3.1-lite',
        requestParams: null,
        schema: {
          type: 'object',
          required: ['generation_prompt', 'generation_duration'],
          properties: {
            generation_prompt: { type: 'string' },
            generation_duration: { type: 'number', minimum: 1, maximum: 8 },
          },
        },
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
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result.selectedParams).toMatchObject({
      generation_duration: 4,
      generation_prompt:
        'A gentle handheld dolly follows her through the crosswalk as neon reflections slide across her hoodie, with small head turns and natural walking rhythm.',
    });
    expect(result.observability).toMatchObject({
      model_identifier: 'us.amazon.nova-pro-v1:0',
      repair_attempted: true,
      request_count: 2,
      token_usage: { inputTokens: 21, outputTokens: 41 },
      validation: { ok: true },
    });
  });

  it('repairs unsupported scene drift from portrait context', async () => {
    setMinimalEnv();
    const connectedPrompt =
      'The young Japanese woman remains in the same color-film portrait setting, holding eye contact as the camera makes a slow handheld push-in; her bangs shift slightly, the shallow-focus background breathes with soft bokeh, and fine high-ISO grain flickers naturally.';
    const responses = [
      {
        output: {
          message: {
            content: [
              {
                text: JSON.stringify({
                  observations: {},
                  suggestions: [
                    {
                      title: 'Park Walk',
                      prompt:
                        'A young Japanese woman takes a peaceful walk through a park, occasionally stopping to appreciate flowers and greenery.',
                      params: {},
                    },
                    {
                      title: 'Garden Calm',
                      prompt:
                        'She wanders through a quiet garden path surrounded by flowers and soft greenery.',
                      params: {},
                    },
                    {
                      title: 'Green Escape',
                      prompt:
                        'The subject moves through a forest-like park with relaxed natural light.',
                      params: {},
                    },
                  ],
                  selected_prompt:
                    'A young Japanese woman takes a peaceful walk through a park, occasionally stopping to appreciate flowers and greenery.',
                  selected_params: {
                    generation_duration: 4,
                    generation_prompt:
                      'A young Japanese woman takes a peaceful walk through a park, occasionally stopping to appreciate flowers and greenery.',
                  },
                }),
              },
            ],
          },
        },
        usage: { inputTokens: 10, outputTokens: 20 },
      },
      {
        output: {
          message: {
            content: [
              {
                text: JSON.stringify({
                  observations: {},
                  suggestions: [
                    {
                      title: 'Portrait Breath',
                      prompt: connectedPrompt,
                      params: {},
                    },
                    {
                      title: 'Eye Contact Drift',
                      prompt:
                        'She stays in the same shallow-depth portrait as her eyes soften and the camera drifts closer, preserving the film grain and blurred surroundings.',
                      params: {},
                    },
                    {
                      title: 'Film Grain Hold',
                      prompt:
                        'The portrait gently comes alive with a tiny head turn, moving hair, and subtle focus breathing while the background remains abstract and blurred.',
                      params: {},
                    },
                  ],
                  selected_prompt: connectedPrompt,
                  selected_params: {
                    generation_duration: 4,
                    generation_prompt: connectedPrompt,
                  },
                }),
              },
            ],
          },
        },
        usage: { inputTokens: 11, outputTokens: 21 },
      },
    ];
    const fetchImpl = vi.fn(async () => Response.json(responses.shift()));

    const { createBedrockNovaAgent } =
      await import('@/lib/agents/bedrock-nova');
    const agent = createBedrockNovaAgent({
      apiKey: 'bedrock_test_key_12345678',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      modelIdentifier: 'us.amazon.nova-pro-v1:0',
      region: 'us-east-1',
    });
    const result = await agent.suggestNextStep({
      currentInput: {},
      flow: {
        currentStepKey: 'image',
        mode: 'autopilot',
        nextStepKey: 'video',
      },
      nextStep: {
        modelIdentifier: 'google/veo-3.1-lite',
        requestParams: null,
        schema: {
          type: 'object',
          required: ['generation_prompt', 'generation_duration'],
          properties: {
            generation_prompt: { type: 'string' },
            generation_duration: { type: 'number', minimum: 1, maximum: 8 },
          },
        },
        stepKey: 'video',
        stepKind: 'video',
      },
      previousStep: {
        modelIdentifier: 'bfl/flux-1.1-pro',
        outputFiles: [],
        requestParams: {
          generation_prompt:
            'A color film-inspired portrait of a young Japanese woman looking to the camera with a shallow depth of field that blurs the surrounding elements, drawing attention to her eyes. The fine grain and cast suggest a high ISO film stock, while the wide aperture lens creates a motion blur effect, enhancing the natural documentary style',
        },
        stepKey: 'image',
        stepKind: 'image',
      },
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result.selectedPrompt).toBe(connectedPrompt);
    expect(result.selectedPrompt).not.toContain('park');
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
