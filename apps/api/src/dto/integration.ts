import type { Integration } from '@devos/domain';
import { BadRequestError } from '../http/errors.js';

/**
 * DEVOS-194: the first-ever DTO for `Integration` — `credentialReference` is
 * a reference *name*, never the secret value it points to
 * (`create-integration.ts`'s own audit-record precedent already treats it
 * as safe to record), so it is included here unchanged, exactly like
 * `configuration` (already validated at creation time to reject any
 * secret-shaped key).
 */
export function toIntegrationDto(integration: Integration) {
  return {
    id: integration.id,
    projectId: integration.projectId,
    type: integration.type,
    provider: integration.provider,
    name: integration.name,
    status: integration.status,
    credentialReference: integration.credentialReference,
    configuration: integration.configuration,
    createdAt: integration.createdAt,
    updatedAt: integration.updatedAt,
  };
}

export interface CreateIntegrationBody {
  type: string;
  provider: string;
  name: string;
  credentialReference: string;
  configuration?: Record<string, unknown>;
}

function asRecord(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null) {
    throw new BadRequestError('Request body must be a JSON object.');
  }
  return body as Record<string, unknown>;
}

export function parseCreateIntegrationBody(body: unknown): CreateIntegrationBody {
  const record = asRecord(body);

  const type = record.type;
  if (typeof type !== 'string' || type.trim().length === 0) {
    throw new BadRequestError('type is required.');
  }

  const provider = record.provider;
  if (typeof provider !== 'string' || provider.trim().length === 0) {
    throw new BadRequestError('provider is required.');
  }

  const name = record.name;
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new BadRequestError('name is required.');
  }

  const credentialReference = record.credentialReference;
  if (typeof credentialReference !== 'string' || credentialReference.trim().length === 0) {
    throw new BadRequestError('credentialReference is required.');
  }

  const configuration = record.configuration;
  if (
    configuration !== undefined &&
    (typeof configuration !== 'object' || configuration === null || Array.isArray(configuration))
  ) {
    throw new BadRequestError('configuration must be a JSON object.');
  }

  return {
    type,
    provider,
    name,
    credentialReference,
    ...(configuration !== undefined
      ? { configuration: configuration as Record<string, unknown> }
      : {}),
  };
}
