import type { Notification } from '@devos/domain';
import type { NotificationUseCaseDeps } from './deps.js';

/** DEVOS-269: the current principal's own notifications — no membership
 * check applies, since a notification is already recipient-scoped at write
 * time (DEVOS-268). */
export async function listNotificationsForPrincipal(
  deps: NotificationUseCaseDeps,
  principalId: string,
): Promise<Notification[]> {
  return deps.notifications.listForPrincipal(principalId);
}
