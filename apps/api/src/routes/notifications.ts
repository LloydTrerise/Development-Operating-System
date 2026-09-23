import type { NotificationId } from '@devos/contracts';
import {
  listNotificationsForPrincipal,
  markNotificationRead,
  type NotificationUseCaseDeps,
} from '@devos/application';
import { toNotificationDto } from '../dto/notifications.js';
import { requirePrincipal, type Route } from '../http/router.js';

/**
 * DEVOS-269: recipient-scoped only — unlike every project-scoped route in
 * this codebase, no `resolveMembership()` check applies here (see
 * `markNotificationRead`'s own doc comment).
 */
export function createNotificationRoutes(prefix: string, deps: NotificationUseCaseDeps): Route[] {
  return [
    {
      method: 'GET',
      pattern: `${prefix}/notifications`,
      protected: true,
      handler: async ({ principal }) => {
        const user = requirePrincipal(principal);
        const notifications = await listNotificationsForPrincipal(deps, user.id);
        return notifications.map(toNotificationDto);
      },
    },
    {
      method: 'PATCH',
      pattern: `${prefix}/notifications/:notificationId/read`,
      protected: true,
      handler: async ({ principal, params }) => {
        const user = requirePrincipal(principal);
        const notification = await markNotificationRead(
          deps,
          user.id,
          params.notificationId as NotificationId,
        );
        return toNotificationDto(notification);
      },
    },
  ];
}
