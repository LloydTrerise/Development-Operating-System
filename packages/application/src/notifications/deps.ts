import type { MembershipRepository, NotificationRepository } from '@devos/domain';

export interface NotificationMaterializationDeps {
  notifications: NotificationRepository;
  memberships: MembershipRepository;
}

/**
 * DEVOS-269: a separate, narrower deps interface for the recipient-facing
 * read/mark-read use cases — they never need `memberships`, mirroring the
 * `tasks/` module's own established convention of one distinct, minimal
 * deps interface per real use-case shape rather than one all-purpose type
 * per domain folder.
 */
export interface NotificationUseCaseDeps {
  notifications: NotificationRepository;
}
