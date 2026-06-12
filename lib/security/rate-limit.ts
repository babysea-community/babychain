import 'server-only';

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

import { BabyChainError } from '../utils/errors';
import { getEnv } from '../utils/env';

let limiterCache: {
  limit: number;
  limiter: Ratelimit;
} | null = null;

export async function assertRateLimit(key: string, limitPerMinute: number) {
  const limiter = getLimiter(limitPerMinute);
  const result = await limiter.limit(key);

  if (!result.success) {
    throw new BabyChainError('rate_limited', 'Rate limit exceeded.', 429, {
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    });
  }
}

function getLimiter(limitPerMinute: number) {
  if (limiterCache?.limit === limitPerMinute) {
    return limiterCache.limiter;
  }

  const env = getEnv();
  const redis = new Redis({
    token: env.UPSTASH_REDIS_REST_TOKEN,
    url: env.UPSTASH_REDIS_REST_URL,
  });
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limitPerMinute, '1 m'),
    analytics: false,
    prefix: 'babychain',
  });

  limiterCache = { limit: limitPerMinute, limiter };
  return limiter;
}
