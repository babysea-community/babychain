import { describe, expect, it } from 'vitest';

import {
  BABYCHAIN_BACKEND_STACKS,
  BABYCHAIN_CRON_RUN_LIMIT,
  BABYCHAIN_SDK_REQUEST_TIMEOUT_MS,
  BABYCHAIN_SDK_ROUTE_MAX_DURATION_SECONDS,
  BABYSEA_V1_STEP_MAX_DURATION_SECONDS,
  VERCEL_PRO_FLUID_COMPUTE_MAX_DURATION_SECONDS,
} from '@/lib/chains/shared-constants';
import { CronRequestSchema } from '@/lib/chains/schemas';

describe('BabyChain topology constants', () => {
  it('captures BabySea v1 worst-case route budgets', () => {
    expect(BABYSEA_V1_STEP_MAX_DURATION_SECONDS.image).toBe(210);
    expect(BABYSEA_V1_STEP_MAX_DURATION_SECONDS.video).toBe(790);
  });

  it('keeps BabyChain on the SDK happy path with one BabySea step per invocation', () => {
    expect(BABYCHAIN_BACKEND_STACKS.chain.backendStack).toEqual([
      'image',
      'video',
    ]);
    expect(BABYCHAIN_BACKEND_STACKS.chain.chainSlug).toBe('chain');
    expect(BABYCHAIN_SDK_ROUTE_MAX_DURATION_SECONDS).toBe(790);
    expect(BABYCHAIN_SDK_ROUTE_MAX_DURATION_SECONDS).toBeLessThanOrEqual(
      VERCEL_PRO_FLUID_COMPUTE_MAX_DURATION_SECONDS,
    );
    expect(BABYCHAIN_SDK_REQUEST_TIMEOUT_MS).toBe(790_000);
  });

  it('keeps cron batches to one run per invocation', () => {
    expect(BABYCHAIN_CRON_RUN_LIMIT).toBe(1);
    expect(CronRequestSchema.parse({})).toEqual({ limit: 1 });
    expect(() => CronRequestSchema.parse({ limit: 2 })).toThrow();
  });
});
