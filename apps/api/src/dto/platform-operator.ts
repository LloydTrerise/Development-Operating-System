import type { PlatformOperator } from '@devos/domain';
import { BadRequestError } from '../http/errors.js';

export function toPlatformOperatorDto(operator: PlatformOperator) {
  return {
    principalId: operator.principalId,
    grantedAt: operator.grantedAt,
    grantedByPrincipalId: operator.grantedByPrincipalId,
  };
}

function asRecord(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null) {
    throw new BadRequestError('Request body must be a JSON object.');
  }
  return body as Record<string, unknown>;
}

export interface GrantPlatformOperatorBody {
  principalId: string;
}

export function parseGrantPlatformOperatorBody(body: unknown): GrantPlatformOperatorBody {
  const { principalId } = asRecord(body);

  if (typeof principalId !== 'string' || principalId.trim().length === 0) {
    throw new BadRequestError('principalId is required.');
  }

  return { principalId };
}
