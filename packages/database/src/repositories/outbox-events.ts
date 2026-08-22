import type { EventEnvelope, EventType, OrganisationId } from '@devos/contracts';
import type { OutboxEventRepository, UnpublishedOutboxEvent } from '@devos/domain';
import type { OutboxEventsTable } from '../database.js';
import type { QueryExecutor } from './base.js';

function toUnpublished(row: OutboxEventsTable): UnpublishedOutboxEvent {
  return {
    id: row.id,
    envelope: row.payload as EventEnvelope,
    attempts: row.attempts,
  };
}

export function createOutboxEventRepository(db: QueryExecutor): OutboxEventRepository {
  return {
    async create(organisationId, envelope) {
      await db
        .insertInto('outbox_events')
        .values({
          id: envelope.id,
          organisation_id: organisationId,
          project_id: envelope.projectId ?? null,
          event_type: envelope.type,
          aggregate_type: envelope.aggregateType,
          aggregate_id: envelope.aggregateId,
          payload: JSON.stringify(envelope),
          created_at: envelope.occurredAt,
          published_at: null,
          attempts: 0,
          last_error: null,
        })
        .execute();
    },

    async listUnpublished(limit) {
      const rows = await db
        .selectFrom('outbox_events')
        .selectAll()
        .where('published_at', 'is', null)
        .orderBy('created_at', 'asc')
        .limit(limit)
        .execute();
      return rows.map(toUnpublished);
    },

    async markPublished(id, publishedAt) {
      await db
        .updateTable('outbox_events')
        .set({ published_at: publishedAt })
        .where('id', '=', id)
        .execute();
    },

    async recordFailure(id, error) {
      await db
        .updateTable('outbox_events')
        .set((eb) => ({ attempts: eb('attempts', '+', 1), last_error: error }))
        .where('id', '=', id)
        .execute();
    },
  };
}

/**
 * outbox_events.organisation_id is NOT NULL, but callers writing events
 * (task queue, artifact publisher) only have a project in scope. Small
 * indexed lookup rather than threading organisationId through every
 * application-layer call site.
 */
export async function getOrganisationIdForProject(
  db: QueryExecutor,
  projectId: string,
): Promise<OrganisationId> {
  const row = await db
    .selectFrom('projects')
    .select('organisation_id')
    .where('id', '=', projectId)
    .executeTakeFirstOrThrow();
  return row.organisation_id as OrganisationId;
}

export type { EventType };
