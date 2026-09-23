import type { Notification } from '@devos/domain';

export function toNotificationDto(notification: Notification) {
  return {
    id: notification.id,
    recipientPrincipalId: notification.recipientPrincipalId,
    type: notification.type,
    referenceType: notification.referenceType,
    referenceId: notification.referenceId,
    read: notification.read,
    createdAt: notification.createdAt,
    readAt: notification.readAt ?? null,
  };
}
