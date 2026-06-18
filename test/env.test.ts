import { afterEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

describe('env validation', () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.resetModules();
  });

  it('returns a structured configuration error for missing runtime variables', async () => {
    vi.resetModules();

    process.env = {
      ...ORIGINAL_ENV,
      BABYSEA_API_BASE_URL: 'https://api.us.babysea.ai',
      BABYSEA_API_KEY: 'bye_test',
      NEXT_PUBLIC_SITE_URL: 'https://your-domain.example.com',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/postgres',
    };

    for (const name of [
      'BABYCHAIN_API_KEY',
      'BABYCHAIN_CALLBACK_SECRET',
      'BABYCHAIN_CRON_SECRET',
    ]) {
      delete process.env[name];
    }

    const { getEnv } = await import('@/lib/utils/env');

    expect(() => getEnv()).toThrow(
      'BabyChain is missing required environment variables',
    );

    try {
      getEnv();
    } catch (error) {
      expect(error).toMatchObject({
        code: 'configuration_error',
        details: {
          missing: [
            'BABYCHAIN_API_KEY',
            'BABYCHAIN_CALLBACK_SECRET',
            'BABYCHAIN_CRON_SECRET',
          ],
        },
        status: 500,
      });
    }
  });

  it('resolves BYOK mode from server env provider keys', async () => {
    vi.resetModules();

    process.env = {
      ...ORIGINAL_ENV,
      NEXT_PUBLIC_SITE_URL: 'https://your-domain.example.com',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/postgres',
      BABYCHAIN_API_KEY: 'bchn_test_key',
      BABYCHAIN_CRON_SECRET: 'cron_test_secret',
      BABYCHAIN_CALLBACK_SECRET: 'callback_test_secret',
      BABYCHAIN_PROVIDER_MODE: 'byok',
      DASHSCOPE_API_KEY: 'dashscope_test_key_123',
      BFL_API_KEY: 'bfl_test_key_123',
      ARK_API_KEY: 'ark_test_key_123',
      GEMINI_API_KEY: 'gemini_test_key_123',
      GOOGLE_API_KEY: '',
      OPENAI_API_KEY: 'openai_test_key_123',
      RUNWAYML_API_SECRET: 'runway_test_secret_123',
    };

    const { resolveServerByokConfig } = await import('@/lib/providers');

    expect(resolveServerByokConfig()).toEqual({
      mode: 'server_env',
      providers: [
        'alibabacloud',
        'bfl',
        'byteplus',
        'google',
        'openai',
        'runway',
      ],
    });
  });

  it('resolves Google BYOK mode from GOOGLE_API_KEY alias', async () => {
    vi.resetModules();

    process.env = {
      ...ORIGINAL_ENV,
      NEXT_PUBLIC_SITE_URL: 'https://your-domain.example.com',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/postgres',
      BABYCHAIN_API_KEY: 'bchn_test_key',
      BABYCHAIN_CRON_SECRET: 'cron_test_secret',
      BABYCHAIN_CALLBACK_SECRET: 'callback_test_secret',
      BABYCHAIN_PROVIDER_MODE: 'byok',
      DASHSCOPE_API_KEY: '',
      BFL_API_BASE_URL: '',
      BFL_API_KEY: '',
      BFL_REGION: '',
      ARK_API_KEY: '',
      GEMINI_API_KEY: '',
      GOOGLE_API_KEY: 'google_test_key_123',
      OPENAI_API_KEY: '',
      RUNWAYML_API_SECRET: '',
    };

    const { resolveServerByokConfig } = await import('@/lib/providers');

    expect(resolveServerByokConfig()).toEqual({
      mode: 'server_env',
      providers: ['google'],
    });
  });

  it('resolves Alibaba Cloud BYOK mode from DashScope server env key', async () => {
    vi.resetModules();

    process.env = {
      ...ORIGINAL_ENV,
      NEXT_PUBLIC_SITE_URL: 'https://your-domain.example.com',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/postgres',
      BABYCHAIN_API_KEY: 'bchn_test_key',
      BABYCHAIN_CRON_SECRET: 'cron_test_secret',
      BABYCHAIN_CALLBACK_SECRET: 'callback_test_secret',
      BABYCHAIN_PROVIDER_MODE: 'byok',
      DASHSCOPE_API_KEY: 'dashscope_test_key_123',
      BFL_API_BASE_URL: '',
      BFL_API_KEY: '',
      BFL_REGION: '',
      ARK_API_KEY: '',
      GEMINI_API_KEY: '',
      GOOGLE_API_KEY: '',
      OPENAI_API_KEY: '',
      RUNWAYML_API_SECRET: '',
    };

    const { resolveServerByokConfig } = await import('@/lib/providers');

    expect(resolveServerByokConfig()).toEqual({
      mode: 'server_env',
      providers: ['alibabacloud'],
    });
  });

  it('defaults blank provider mode to BYOK', async () => {
    vi.resetModules();

    process.env = {
      ...ORIGINAL_ENV,
      ARK_API_KEY: '',
      BABYCHAIN_API_KEY: 'bchn_test_key',
      BABYCHAIN_CALLBACK_SECRET: 'callback_test_secret',
      BABYCHAIN_PROVIDER_MODE: '',
      BFL_API_BASE_URL: '',
      BFL_API_KEY: 'bfl_test_key_123',
      BFL_REGION: '',
      DASHSCOPE_API_KEY: '',
      GEMINI_API_KEY: '',
      GOOGLE_API_KEY: '',
      OPENAI_API_KEY: '',
      RUNWAYML_API_SECRET: '',
      BABYCHAIN_CRON_SECRET: 'cron_test_secret',
      NEXT_PUBLIC_SITE_URL: 'https://your-domain.example.com',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/postgres',
    };

    const { getEnv } = await import('@/lib/utils/env');
    const { resolveServerByokConfig } = await import('@/lib/providers');

    expect(getEnv().BABYCHAIN_PROVIDER_MODE).toBe('byok');
    expect(resolveServerByokConfig()).toEqual({
      mode: 'server_env',
      providers: ['bfl'],
    });
  });

  it('requires server provider keys in default BYOK mode', async () => {
    vi.resetModules();

    process.env = {
      ...ORIGINAL_ENV,
      NEXT_PUBLIC_SITE_URL: 'https://your-domain.example.com',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/postgres',
      BABYCHAIN_API_KEY: 'bchn_test_key',
      BABYCHAIN_CRON_SECRET: 'cron_test_secret',
      BABYCHAIN_CALLBACK_SECRET: 'callback_test_secret',
      BABYCHAIN_PROVIDER_MODE: '',
      DASHSCOPE_API_KEY: '',
      BFL_API_BASE_URL: '',
      BFL_API_KEY: '',
      BFL_REGION: '',
      ARK_API_KEY: '',
      GEMINI_API_KEY: '',
      GOOGLE_API_KEY: '',
      OPENAI_API_KEY: '',
      RUNWAYML_API_SECRET: '',
    };

    const { getEnv } = await import('@/lib/utils/env');
    const { resolveServerByokConfig } = await import('@/lib/providers');

    expect(getEnv().BABYCHAIN_PROVIDER_MODE).toBe('byok');
    expect(() => resolveServerByokConfig()).toThrow(
      'BABYCHAIN_PROVIDER_MODE=byok requires BFL_API_KEY, ARK_API_KEY, DASHSCOPE_API_KEY, GEMINI_API_KEY or GOOGLE_API_KEY, OPENAI_API_KEY, or RUNWAYML_API_SECRET',
    );
  });

  it('rejects the removed auto provider mode', async () => {
    vi.resetModules();

    process.env = {
      ...ORIGINAL_ENV,
      BABYCHAIN_API_KEY: 'bchn_test_key',
      BABYCHAIN_CALLBACK_SECRET: 'callback_test_secret',
      BABYCHAIN_PROVIDER_MODE: 'auto',
      BFL_API_KEY: 'bfl_test_key_123',
      OPENAI_API_KEY: '',
      BABYCHAIN_CRON_SECRET: 'cron_test_secret',
      NEXT_PUBLIC_SITE_URL: 'https://your-domain.example.com',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/postgres',
    };

    const { getEnv } = await import('@/lib/utils/env');

    expect(() => getEnv()).toThrow(
      'BabyChain environment variables are invalid.',
    );
  });
});
