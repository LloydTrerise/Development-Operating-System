import { randomUUID } from 'node:crypto';
import type { EventEnvelope, NotificationId } from '@devos/contracts';
import type { NotificationMaterializationDeps } from './deps.js';

/**
 * DEVOS-268: materializes a triggering `EventEnvelope` into one
 * `Notification` row per real project member. Recipient rule (README.md's
 * grounding, narrowed from the backlog's own text): all project-level
 * members of any role (`memberships.listForProject`) — no real
 * per-approval "assignee" concept exists anywhere in this codebase to
 * additionally target, and organisation-level ("whole org") memberships are
 * deliberately not expanded into every project's member set here, since
 * "all project members" most literally means the project's own membership
 * rows, not `resolveMembership()`'s broader per-principal access check.
 *
 * No `EventSink` type is imported here: `packages/application` does not
 * depend on `@devos/database` (package-boundary discipline, AGENTS.md §13),
 * so this returns a plain function structurally compatible with
 * `EventSink` (`packages/database/src/repositories/publish-events.ts`) —
 * `apps/worker`, which depends on both packages, assigns it directly.
 *
 * An envelope with no `projectId` is a deliberate, disclosed no-op — every
 * real trigger event in the `ui-spec.txt` §29 list carries one in practice.
 */
export function createNotificationEventSink(
  deps: NotificationMaterializationDeps,
): (envelope: EventEnvelope) => Promise<void> {
  return async (envelope) => {
    if (envelope.projectId === undefined) return;

    const members = await deps.memberships.listForProject(envelope.projectId);
    await Promise.all(
      members.map((member) =>
        deps.notifications.create({
          id: randomUUID() as NotificationId,
          recipientPrincipalId: member.principalId,
          type: envelope.type,
          referenceType: envelope.aggregateType,
          referenceId: envelope.aggregateId,
          read: false,
          createdAt: envelope.occurredAt,
        }),
      ),
    );
  };
}
