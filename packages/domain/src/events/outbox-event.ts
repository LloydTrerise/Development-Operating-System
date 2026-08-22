import type { EventEnvelope, OrganisationId } from '@devos/contracts';

export interface UnpublishedOutboxEvent {
  id: string;
  envelope: EventEnvelope;
  attempts: number;
}

export interface OutboxEventRepository {
  create: (organisationId: OrganisationId, envelope: EventEnvelope) => Promise<void>;
  listUnpublished: (limit: number) => Promise<UnpublishedOutboxEvent[]>;
  markPublished: (id: string, publishedAt: string) => Promise<void>;
  recordFailure: (id: string, error: string) => Promise<void>;
}
