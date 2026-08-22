import { randomUUID } from 'node:crypto';
import type { EventEnvelope, EventType, ProjectId } from '@devos/contracts';

export function createEventEnvelope<TPayload = Record<string, unknown>>(
  type: EventType,
  aggregateType: string,
  aggregateId: string,
  payload: TPayload,
  options: { projectId?: string; correlationId?: string } = {},
): EventEnvelope<TPayload> {
  const base = {
    id: randomUUID() as EventEnvelope['id'],
    type,
    version: 1,
    aggregateType,
    aggregateId,
    correlationId: (options.correlationId ?? randomUUID()) as EventEnvelope['correlationId'],
    occurredAt: new Date().toISOString(),
    payload,
  };

  if (options.projectId === undefined) return base;
  return { ...base, projectId: options.projectId as ProjectId };
}
