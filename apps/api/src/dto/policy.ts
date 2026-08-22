import type { Policy } from '@devos/domain';
import { BadRequestError } from '../http/errors.js';

export function toPolicyDto(policy: Policy) {
  return {
    id: policy.id,
    organisationId: policy.organisationId,
    projectId: policy.projectId,
    key: policy.key,
    version: policy.version,
    status: policy.status,
    definition: policy.definition,
    createdBy: policy.createdBy,
    publishedAt: policy.publishedAt,
    createdAt: policy.createdAt,
  };
}

function asRecord(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null) {
    throw new BadRequestError('Request body must be a JSON object.');
  }
  return body as Record<string, unknown>;
}

export interface CreatePolicyBody {
  key: string;
  definition: Record<string, unknown>;
}

export function parseCreatePolicyBody(body: unknown): CreatePolicyBody {
  const record = asRecord(body);

  const key = record.key;
  if (typeof key !== 'string' || key.trim().length === 0) {
    throw new BadRequestError('key is required.');
  }

  const definition = record.definition;
  if (typeof definition !== 'object' || definition === null || Array.isArray(definition)) {
    throw new BadRequestError('definition must be a JSON object.');
  }

  return { key, definition: definition as Record<string, unknown> };
}
