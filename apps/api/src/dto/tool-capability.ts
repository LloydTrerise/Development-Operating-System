import { toolCapabilityStatuses, type ToolCapabilityStatus } from '@devos/contracts';
import type { ToolCapability } from '@devos/domain';
import { BadRequestError } from '../http/errors.js';

/** DEVOS-256: omits `inputSchema`/`outputSchema` — no UI story in this
 * sprint needs to render either JSONB blob. */
export function toToolCapabilityDto(capability: ToolCapability) {
  return {
    id: capability.id,
    projectId: capability.projectId,
    key: capability.key,
    name: capability.name,
    riskClass: capability.riskClass,
    status: capability.status,
    createdAt: capability.createdAt,
  };
}

function asRecord(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null) {
    throw new BadRequestError('Request body must be a JSON object.');
  }
  return body as Record<string, unknown>;
}

export function parseSetToolCapabilityStatusBody(body: unknown): ToolCapabilityStatus {
  const { status } = asRecord(body);

  if (
    typeof status !== 'string' ||
    !(toolCapabilityStatuses as readonly string[]).includes(status)
  ) {
    throw new BadRequestError(`status must be one of: ${toolCapabilityStatuses.join(', ')}.`);
  }

  return status as ToolCapabilityStatus;
}
