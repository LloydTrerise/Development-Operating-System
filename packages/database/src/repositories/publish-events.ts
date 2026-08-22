import type { EventEnvelope } from '@devos/contracts';
import type { OutboxEventRepository } from '@devos/domain';

export type EventSink = (envelope: EventEnvelope) => Promise<void> | void;

export interface PublishEventsResult {
  published: number;
  failed: number;
}

/**
 * Drains unpublished outbox events through a sink and marks them published.
 * Idempotent: already-published rows are excluded by the repository's
 * `published_at IS NULL` filter, so re-running is always safe. No real
 * message bus exists yet (same open decision as the queue/storage tech) —
 * for Sprint 1 the sink is a console-log stand-in; this is not wired into a
 * continuous background loop since nothing subscribes yet.
 */
export async function publishPendingEvents(
  repository: OutboxEventRepository,
  sink: EventSink,
  limit = 50,
): Promise<PublishEventsResult> {
  const pending = await repository.listUnpublished(limit);
  let published = 0;
  let failed = 0;

  for (const { id, envelope } of pending) {
    try {
      await sink(envelope);
      await repository.markPublished(id, new Date().toISOString());
      published += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error.';
      await repository.recordFailure(id, message);
      failed += 1;
    }
  }

  return { published, failed };
}

export const consoleLogEventSink: EventSink = (envelope) => {
  console.log(`[event] ${envelope.type}`, {
    aggregateType: envelope.aggregateType,
    aggregateId: envelope.aggregateId,
    correlationId: envelope.correlationId,
  });
};
