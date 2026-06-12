import { NextResponse } from 'next/server';

import { BabyChainError, toBabyChainError } from '../utils/errors';
import { getErrorGuidance } from '../utils/error-guidance';
import { captureServerError } from '../monitoring/sentry-server';

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function jsonAccepted<T>(data: T, init?: ResponseInit) {
  return jsonOk(data, { ...init, status: 202 });
}

export function jsonEnvelopeOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(
    {
      status: 'success',
      data,
      timestamp: new Date().toISOString(),
    },
    init,
  );
}

export async function jsonError(error: unknown) {
  const babyChainError = toBabyChainError(error);
  const guidance = getErrorGuidance({
    code: babyChainError.code,
    message: babyChainError.message,
  });

  if (babyChainError.status >= 500) {
    await captureServerError(error, {
      tags: {
        error_code: babyChainError.code,
        status: String(babyChainError.status),
      },
      extra: {
        details: babyChainError.details,
      },
    });
  }

  return NextResponse.json(
    {
      error: {
        type: getErrorType(babyChainError),
        code: babyChainError.code,
        message: babyChainError.message,
        ...(babyChainError.details ? { details: babyChainError.details } : {}),
        ...(guidance ? { guidance } : {}),
      },
    },
    { status: babyChainError.status },
  );
}

function getErrorType(error: BabyChainError) {
  if (error.code === 'idempotency_conflict') {
    return 'idempotency_error';
  }

  if (error.status === 401) {
    return 'authentication_error';
  }

  if (error.status === 403) {
    return 'permission_error';
  }

  if (error.status === 429) {
    return 'rate_limit_error';
  }

  if (error.status >= 500) {
    return 'api_error';
  }

  return 'invalid_request_error';
}

export function assertMethodToken(
  received: string | null,
  expected: string | undefined,
  label: string,
) {
  if (!expected) {
    return;
  }

  if (received !== `Bearer ${expected}`) {
    throw new BabyChainError('unauthorized', `Invalid ${label}.`, 401);
  }
}
