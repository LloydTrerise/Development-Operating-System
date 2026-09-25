import { randomUUID } from 'node:crypto';
import type { ProjectId, WorkItemId } from '@devos/contracts';
import type {
  AuditRecord,
  AuditRecordRepository,
  Membership,
  MembershipRepository,
  Project,
  ProjectRepository,
  WorkItem,
  WorkItemAssignment,
  WorkItemAssignmentRepository,
  WorkItemComment,
  WorkItemCommentRepository,
  WorkItemRepository,
} from '@devos/domain';
import { beforeEach, describe, expect, it } from 'vitest';
import { addWorkItemComment } from '../src/work-items/add-work-item-comment.js';
import { archiveWorkItem } from '../src/work-items/archive-work-item.js';
import { assignWorkItem } from '../src/work-items/assign-work-item.js';
import { createWorkItem } from '../src/work-items/create-work-item.js';
import type { WorkItemUseCaseDeps } from '../src/work-items/deps.js';
import { listWorkItemAssignments } from '../src/work-items/list-work-item-assignments.js';
import { listWorkItemComments } from '../src/work-items/list-work-item-comments.js';
import { removeWorkItemAssignment } from '../src/work-items/remove-work-item-assignment.js';
import { updateWorkItem } from '../src/work-items/update-work-item.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../src/errors.js';

const PROJECT_ID = randomUUID() as ProjectId;
const OTHER_PROJECT_ID = randomUUID() as ProjectId;

function createInMemoryDeps(): WorkItemUseCaseDeps {
  const projects = new Map<string, Project>();
  const memberships = new Map<string, Membership>();
  const workItems = new Map<string, WorkItem>();
  const workItemAssignments: WorkItemAssignment[] = [];
  const auditRecordsStore: AuditRecord[] = [];

  const now = new Date().toISOString();

  projects.set(PROJECT_ID, {
    id: PROJECT_ID,
    organisationId: randomUUID() as Project['organisationId'],
    projectTypeId: randomUUID() as Project['projectTypeId'],
    name: 'Project',
    slug: 'project',
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  });
  projects.set(OTHER_PROJECT_ID, {
    id: OTHER_PROJECT_ID,
    organisationId: randomUUID() as Project['organisationId'],
    projectTypeId: randomUUID() as Project['projectTypeId'],
    name: 'Other Project',
    slug: 'other-project',
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  });

  const projectRepository: ProjectRepository = {
    getById: async (id) => projects.get(id) ?? null,
    listForOrganisation: async (organisationId) =>
      [...projects.values()].filter((project) => project.organisationId === organisationId),
    create: async (project) => {
      projects.set(project.id, project);
    },
    update: async () => {},
  };

  const membershipRepository: MembershipRepository = {
    getById: async (id) => memberships.get(id) ?? null,
    getForPrincipalAndProject: async (principalId, projectId) =>
      [...memberships.values()].find(
        (m) => m.principalId === principalId && m.projectId === projectId,
      ) ?? null,
    listForPrincipal: async (principalId) =>
      [...memberships.values()].filter((m) => m.principalId === principalId),
    listForProject: async (projectId) =>
      [...memberships.values()].filter((m) => m.projectId === projectId),
    listForOrganisation: async (organisationId) =>
      [...memberships.values()].filter(
        (m) => m.organisationId === organisationId && m.projectId === null,
      ),
    create: async (membership) => {
      memberships.set(membership.id, membership);
    },
    updateRole: async () => {},
    remove: async (id) => {
      memberships.delete(id);
    },
  };

  const workItemRepository: WorkItemRepository = {
    getById: async (id) => workItems.get(id) ?? null,
    listForProject: async (projectId) =>
      [...workItems.values()].filter((item) => item.projectId === projectId),
    create: async (workItem) => {
      workItems.set(workItem.id, workItem);
    },
    update: async (id, changes, updatedAt) => {
      const existing = workItems.get(id);
      if (!existing) return;
      // Mirrors the real Postgres repository: `changes.parentId === null`
      // clears the column (read back as omitted), distinct from `undefined`
      // (no change) and a real id (set/replace).
      const { parentId: parentIdChange, ...otherChanges } = changes;
      const updated: WorkItem = { ...existing, ...otherChanges, updatedAt };
      if (parentIdChange === null) {
        delete updated.parentId;
      } else if (parentIdChange !== undefined) {
        updated.parentId = parentIdChange;
      }
      workItems.set(id, updated);
    },
  };

  const workItemAssignmentRepository: WorkItemAssignmentRepository = {
    listForWorkItem: async (workItemId) =>
      workItemAssignments.filter((a) => a.workItemId === workItemId),
    create: async (assignment) => {
      if (
        !workItemAssignments.some(
          (existing) =>
            existing.workItemId === assignment.workItemId &&
            existing.principalId === assignment.principalId &&
            existing.role === assignment.role,
        )
      ) {
        workItemAssignments.push(assignment);
      }
    },
    remove: async (workItemId, principalId, role) => {
      const index = workItemAssignments.findIndex(
        (a) => a.workItemId === workItemId && a.principalId === principalId && a.role === role,
      );
      if (index !== -1) workItemAssignments.splice(index, 1);
    },
  };

  const auditRecords: AuditRecordRepository = {
    create: async (record) => {
      auditRecordsStore.push(record);
    },
    listForProject: async (projectId) => auditRecordsStore.filter((r) => r.projectId === projectId),
    listForOrganisation: async (organisationId) =>
      auditRecordsStore.filter((r) => r.organisationId === organisationId),
  };

  const workItemComments: WorkItemComment[] = [];
  const workItemCommentRepository: WorkItemCommentRepository = {
    listForWorkItem: async (workItemId) =>
      workItemComments.filter((c) => c.workItemId === workItemId),
    create: async (comment) => {
      workItemComments.push(comment);
    },
  };

  return {
    projects: projectRepository,
    memberships: membershipRepository,
    workItems: workItemRepository,
    auditRecords,
    workItemAssignments: workItemAssignmentRepository,
    workItemComments: workItemCommentRepository,
  };
}

