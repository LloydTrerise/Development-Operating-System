import { randomUUID } from 'node:crypto';
import type { OrganisationId, ProjectId } from '@devos/contracts';
import type {
  AuditRecord,
  AuditRecordRepository,
  Membership,
  MembershipRepository,
  Project,
  ProjectRepository,
} from '@devos/domain';
import { beforeEach, describe, expect, it } from 'vitest';
import { addMember } from '../src/projects/add-member.js';
import { changeMemberRole } from '../src/projects/change-member-role.js';
import { createProject } from '../src/projects/create-project.js';
import type { ProjectUseCaseDeps } from '../src/projects/deps.js';
import { getProjectForPrincipal } from '../src/projects/get-project.js';
import { listMembers } from '../src/projects/list-members.js';
import { listProjectsForPrincipal } from '../src/projects/list-projects-for-principal.js';
import { removeMember } from '../src/projects/remove-member.js';
import { updateProject } from '../src/projects/update-project.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../src/errors.js';

function createInMemoryDeps(): ProjectUseCaseDeps {
  const projects = new Map<string, Project>();
  const memberships = new Map<string, Membership>();

  const projectRepository: ProjectRepository = {
    getById: async (id) => projects.get(id) ?? null,
    listForOrganisation: async (organisationId) =>
      [...projects.values()].filter((project) => project.organisationId === organisationId),
    create: async (project) => {
      projects.set(project.id, project);
    },
    update: async (id, changes, updatedAt) => {
      const existing = projects.get(id);
      if (!existing) return;
      projects.set(id, { ...existing, ...changes, updatedAt });
    },
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
    create: async (membership) => {
      memberships.set(membership.id, membership);
    },
    updateRole: async (id, role, updatedAt) => {
      const existing = memberships.get(id);
      if (!existing) return;
      memberships.set(id, { ...existing, role, updatedAt });
    },
    remove: async (id) => {
      memberships.delete(id);
    },
  };

  const auditRecordsStore: AuditRecord[] = [];
  const auditRecords: AuditRecordRepository = {
    create: async (record) => {
      auditRecordsStore.push(record);
    },
    listForProject: async (projectId) => auditRecordsStore.filter((r) => r.projectId === projectId),
  };

  return { projects: projectRepository, memberships: membershipRepository, auditRecords };
}

describe('project use cases', () => {
  let deps: ProjectUseCaseDeps;
  const organisationId = randomUUID() as OrganisationId;

  beforeEach(() => {
    deps = createInMemoryDeps();
  });

  it('creates a project and makes the creator an OWNER', async () => {
    const project = await createProject(deps, 'alice', {
      organisationId,
      name: 'DevOS POC',
      slug: 'devos-poc',
    });

    const members = await listMembers(deps, 'alice', project.id);
    expect(members).toHaveLength(1);
    expect(members[0]).toMatchObject({ principalId: 'alice', role: 'OWNER' });
  });

  it('lists only projects the principal has access to', async () => {
    const project = await createProject(deps, 'alice', {
      organisationId,
      name: 'Alice Project',
      slug: 'alice-project',
    });
    await createProject(deps, 'bob', {
      organisationId,
      name: 'Bob Project',
      slug: 'bob-project',
    });

    const aliceProjects = await listProjectsForPrincipal(deps, 'alice');
    expect(aliceProjects.map((p) => p.id)).toEqual([project.id]);
  });

  it('rejects getProjectForPrincipal for a non-member', async () => {
    const project = await createProject(deps, 'alice', {
      organisationId,
      name: 'Alice Project',
      slug: 'alice-project',
    });

    await expect(getProjectForPrincipal(deps, 'mallory', project.id)).rejects.toThrow(
      NotFoundError,
    );
  });

  it('rejects a non-existent project id', async () => {
    await expect(getProjectForPrincipal(deps, 'alice', randomUUID() as ProjectId)).rejects.toThrow(
      NotFoundError,
    );
  });

  it('allows OWNER to update the project, denies MEMBER', async () => {
    const project = await createProject(deps, 'alice', {
      organisationId,
      name: 'Alice Project',
      slug: 'alice-project',
    });
    await addMember(deps, 'alice', project.id, { principalId: 'bob', role: 'MEMBER' });

    const updated = await updateProject(deps, 'alice', project.id, { name: 'Renamed' });
    expect(updated.name).toBe('Renamed');

    await expect(updateProject(deps, 'bob', project.id, { name: 'Should fail' })).rejects.toThrow(
      ForbiddenError,
    );
  });

  it('denies MEMBER from adding members', async () => {
    const project = await createProject(deps, 'alice', {
      organisationId,
      name: 'Alice Project',
      slug: 'alice-project',
    });
    await addMember(deps, 'alice', project.id, { principalId: 'bob', role: 'MEMBER' });

    await expect(
      addMember(deps, 'bob', project.id, { principalId: 'carol', role: 'MEMBER' }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('rejects adding a principal who is already a member', async () => {
    const project = await createProject(deps, 'alice', {
      organisationId,
      name: 'Alice Project',
      slug: 'alice-project',
    });

    await expect(
      addMember(deps, 'alice', project.id, { principalId: 'alice', role: 'MEMBER' }),
    ).rejects.toThrow(ValidationError);
  });

  it('prevents removing the last owner', async () => {
    const project = await createProject(deps, 'alice', {
      organisationId,
      name: 'Alice Project',
      slug: 'alice-project',
    });
    const members = await listMembers(deps, 'alice', project.id);
    const ownerMembershipId = members[0]!.id;

    await expect(removeMember(deps, 'alice', project.id, ownerMembershipId)).rejects.toThrow(
      ValidationError,
    );
  });

  it('allows demoting an owner when another owner remains', async () => {
    const project = await createProject(deps, 'alice', {
      organisationId,
      name: 'Alice Project',
      slug: 'alice-project',
    });
    const bobMembership = await addMember(deps, 'alice', project.id, {
      principalId: 'bob',
      role: 'OWNER',
    });

    const aliceMembership = (await listMembers(deps, 'alice', project.id)).find(
      (m) => m.principalId === 'alice',
    )!;

    const changed = await changeMemberRole(deps, 'bob', project.id, aliceMembership.id, 'MEMBER');
    expect(changed.role).toBe('MEMBER');
    expect(bobMembership.role).toBe('OWNER');
  });

  it('DEVOS-086: writes an audit record for membership add, role change, and remove', async () => {
    const project = await createProject(deps, 'alice', {
      organisationId,
      name: 'Audited Project',
      slug: 'audited-project',
    });

    const bobMembership = await addMember(deps, 'alice', project.id, {
      principalId: 'bob',
      role: 'MEMBER',
    });
    await changeMemberRole(deps, 'alice', project.id, bobMembership.id, 'OWNER');
    await removeMember(deps, 'alice', project.id, bobMembership.id);

    const records = await deps.auditRecords.listForProject(project.id);
    expect(records).toContainEqual(
      expect.objectContaining({ action: 'membership.added', targetId: bobMembership.id }),
    );
    expect(records).toContainEqual(
      expect.objectContaining({ action: 'membership.role_changed', targetId: bobMembership.id }),
    );
    expect(records).toContainEqual(
      expect.objectContaining({ action: 'membership.removed', targetId: bobMembership.id }),
    );
  });
});
