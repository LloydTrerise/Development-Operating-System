import { randomUUID } from 'node:crypto';
import type {
  EventEnvelope,
  Membership,
  MembershipRepository,
  Notification,
  NotificationRepository,
} from '@devos/domain';
import type { MembershipId, OrganisationId, ProjectId } from '@devos/contracts';
import { describe, expect, it } from 'vitest';
import { createNotificationEventSink } from '../src/notifications/materialize-notification.js';
import type { NotificationMaterializationDeps } from '../src/notifications/deps.js';

function createInMemoryDeps(
  memberships: Membership[],
): NotificationMaterializationDeps & { notificationsStore: Notification[] } {
  const notificationsStore: Notification[] = [];

  const membershipRepository: MembershipRepository = {
    getById: async (id) => memberships.find((m) => m.id === id) ?? null,
    getForPrincipalAndProject: async (principalId, projectId) =>
      memberships.find((m) => m.principalId === principalId && m.projectId === projectId) ?? null,
    listForPrincipal: async (principalId) =>
      memberships.filter((m) => m.principalId === principalId),
    listForProject: async (projectId) => memberships.filter((m) => m.projectId === projectId),
    create: async () => {},
    updateRole: async () => {},
    remove: async () => {},
  };

  const notificationRepository: NotificationRepository = {
    create: async (notification) => {
      notificationsStore.push(notification);
    },
    getById: async (id) => notificationsStore.find((n) => n.id === id) ?? null,
    listForPrincipal: async (principalId) =>
      notificationsStore.filter((n) => n.recipientPrincipalId === principalId),
    markRead: async (id, readAt) => {
      const existing = notificationsStore.find((n) => n.id === id);
      if (!existing) return;
      existing.read = true;
      existing.readAt = readAt;
    },
  };

  return {
    memberships: membershipRepository,
    notifications: notificationRepository,
    notificationsStore,
  };
}

function buildEnvelope(overrides: Partial<EventEnvelope> = {}): EventEnvelope {
  return {
    id: randomUUID() as EventEnvelope['id'],
    type: 'ApprovalRequested',
    version: 1,
    aggregateType: 'Approval',
    aggregateId: randomUUID(),
    projectId: randomUUID() as ProjectId,
    correlationId: randomUUID(),
    occurredAt: new Date().toISOString(),
    payload: {},
    ...overrides,
  };
}

describe('createNotificationEventSink (DEVOS-268)', () => {
  it('materializes one notification per real project member', async () => {
    const organisationId = randomUUID() as OrganisationId;
    const projectId = randomUUID() as ProjectId;
    const now = new Date().toISOString();
    const memberships: Membership[] = [
      {
        id: randomUUID() as MembershipId,
        organisationId,
        projectId,
        principalId: 'alice',
        role: 'OWNER',
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: randomUUID() as MembershipId,
        organisationId,
        projectId,
        principalId: 'bob',
        role: 'MEMBER',
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
      },
    ];
    const deps = createInMemoryDeps(memberships);
    const sink = createNotificationEventSink(deps);
    const envelope = buildEnvelope({ projectId });

    await sink(envelope);

    expect(deps.notificationsStore).toHaveLength(2);
    const recipients = deps.notificationsStore.map((n) => n.recipientPrincipalId).sort();
    expect(recipients).toEqual(['alice', 'bob']);
    expect(deps.notificationsStore[0]).toMatchObject({
      type: 'ApprovalRequested',
      referenceType: envelope.aggregateType,
      referenceId: envelope.aggregateId,
      read: false,
    });
  });

  it('is a real no-op for an envelope with no projectId', async () => {
    const deps = createInMemoryDeps([]);
    const sink = createNotificationEventSink(deps);

    await sink(buildEnvelope({ projectId: undefined }));

    expect(deps.notificationsStore).toHaveLength(0);
  });

  it('creates zero notifications for a project with no members', async () => {
    const deps = createInMemoryDeps([]);
    const sink = createNotificationEventSink(deps);

    await sink(buildEnvelope({ projectId: randomUUID() as ProjectId }));

    expect(deps.notificationsStore).toHaveLength(0);
  });

  it('only notifies members of the triggering project, not other projects', async () => {
    const organisationId = randomUUID() as OrganisationId;
    const projectId = randomUUID() as ProjectId;
    const otherProjectId = randomUUID() as ProjectId;
    const now = new Date().toISOString();
    const memberships: Membership[] = [
      {
        id: randomUUID() as MembershipId,
        organisationId,
        projectId,
        principalId: 'alice',
        role: 'OWNER',
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: randomUUID() as MembershipId,
        organisationId,
        projectId: otherProjectId,
        principalId: 'carol',
        role: 'OWNER',
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
      },
    ];
    const deps = createInMemoryDeps(memberships);
    const sink = createNotificationEventSink(deps);

    await sink(buildEnvelope({ projectId }));

    expect(deps.notificationsStore.map((n) => n.recipientPrincipalId)).toEqual(['alice']);
  });
});
