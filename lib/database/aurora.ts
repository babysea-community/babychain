import 'server-only';

import { Pool, type PoolClient, type QueryResultRow } from 'pg';

/**
 * AWS Aurora (PostgreSQL) connection pool.
 *
 * `DATABASE_URL` points at the Aurora cluster writer endpoint. The pool is
 * cached on `globalThis` so Next.js hot reloads and serverless warm starts
 * reuse a single pool instead of exhausting Aurora connection slots.
 */
declare global {
  // Cached pool across hot reloads / warm starts.
  var __babychainAuroraPool: Pool | undefined;
}

function resolveSsl(
  connectionString: string,
): false | { rejectUnauthorized: boolean } {
  const explicit = process.env.DATABASE_SSL?.trim().toLowerCase();

  if (explicit === 'disable' || explicit === 'false' || explicit === 'off') {
    return false;
  }

  // Aurora requires TLS; skip it only for obvious local connections.
  if (!explicit && /@(localhost|127\.0\.0\.1)(:|\/)/.test(connectionString)) {
    return false;
  }

  return { rejectUnauthorized: false };
}

/**
 * Remove ssl-related query params so pg uses our explicit `ssl` option rather
 * than strict cert verification (Aurora presents an RDS CA not in the system
 * trust store).
 */
function stripSslParams(connectionString: string): string {
  try {
    const url = new URL(connectionString);
    for (const key of ['sslmode', 'ssl', 'uselibpqcompat']) {
      url.searchParams.delete(key);
    }
    return url.toString();
  } catch {
    return connectionString;
  }
}

export function getAuroraPool(): Pool {
  if (globalThis.__babychainAuroraPool) {
    return globalThis.__babychainAuroraPool;
  }

  const connectionString = process.env.DATABASE_URL?.trim();

  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set. Point it at your AWS Aurora (PostgreSQL) cluster endpoint.',
    );
  }

  const pool = new Pool({
    connectionString: stripSslParams(connectionString),
    ssl: resolveSsl(connectionString),
    max: Number(process.env.DATABASE_POOL_MAX) || 5,
    idleTimeoutMillis: 30_000,
    // Aurora Serverless can cold-start (paused cluster waking up) and the first
    // connection may take 10-20s. Use a generous timeout so the initial run
    // does not fail with an "Internal server error".
    connectionTimeoutMillis: 30_000,
    keepAlive: true,
  });

  pool.on('error', (error) => {
    console.error('[aurora] idle client error', error);
  });

  globalThis.__babychainAuroraPool = pool;
  return pool;
}

export async function auroraQuery<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: ReadonlyArray<unknown> = [],
) {
  return getAuroraPool().query<T>(text, params as unknown[]);
}

export async function auroraTransaction<T>(
  handler: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getAuroraPool().connect();

  try {
    await client.query('BEGIN');
    const result = await handler(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function pingAurora(): Promise<boolean> {
  try {
    await auroraQuery('select 1');
    return true;
  } catch (error) {
    console.error('[aurora] ping failed', error);
    return false;
  }
}
