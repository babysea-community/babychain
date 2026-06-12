import type { NextRequest } from 'next/server';

import { parseSchema, readJsonBody } from '@/lib/api';
import { processRun } from '@/lib/chains/runner';
import { CronRequestSchema } from '@/lib/chains/schemas';
import { createChainStore } from '@/lib/chains/store';
import { getEnv } from '@/lib/utils/env';
import { BabyChainError, toErrorMessage } from '@/lib/utils/errors';
import { jsonEnvelopeOk, jsonError } from '@/lib/security/http';

export const dynamic = 'force-dynamic';
// Keep in sync with BABYCHAIN_SDK_ROUTE_MAX_DURATION_SECONDS.
// Ideally the `maxDuration` should be 790 to match BABYCHAIN_SDK_ROUTE_MAX_DURATION_SECONDS,
// but 300 fits Vercel free-plan limits.
export const maxDuration = 300;
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  return handleCron(request, readLimitFromQuery(request));
}

export async function POST(request: NextRequest) {
  try {
    return await handleCron(request, await readJsonBody(request));
  } catch (error) {
    return await jsonError(error);
  }
}

async function handleCron(request: NextRequest, rawInput: unknown) {
  try {
    const env = getEnv();

    if (!env.BABYCHAIN_CRON_SECRET) {
      throw new BabyChainError(
        'cron_not_configured',
        'BABYCHAIN_CRON_SECRET is required.',
        500,
      );
    }

    if (
      request.headers.get('authorization') !==
      `Bearer ${env.BABYCHAIN_CRON_SECRET}`
    ) {
      throw new BabyChainError('unauthorized', 'Invalid cron token.', 401);
    }

    const input = parseSchema(CronRequestSchema, rawInput);
    const store = createChainStore();
    const runs = await store.findRunsToProcess(input.limit);
    const processed: Array<{
      id: string;
      status: string;
      error?: string;
    }> = [];

    // Isolate per-run failures so a single transient BabySea/database error
    // does not abort processing of the remaining runs in this batch.
    for (const run of runs) {
      try {
        const record = await processRun(run, { store });
        processed.push({ id: record.run.id, status: record.run.status });
      } catch (error) {
        processed.push({
          id: run.run.id,
          status: run.run.status,
          error: toErrorMessage(error).slice(0, 500),
        });
      }
    }

    return jsonEnvelopeOk(
      { processed, processed_count: processed.length },
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch (error) {
    return await jsonError(error);
  }
}

function readLimitFromQuery(request: NextRequest) {
  return {
    limit: request.nextUrl.searchParams.get('limit') ?? undefined,
  };
}
