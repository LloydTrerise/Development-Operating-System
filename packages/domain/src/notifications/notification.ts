import type { EventType, NotificationId } from '@devos/contracts';

/**
 * A per-recipient materialization of a triggering `EventEnvelope`
 * (DEVOS-268), closest precedent `AuditRecord`'s own per-entity
 * `targetType`/`targetId` shape: `type` reuses the real `EventType` that
 * fired rather than inventing a parallel enum; `referenceType`/`referenceId`
 * mirror the envelope's own `aggregateType`/`aggregateId` unchanged.
 */
export interface Notification {
  id: NotificationId;
  recipientPrincipalId: string;
  type: EventType;
  referenceType: string;
  referenceId: string;
  read: boolean;
  createdAt: string;
  readAt?: string;
}

export interface NotificationRepository {
  create: (notification: Notification) => Promise<void>;
  getById: (id: NotificationId) => Promise<Notification | null>;
  listForPrincipal: (principalId: string, limit?: number) => Promise<Notification[]>;
  markRead: (id: NotificationId, readAt: string) => Promise<void>;
}
