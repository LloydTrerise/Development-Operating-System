import type { NotificationId } from '@devos/contracts';
import type { Notification } from '@devos/domain';
import { NotFoundError } from '../errors.js';
import type { NotificationUseCaseDeps } from './deps.js';

/**
 * DEVOS-269: marks one notification read on behalf of its recipient. A
 * mismatched or missing id both 404 — matching `getProjectSystemHealth`'s
 * own established "not yours" is a 404, not a 403, convention — rather than
 * confirming to an unrelated caller that a given notification id exists.
 */
export async function markNotificationRead(
  deps: NotificationUseCaseDeps,
  principalId: string,
  notificationId: NotificationId,
): Promise<Notification> {
  const notification = await deps.notifications.getById(notificationId);
  if (!notification || notification.recipientPrincipalId !== principalId) {
    throw new NotFoundError('Notification');
  }

  const readAt = new Date().toISOString();
  await deps.notifications.markRead(notificationId, readAt);
  return { ...notification, read: true, readAt };
}
