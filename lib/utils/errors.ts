export class BabyChainError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number = 500,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'BabyChainError';
  }
}

export function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown error';
}

export function toBabyChainError(error: unknown) {
  if (error instanceof BabyChainError) {
    return error;
  }

  if (isDatabaseNetworkError(error)) {
    return new BabyChainError(
      'database_unreachable',
      'Database is not reachable from this runtime. Check DATABASE_URL, Aurora public access, and security group inbound TCP 5432.',
      503,
      databaseNetworkDetails(error),
    );
  }

  return new BabyChainError('internal_error', 'Internal server error.', 500);
}

const DATABASE_NETWORK_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ENETUNREACH',
  'EHOSTUNREACH',
  'ETIMEDOUT',
  'ECONNRESET',
]);

function isDatabaseNetworkError(error: unknown): error is object {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const message = error instanceof Error ? error.message : '';

  if (message === 'Connection terminated due to connection timeout') {
    return true;
  }

  const code = 'code' in error ? error.code : undefined;
  const syscall = 'syscall' in error ? error.syscall : undefined;
  const port = 'port' in error ? error.port : undefined;

  return (
    typeof code === 'string' &&
    DATABASE_NETWORK_ERROR_CODES.has(code) &&
    syscall === 'connect' &&
    port === 5432
  );
}

function databaseNetworkDetails(error: object) {
  const code =
    'code' in error && typeof error.code === 'string'
      ? error.code
      : 'CONNECTION_TIMEOUT';

  return { code };
}
