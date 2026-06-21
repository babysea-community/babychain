import { NextResponse } from 'next/server';

import { pingAurora } from '@/lib/database/aurora';
import { jsonEnvelopeOk } from '@/lib/security/http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Liveness + database readiness probe.
 *
 * Unlike `/api/v1/models` (which serves the in-process Semantic Lady catalog
 * and stays healthy even when Aurora is unreachable), this endpoint pings the
 * database so orchestrators can detect and replace a node that has lost its
 * connection. Returns 200 when the database responds and 503 otherwise. No
 * authentication so load balancers and container health checks can call it.
 */
export async function GET() {
  const database = await pingAurora();

  if (!database) {
    return NextResponse.json(
      {
        status: 'error',
        data: { service: 'babychain', database: 'unreachable' },
        timestamp: new Date().toISOString(),
      },
      { status: 503, headers: { 'cache-control': 'no-store' } },
    );
  }

  return jsonEnvelopeOk(
    { service: 'babychain', database: 'ok' },
    { headers: { 'cache-control': 'no-store' } },
  );
}
