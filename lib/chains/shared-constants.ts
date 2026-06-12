export const VERCEL_PRO_FLUID_COMPUTE_MAX_DURATION_SECONDS = 800;

// BabySea v1 supports model-specific provider stacks. Some models have one or
// two providers; three is the worst-case fallback depth used for SLA budgeting.
export const BABYSEA_V1_MAX_PROVIDER_ATTEMPTS_PER_MODEL = 3;

export const BABYSEA_V1_IMAGE_TIMEOUT_SECONDS = {
  bufferPerAttempt: 6,
  gracePeriod: 6,
  providerTimeout: 60,
} as const;

export const BABYSEA_V1_VIDEO_TIMEOUT_SECONDS = {
  bufferPerAttempt: 8,
  gracePeriod: 8,
  providerTimeout: 250,
} as const;

export const BABYSEA_V1_STEP_MAX_DURATION_SECONDS = {
  image: providerFailoverBudgetSeconds(
    BABYSEA_V1_IMAGE_TIMEOUT_SECONDS,
    BABYSEA_V1_MAX_PROVIDER_ATTEMPTS_PER_MODEL,
  ),
  video: providerFailoverBudgetSeconds(
    BABYSEA_V1_VIDEO_TIMEOUT_SECONDS,
    BABYSEA_V1_MAX_PROVIDER_ATTEMPTS_PER_MODEL,
  ),
} as const;

export const BABYCHAIN_BACKEND_STACKS = {
  chain: {
    backendStack: ['image', 'video'],
    chainSlug: 'chain',
  },
} as const;

// BabyChain stays on the BabySea SDK path. Each processor/webhook invocation
// starts at most one BabySea generation. The route budget follows the longest
// single BabySea v1 worst-case call: video = 790s. Models with one- or
// two-provider stacks naturally complete inside that ceiling.
export const BABYCHAIN_SDK_ROUTE_MAX_DURATION_SECONDS =
  BABYSEA_V1_STEP_MAX_DURATION_SECONDS.video;
export const BABYCHAIN_SDK_REQUEST_TIMEOUT_MS =
  BABYCHAIN_SDK_ROUTE_MAX_DURATION_SECONDS * 1000;
export const BABYCHAIN_CRON_RUN_LIMIT = 1;

function providerFailoverBudgetSeconds(
  timeout: {
    bufferPerAttempt: number;
    gracePeriod: number;
    providerTimeout: number;
  },
  providerAttempts: number,
) {
  const failoverGrace = Math.max(providerAttempts - 1, 0) * timeout.gracePeriod;
  const buffer = providerAttempts * timeout.bufferPerAttempt;

  return providerAttempts * timeout.providerTimeout + failoverGrace + buffer;
}
