import { z } from 'zod';

import { BabyChainError } from './errors';

const BABYSEA_API_HOSTS = new Set([
  'api.us.babysea.ai',
  'api.eu.babysea.ai',
  'api.jp.babysea.ai',
]);

const OptionalNonEmptyStringSchema = z.preprocess(
  emptyStringToUndefined,
  z.string().trim().min(1).optional(),
);
const OptionalProviderKeySchema = z.preprocess(
  emptyStringToUndefined,
  z.string().trim().min(8).max(512).optional(),
);
const OptionalLongSecretSchema = z.preprocess(
  emptyStringToUndefined,
  z.string().trim().min(8).max(8192).optional(),
);
const OptionalUrlSchema = z.preprocess(
  emptyStringToUndefined,
  z.string().trim().url().optional(),
);

const EnvSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().trim().url(),
  /**
   * BabySea SDK credentials. Optional — leave unset for BYOK deployments.
   * Required only when `BABYCHAIN_PROVIDER_MODE=babysea`.
   */
  BABYSEA_API_KEY: OptionalNonEmptyStringSchema,
  BABYSEA_REGION: z.preprocess(
    emptyStringToUndefined,
    z.enum(['us', 'eu', 'jp']).optional(),
  ),
  BABYSEA_API_BASE_URL: OptionalUrlSchema,
  BABYSEA_WEBHOOK_SECRET: OptionalNonEmptyStringSchema,
  BABYCHAIN_API_KEY: z.string().trim().min(1),
  BABYCHAIN_CALLBACK_SECRET: z.string().trim().min(1),
  BABYCHAIN_CRON_SECRET: z.string().trim().min(1),
  BABYCHAIN_PROVIDER_MODE: z.preprocess(
    emptyStringToUndefined,
    z.enum(['byok', 'babysea']).default('byok'),
  ),
  DATABASE_URL: z.string().trim().min(1),
  /**
   * Server-side provider keys for BYOK mode. These are never accepted from
   * public API requests and are never persisted to the database.
   */
  // Alibaba Cloud
  DASHSCOPE_API_KEY: OptionalProviderKeySchema,
  // Black Forest Labs
  BFL_API_KEY: OptionalProviderKeySchema,
  BFL_REGION: z.preprocess(
    emptyStringToUndefined,
    z.enum(['global', 'eu', 'us']).optional(),
  ),
  BFL_API_BASE_URL: OptionalUrlSchema,
  // BytePlus
  ARK_API_KEY: OptionalProviderKeySchema,
  // Google
  GEMINI_API_KEY: OptionalProviderKeySchema,
  GOOGLE_API_KEY: OptionalProviderKeySchema,
  // OpenAI
  OPENAI_API_KEY: OptionalProviderKeySchema,
  // Runway
  RUNWAYML_API_SECRET: OptionalProviderKeySchema,
  // AWS Bedrock/Amazon Nova for Chain Agent
  AWS_BEARER_TOKEN_BEDROCK: OptionalLongSecretSchema,
  BEDROCK_REGION: OptionalNonEmptyStringSchema,
  BEDROCK_NOVA_AGENT_MODEL: OptionalNonEmptyStringSchema,
  /**
   * Optional. When `on`, the Chain Agent system prompt includes a compact
   * illustrative image-to-video few-shot exemplar. Off by default to keep
   * prompts lean and avoid biasing output toward the example.
   */
  BEDROCK_NOVA_AGENT_EXEMPLAR: z.preprocess(
    emptyStringToUndefined,
    z.enum(['off', 'on']).default('off'),
  ),
  BABYCHAIN_STORAGE_PROVIDER: z.preprocess(
    emptyStringToUndefined,
    z.enum(['none', 'vercel-blob', 'aws-s3']).default('none'),
  ),
  BLOB_READ_WRITE_TOKEN: OptionalLongSecretSchema,
  AWS_S3_REGION: OptionalNonEmptyStringSchema,
  AWS_S3_BUCKET_NAME: OptionalNonEmptyStringSchema,
  AWS_S3_ACCESS_KEY_ID: OptionalNonEmptyStringSchema,
  AWS_S3_SECRET_ACCESS_KEY: OptionalLongSecretSchema,
  AWS_S3_ENDPOINT_URL: OptionalUrlSchema,
});

export type BabyChainEnv = z.infer<typeof EnvSchema>;

let cachedEnv: BabyChainEnv | null = null;

export function getEnv() {
  if (cachedEnv) {
    return cachedEnv;
  }

  const result = EnvSchema.safeParse(process.env);

  if (!result.success) {
    throw toConfigurationError(result.error);
  }

  const parsed = result.data;
  const baseUrl = parsed.BABYSEA_API_BASE_URL?.trim();

  if (baseUrl) {
    const url = new URL(baseUrl);

    if (url.protocol !== 'https:') {
      throw new Error('BABYSEA_API_BASE_URL must use HTTPS.');
    }

    if (!BABYSEA_API_HOSTS.has(url.hostname.toLowerCase())) {
      throw new Error('BABYSEA_API_BASE_URL must be a BabySea API host.');
    }
  }

  const bflBase = parsed.BFL_API_BASE_URL?.trim();
  if (bflBase) {
    const url = new URL(bflBase);
    if (url.protocol !== 'https:') {
      throw new Error('BFL_API_BASE_URL must use HTTPS.');
    }
    if (!url.hostname.toLowerCase().endsWith('.bfl.ai')) {
      throw new Error('BFL_API_BASE_URL host must end with .bfl.ai.');
    }
  }

  cachedEnv = parsed;
  return parsed;
}

function toConfigurationError(error: z.ZodError) {
  const missing = error.issues
    .filter(isMissingEnvIssue)
    .map((issue) => issue.path.join('.'))
    .filter(Boolean);
  const invalid = error.issues
    .filter((issue) => !missing.includes(issue.path.join('.')))
    .map((issue) => issue.path.join('.'))
    .filter(Boolean);
  const message = missing.length
    ? `BabyChain is missing required environment variables: ${missing.join(', ')}.`
    : 'BabyChain environment variables are invalid.';

  return new BabyChainError('configuration_error', message, 500, {
    invalid,
    missing,
  });
}

function isMissingEnvIssue(issue: z.ZodIssue) {
  return (
    issue.code === 'invalid_type' &&
    ((issue as { input?: unknown }).input === undefined ||
      (issue as { received?: string }).received === 'undefined')
  );
}

export function getBabyChainApiKeys() {
  const apiKeys = getEnv()
    .BABYCHAIN_API_KEY.split(/[\n,]/)
    .map((value) => value.trim())
    .filter(Boolean);

  const prefixes = new Set<string>();

  for (const apiKey of apiKeys) {
    const prefix = apiKey.length <= 12 ? apiKey : apiKey.slice(0, 12);

    if (prefixes.has(prefix)) {
      throw new Error(
        'BABYCHAIN_API_KEY must have unique 12-character prefixes.',
      );
    }

    prefixes.add(prefix);
  }

  return apiKeys;
}

function emptyStringToUndefined(value: unknown) {
  return value === '' || value === null ? undefined : value;
}
