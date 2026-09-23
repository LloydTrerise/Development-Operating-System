import type { EventType, NotificationId } from '@devos/contracts';
import type { Notification, NotificationRepository } from '@devos/domain';
import type { NotificationsTable } from '../database.js';
import type { QueryExecutor } from './base.js';

function toDomain(row: NotificationsTable): Notification {
  return {
    id: row.id as NotificationId,
    recipientPrincipalId: row.recipient_principal_id,
    type: row.type as EventType,
    referenceType: row.reference_type,
    referenceId: row.reference_id,
    read: row.read,
    createdAt: row.created_at,
    ...(row.read_at !== null ? { readAt: row.read_at } : {}),
  };
}

export function createNotificationRepository(db: QueryExecutor): NotificationRepository {
  return {
    async create(notification) {
      await db
        .insertInto('notifications')
        .values({
          id: notification.id,
          recipient_principal_id: notification.recipientPrincipalId,
          type: notification.type,
          reference_type: notification.referenceType,
          reference_id: notification.referenceId,
          read: notification.read,
          created_at: notification.createdAt,
          read_at: notification.readAt ?? null,
        })
        .execute();
    },

    async getById(id) {
      const row = await db
        .selectFrom('notifications')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst();
      return row ? toDomain(row) : null;
    },

    async listForPrincipal(principalId, limit = 100) {
      const rows = await db
        .selectFrom('notifications')
        .selectAll()
        .where('recipient_principal_id', '=', principalId)
        .orderBy('created_at', 'desc')
        .limit(limit)
        .execute();
      return rows.map(toDomain);
    },

    async markRead(id, readAt) {
      await db
        .updateTable('notifications')
        .set({ read: true, read_at: readAt })
        .where('id', '=', id)
        .execute();
    },
  };
}