async function addMembership(
  deps: WorkItemUseCaseDeps,
  principalId: string,
  role: Membership['role'],
  projectId: ProjectId,
): Promise<void> {
  const project = await deps.projects.getById(projectId);
  const now = new Date().toISOString();
  await deps.memberships.create({
    id: randomUUID() as Membership['id'],
    organisationId: project!.organisationId,
    projectId,
    principalId,
    role,
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  });
}

describe('work item use cases (DEVOS-303/304/305, Sprint 50)', () => {
  let deps: WorkItemUseCaseDeps;

  beforeEach(async () => {
    deps = createInMemoryDeps();
    await addMembership(deps, 'owner', 'OWNER', PROJECT_ID);
    await addMembership(deps, 'member', 'MEMBER', PROJECT_ID);
    await addMembership(deps, 'reviewer', 'MEMBER', PROJECT_ID);
  });

  it('auto-assigns the creator as ASSIGNEE (DEVOS-305)', async () => {
    const workItem = await createWorkItem(deps, 'owner', PROJECT_ID, { title: 'A task' });
    const assignments = await listWorkItemAssignments(deps, 'owner', workItem.id);
    expect(assignments).toEqual([
      expect.objectContaining({ principalId: 'owner', role: 'ASSIGNEE' }),
    ]);
  });

  it('lets the ASSIGNEE edit and transition, denies a plain member either', async () => {
    const workItem = await createWorkItem(deps, 'owner', PROJECT_ID, { title: 'A task' });

    await expect(
      updateWorkItem(deps, 'owner', workItem.id, { title: 'Renamed', status: 'IN_PROGRESS' }),
    ).resolves.toMatchObject({ title: 'Renamed', status: 'IN_PROGRESS' });

    await expect(
      updateWorkItem(deps, 'member', workItem.id, { title: 'Member tries to rename' }),
    ).rejects.toThrow(ForbiddenError);
    await expect(updateWorkItem(deps, 'member', workItem.id, { status: 'DONE' })).rejects.toThrow(
      ForbiddenError,
    );
  });

  it('lets a REVIEWER transition status but not edit non-status fields', async () => {
    const workItem = await createWorkItem(deps, 'owner', PROJECT_ID, { title: 'A task' });
    await assignWorkItem(deps, 'owner', workItem.id, 'reviewer', 'REVIEWER');

    await expect(
      updateWorkItem(deps, 'reviewer', workItem.id, { status: 'IN_REVIEW' }),
    ).resolves.toMatchObject({ status: 'IN_REVIEW' });
    await expect(
      updateWorkItem(deps, 'reviewer', workItem.id, { title: 'Reviewer tries to rename' }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('gates assign/remove to canManageMembers (project OWNER)', async () => {
    const workItem = await createWorkItem(deps, 'owner', PROJECT_ID, { title: 'A task' });

    await expect(
      assignWorkItem(deps, 'member', workItem.id, 'reviewer', 'REVIEWER'),
    ).rejects.toThrow(ForbiddenError);

    const assignment = await assignWorkItem(deps, 'owner', workItem.id, 'reviewer', 'REVIEWER');
    expect(assignment).toMatchObject({ principalId: 'reviewer', role: 'REVIEWER' });

    await expect(
      removeWorkItemAssignment(deps, 'member', workItem.id, 'reviewer', 'REVIEWER'),
    ).rejects.toThrow(ForbiddenError);

    await removeWorkItemAssignment(deps, 'owner', workItem.id, 'reviewer', 'REVIEWER');
    const remaining = await listWorkItemAssignments(deps, 'owner', workItem.id);
    expect(remaining.some((a) => a.principalId === 'reviewer')).toBe(false);
  });

  it('rejects assigning an invalid role or a non-member target', async () => {
    const workItem = await createWorkItem(deps, 'owner', PROJECT_ID, { title: 'A task' });

    await expect(
      assignWorkItem(deps, 'owner', workItem.id, 'reviewer', 'NOT_A_ROLE'),
    ).rejects.toThrow(ValidationError);
    await expect(
      assignWorkItem(deps, 'owner', workItem.id, 'stranger', 'REVIEWER'),
    ).rejects.toThrow(ValidationError);
  });

  it('accepts a same-project parent and rejects a cross-project one (DEVOS-303)', async () => {
    const parent = await createWorkItem(deps, 'owner', PROJECT_ID, { title: 'Parent' });
    const child = await createWorkItem(deps, 'owner', PROJECT_ID, {
      title: 'Child',
      parentId: parent.id,
    });
    expect(child.parentId).toBe(parent.id);

    await addMembership(deps, 'owner', 'OWNER', OTHER_PROJECT_ID);
    await expect(
      createWorkItem(deps, 'owner', OTHER_PROJECT_ID, {
        title: 'Cross-project child',
        parentId: parent.id,
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('rejects a work item being set as its own parent', async () => {
    const workItem = await createWorkItem(deps, 'owner', PROJECT_ID, { title: 'A task' });
    await expect(
      updateWorkItem(deps, 'owner', workItem.id, { parentId: workItem.id as WorkItemId }),
    ).rejects.toThrow(ValidationError);
  });

  it('rejects a multi-hop parentId cycle (A -> B -> A)', async () => {
    const a = await createWorkItem(deps, 'owner', PROJECT_ID, { title: 'A' });
    const b = await createWorkItem(deps, 'owner', PROJECT_ID, { title: 'B', parentId: a.id });

    await expect(updateWorkItem(deps, 'owner', a.id, { parentId: b.id })).rejects.toThrow(
      ValidationError,
    );
  });

  it("rejects a deeper cycle (A -> B -> C, then C set as A's parent)", async () => {
    const a = await createWorkItem(deps, 'owner', PROJECT_ID, { title: 'A' });
    const b = await createWorkItem(deps, 'owner', PROJECT_ID, { title: 'B', parentId: a.id });
    const c = await createWorkItem(deps, 'owner', PROJECT_ID, { title: 'C', parentId: b.id });

    await expect(updateWorkItem(deps, 'owner', a.id, { parentId: c.id })).rejects.toThrow(
      ValidationError,
    );
  });

  it('explicitly clears a parent with null, distinct from omitting the field', async () => {
    const parent = await createWorkItem(deps, 'owner', PROJECT_ID, { title: 'Parent' });
    const child = await createWorkItem(deps, 'owner', PROJECT_ID, {
      title: 'Child',
      parentId: parent.id,
    });
    expect(child.parentId).toBe(parent.id);

    const cleared = await updateWorkItem(deps, 'owner', child.id, { parentId: null });
    expect(cleared.parentId).toBeUndefined();

    const reread = await deps.workItems.getById(child.id);
    expect(reread?.parentId).toBeUndefined();
  });

  it('lets the current ASSIGNEE hand off ASSIGNEE to another member without canManageMembers', async () => {
    const workItem = await createWorkItem(deps, 'owner', PROJECT_ID, { title: 'A task' });
    // 'owner' is the auto-assigned ASSIGNEE (creator); hand off to 'member',
    // who does not hold canManageMembers.
    await assignWorkItem(deps, 'owner', workItem.id, 'member', 'ASSIGNEE');

    // 'member' now holds ASSIGNEE — hands it off to 'reviewer' without being
    // canManageMembers themselves.
    const handoff = await assignWorkItem(deps, 'member', workItem.id, 'reviewer', 'ASSIGNEE');
    expect(handoff).toMatchObject({ principalId: 'reviewer', role: 'ASSIGNEE' });

    const assignments = await listWorkItemAssignments(deps, 'owner', workItem.id);
    // The handoff is a transfer: 'member' no longer holds ASSIGNEE.
    expect(assignments.some((a) => a.principalId === 'member' && a.role === 'ASSIGNEE')).toBe(
      false,
    );
    expect(assignments.some((a) => a.principalId === 'reviewer' && a.role === 'ASSIGNEE')).toBe(
      true,
    );

    // 'member' no longer holds ASSIGNEE, so a further hand-off attempt by
    // them is denied (not canManageMembers, not the current assignee).
    await expect(assignWorkItem(deps, 'member', workItem.id, 'owner', 'ASSIGNEE')).rejects.toThrow(
      ForbiddenError,
    );
  });

  it('does not let a non-assignee hand off REVIEWER/APPROVER without canManageMembers', async () => {
    const workItem = await createWorkItem(deps, 'owner', PROJECT_ID, { title: 'A task' });
    // 'owner' is the ASSIGNEE, but the hand-off exception only applies to
    // the ASSIGNEE role itself, not REVIEWER/APPROVER grants.
    await expect(
      assignWorkItem(deps, 'member', workItem.id, 'reviewer', 'REVIEWER'),
    ).rejects.toThrow(ForbiddenError);
  });

  describe('DEVOS-309 (Sprint 51 reconciliation): comments', () => {
    it('lets any resolved project member comment and read comments, in creation order', async () => {
      const workItem = await createWorkItem(deps, 'owner', PROJECT_ID, { title: 'A task' });

      const first = await addWorkItemComment(deps, 'owner', workItem.id, { body: 'First' });
      const second = await addWorkItemComment(deps, 'member', workItem.id, { body: 'Second' });

      expect(first.principalId).toBe('owner');
      expect(second.principalId).toBe('member');

      const comments = await listWorkItemComments(deps, 'reviewer', workItem.id);
      expect(comments.map((c) => c.body)).toEqual(['First', 'Second']);

      const audit = await deps.auditRecords.listForProject(PROJECT_ID);
      expect(audit).toContainEqual(
        expect.objectContaining({ action: 'work-item.commented', actorId: 'member' }),
      );
    });

    it('rejects an empty comment body', async () => {
      const workItem = await createWorkItem(deps, 'owner', PROJECT_ID, { title: 'A task' });
      await expect(addWorkItemComment(deps, 'owner', workItem.id, { body: '   ' })).rejects.toThrow(
        ValidationError,
      );
    });

    it('rejects a non-member with NotFoundError', async () => {
      const workItem = await createWorkItem(deps, 'owner', PROJECT_ID, { title: 'A task' });
      await expect(
        addWorkItemComment(deps, 'mallory', workItem.id, { body: 'Hi' }),
      ).rejects.toThrow(NotFoundError);
      await expect(listWorkItemComments(deps, 'mallory', workItem.id)).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  describe('DEVOS-309 (Sprint 51 reconciliation): archive', () => {
    it('lets OWNER archive a work item, denies a plain MEMBER (even the ASSIGNEE)', async () => {
      const workItem = await createWorkItem(deps, 'owner', PROJECT_ID, { title: 'A task' });
      // 'owner' is auto-assigned ASSIGNEE on creation (Sprint 50) but that
      // alone must not be enough — workitem.delete has no "project member"
      // grant at all in the source document, unlike every other
      // workitem.* permission.
      await assignWorkItem(deps, 'owner', workItem.id, 'member', 'ASSIGNEE');

      await expect(archiveWorkItem(deps, 'member', workItem.id)).rejects.toThrow(ForbiddenError);

      const archived = await archiveWorkItem(deps, 'owner', workItem.id);
      expect(archived.status).toBe('ARCHIVED');

      const audit = await deps.auditRecords.listForProject(PROJECT_ID);
      expect(audit).toContainEqual(
        expect.objectContaining({ action: 'work-item.archived', targetId: workItem.id }),
      );
    });

    it('rejects archiving an already-archived work item', async () => {
      const workItem = await createWorkItem(deps, 'owner', PROJECT_ID, { title: 'A task' });
      await archiveWorkItem(deps, 'owner', workItem.id);
      await expect(archiveWorkItem(deps, 'owner', workItem.id)).rejects.toThrow(ValidationError);
    });

    it('rejects a non-member with NotFoundError', async () => {
      const workItem = await createWorkItem(deps, 'owner', PROJECT_ID, { title: 'A task' });
      await expect(archiveWorkItem(deps, 'mallory', workItem.id)).rejects.toThrow(NotFoundError);
    });
  });
});
