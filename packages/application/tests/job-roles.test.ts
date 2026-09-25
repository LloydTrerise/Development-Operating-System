import { randomUUID } from 'node:crypto';
import type { OrganisationId, ProjectId } from '@devos/contracts';
import type {
  AuditRecord,
  AuditRecordRepository,
  JobRole,
  JobRoleRepository,
  Membership,
  MembershipRepository,
  Organisation,
  OrganisationRepository,
  PrincipalJobRole,
  PrincipalJobRoleRepository,
  Project,
  ProjectMemberJobRole,
  ProjectMemberJobRoleRepository,
  ProjectRepository,
} from '@devos/domain';
import { beforeEach, describe, expect, it } from 'vitest';
import { assignPrincipalJobRole } from '../src/job-roles/assign-principal-job-role.js';
import { assignProjectMemberJobRole } from '../src/job-roles/assign-project-member-job-role.js';
import type { JobRoleUseCaseDeps } from '../src/job-roles/deps.js';
import { getProjectJobRolesOverview } from '../src/job-roles/get-project-job-roles-overview.js';
import { listJobRolesForOrganisation } from '../src/job-roles/list-job-roles-for-organisation.js';
import { listPrincipalJobRoles } from '../src/job-roles/list-principal-job-roles.js';
import { removePrincipalJobRole } from '../src/job-roles/remove-principal-job-role.js';
import { removeProjectMemberJobRole } from '../src/job-roles/remove-project-member-job-role.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../src/errors.js';

const ORG_ID = randomUUID() as OrganisationId;
const OTHER_ORG_ID = randomUUID() as OrganisationId;
const PROJECT_ID = randomUUID() as ProjectId;

function createInMemoryDeps(): JobRoleUseCaseDeps {
  const organisations = new Map<string, Organisation>();
  const projects = new Map<string, Project>();
  const memberships = new Map<string, Membership>();
  const jobRoles = new Map<string, JobRole>();
  const principalJobRoles: PrincipalJobRole[] = [];
  const projectMemberJobRoles: ProjectMemberJobRole[] = [];
  const auditRecordsStore: AuditRecord[] = [];

  const now = new Date().toISOString();

  organisations.set(ORG_ID, {
    id: ORG_ID,
    name: 'Acme',
    slug: 'acme',
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  });
  organisations.set(OTHER_ORG_ID, {
    id: OTHER_ORG_ID,
    name: 'Other',
    slug: 'other',
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  });

  projects.set(PROJECT_ID, {
    id: PROJECT_ID,
    organisationId: ORG_ID,
    projectTypeId: randomUUID() as Project['projectTypeId'],
    name: 'Project',
    slug: 'project',
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  });

  const devJobRole: JobRole = {
    id: `${ORG_ID}:DEV`,
    organisationId: ORG_ID,
    key: 'DEV',
    name: 'Developer',
    createdAt: now,
  };
  const baJobRole: JobRole = {
    id: `${ORG_ID}:BA`,
    organisationId: ORG_ID,
    key: 'BA',
    name: 'Business Analyst',
    createdAt: now,
  };
  const otherOrgJobRole: JobRole = {
    id: `${OTHER_ORG_ID}:DEV`,
    organisationId: OTHER_ORG_ID,
    key: 'DEV',
    name: 'Developer',
    createdAt: now,
  };
  jobRoles.set(devJobRole.id, devJobRole);
  jobRoles.set(baJobRole.id, baJobRole);
  jobRoles.set(otherOrgJobRole.id, otherOrgJobRole);

  const organisationRepository: OrganisationRepository = {
    getById: async (id) => organisations.get(id) ?? null,
    list: async () => [...organisations.values()],
    create: async (organisation) => {
      organisations.set(organisation.id, organisation);
    },
    update: async () => {},
    setOwnerPrincipalId: async () => {},
  };

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

  const jobRoleRepository: JobRoleRepository = {
    listForOrganisation: async (organisationId) =>
      [...jobRoles.values()].filter((jobRole) => jobRole.organisationId === organisationId),
    getById: async (id) => jobRoles.get(id) ?? null,
    create: async (jobRole) => {
      jobRoles.set(jobRole.id, jobRole);
    },
  };

  const principalJobRoleRepository: PrincipalJobRoleRepository = {
    listForPrincipal: async (principalId) =>
      principalJobRoles.filter((row) => row.principalId === principalId),
    listForPrincipals: async (principalIds) =>
      principalJobRoles.filter((row) => principalIds.includes(row.principalId)),
    create: async (row) => {
      if (
        !principalJobRoles.some(
          (existing) =>
            existing.principalId === row.principalId && existing.jobRoleId === row.jobRoleId,
        )
      ) {
        principalJobRoles.push(row);
      }
    },
    remove: async (principalId, jobRoleId) => {
      const index = principalJobRoles.findIndex(
        (row) => row.principalId === principalId && row.jobRoleId === jobRoleId,
      );
      if (index !== -1) principalJobRoles.splice(index, 1);
      // Mirrors migration 0052's ON DELETE CASCADE.
      for (let i = projectMemberJobRoles.length - 1; i >= 0; i -= 1) {
        const row = projectMemberJobRoles[i]!;
        if (row.principalId === principalId && row.jobRoleId === jobRoleId) {
          projectMemberJobRoles.splice(i, 1);
        }
      }
    },
  };

  const projectMemberJobRoleRepository: ProjectMemberJobRoleRepository = {
    listForProject: async (projectId) =>
      projectMemberJobRoles.filter((row) => row.projectId === projectId),
    create: async (row) => {
      if (
        !projectMemberJobRoles.some(
          (existing) =>
            existing.projectId === row.projectId &&
            existing.principalId === row.principalId &&
            existing.jobRoleId === row.jobRoleId,
        )
      ) {
        projectMemberJobRoles.push(row);
      }
    },
    remove: async (projectId, principalId, jobRoleId) => {
      const index = projectMemberJobRoles.findIndex(
        (row) =>
          row.projectId === projectId &&
          row.principalId === principalId &&
          row.jobRoleId === jobRoleId,
      );
      if (index !== -1) projectMemberJobRoles.splice(index, 1);
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

  return {
    organisations: organisationRepository,
    projects: projectRepository,
    memberships: membershipRepository,
    jobRoles: jobRoleRepository,
    principalJobRoles: principalJobRoleRepository,
    projectMemberJobRoles: projectMemberJobRoleRepository,
    auditRecords,
  };
}

async function addMembership(
  deps: JobRoleUseCaseDeps,
  principalId: string,
  role: Membership['role'],
  projectId: ProjectId | null,
): Promise<void> {
  const now = new Date().toISOString();
  await deps.memberships.create({
    id: randomUUID() as Membership['id'],
    organisationId: ORG_ID,
    projectId,
    principalId,
    role,
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  });
}

describe('job role use cases (DEVOS-299/300/301)', () => {
  let deps: JobRoleUseCaseDeps;

  beforeEach(async () => {
    deps = createInMemoryDeps();
    await addMembership(deps, 'admin', 'ORGANISATION_ADMIN', null);
    await addMembership(deps, 'owner', 'OWNER', PROJECT_ID);
    await addMembership(deps, 'member', 'MEMBER', PROJECT_ID);
  });

  it('lists the seeded per-organisation catalogue for any member', async () => {
    const jobRoles = await listJobRolesForOrganisation(deps, 'member', ORG_ID);
    expect(jobRoles.map((jobRole) => jobRole.key).sort()).toEqual(['BA', 'DEV']);
  });

  it('rejects listing the catalogue for a non-member', async () => {
    await expect(listJobRolesForOrganisation(deps, 'stranger', ORG_ID)).rejects.toThrow(
      NotFoundError,
    );
  });

  it('grants a job role to a principal, gated to an org admin', async () => {
    // DEVOS-309: 'member' has no org-level membership row at all (only a
    // project-level MEMBER row), so `resolveOrganisationAdminMembership`
    // reports it identically to a non-member — NotFoundError, not
    // ForbiddenError.
    await expect(
      assignPrincipalJobRole(deps, 'member', ORG_ID, 'dev-alice', `${ORG_ID}:DEV`),
    ).rejects.toThrow(NotFoundError);

    const jobRole = await assignPrincipalJobRole(
      deps,
      'admin',
      ORG_ID,
      'dev-alice',
      `${ORG_ID}:DEV`,
    );
    expect(jobRole.key).toBe('DEV');

    const held = await listPrincipalJobRoles(deps, 'admin', ORG_ID, 'dev-alice');
    expect(held.map((jobRole) => jobRole.key)).toEqual(['DEV']);
  });

  it('denies a project-level OWNER with no org-level membership from granting an org-held job role (DEVOS-309)', async () => {
    // `resolveOrganisationAdminMembership` (Sprint 51 reconciliation) closes
    // the same privilege-escalation shape as `organisations.test.ts`'s own
    // equivalent case: a plain project OWNER, never given any
    // organisation-level standing, must not reach `canManageMembers` here
    // either — `assignPrincipalJobRole` is gated identically to
    // `addOrganisationMember`.
    await expect(
      assignPrincipalJobRole(deps, 'owner', ORG_ID, 'dev-alice', `${ORG_ID}:DEV`),
    ).rejects.toThrow(NotFoundError);
  });

  it('rejects assigning a job role that belongs to a different organisation', async () => {
    await expect(
      assignPrincipalJobRole(deps, 'admin', ORG_ID, 'dev-alice', `${OTHER_ORG_ID}:DEV`),
    ).rejects.toThrow(ValidationError);
  });

  it('removes a held job role and cascades it out of every project it was active on', async () => {
    await assignPrincipalJobRole(deps, 'admin', ORG_ID, 'dev-alice', `${ORG_ID}:DEV`);
    await assignProjectMemberJobRole(deps, 'owner', PROJECT_ID, 'dev-alice', `${ORG_ID}:DEV`);

    await removePrincipalJobRole(deps, 'admin', ORG_ID, 'dev-alice', `${ORG_ID}:DEV`);

    expect(await listPrincipalJobRoles(deps, 'admin', ORG_ID, 'dev-alice')).toEqual([]);
    const overview = await getProjectJobRolesOverview(deps, 'owner', PROJECT_ID);
    const aliceRow = overview.members.find((member) => member.principalId === 'dev-alice');
    expect(aliceRow?.activeJobRoleIds ?? []).toEqual([]);
  });

  it('activates a project subset only for job roles the principal already holds (DEVOS-300)', async () => {
    await expect(
      assignProjectMemberJobRole(deps, 'owner', PROJECT_ID, 'dev-alice', `${ORG_ID}:DEV`),
    ).rejects.toThrow(ValidationError);

    await assignPrincipalJobRole(deps, 'admin', ORG_ID, 'dev-alice', `${ORG_ID}:DEV`);
    const row = await assignProjectMemberJobRole(
      deps,
      'owner',
      PROJECT_ID,
      'dev-alice',
      `${ORG_ID}:DEV`,
    );
    expect(row).toMatchObject({
      projectId: PROJECT_ID,
      principalId: 'dev-alice',
      jobRoleId: `${ORG_ID}:DEV`,
    });

    await expect(
      assignProjectMemberJobRole(deps, 'member', PROJECT_ID, 'dev-alice', `${ORG_ID}:DEV`),
    ).rejects.toThrow(ForbiddenError);
  });

  it('deactivates a project subset without affecting the organisation-held grant', async () => {
    await assignPrincipalJobRole(deps, 'admin', ORG_ID, 'dev-alice', `${ORG_ID}:DEV`);
    await assignProjectMemberJobRole(deps, 'owner', PROJECT_ID, 'dev-alice', `${ORG_ID}:DEV`);

    await removeProjectMemberJobRole(deps, 'owner', PROJECT_ID, 'dev-alice', `${ORG_ID}:DEV`);

    const overview = await getProjectJobRolesOverview(deps, 'owner', PROJECT_ID);
    const aliceRow = overview.members.find((member) => member.principalId === 'dev-alice');
    expect(aliceRow).toBeUndefined();

    const held = await listPrincipalJobRoles(deps, 'admin', ORG_ID, 'dev-alice');
    expect(held.map((jobRole) => jobRole.key)).toEqual(['DEV']);
  });

  it('returns one aggregate overview for the whole project members panel (DEVOS-301)', async () => {
    await addMembership(deps, 'dev-alice', 'MEMBER', PROJECT_ID);
    await assignPrincipalJobRole(deps, 'admin', ORG_ID, 'dev-alice', `${ORG_ID}:DEV`);
    await assignPrincipalJobRole(deps, 'admin', ORG_ID, 'dev-alice', `${ORG_ID}:BA`);
    await assignProjectMemberJobRole(deps, 'owner', PROJECT_ID, 'dev-alice', `${ORG_ID}:DEV`);

    const overview = await getProjectJobRolesOverview(deps, 'owner', PROJECT_ID);

    expect(overview.catalogue.map((jobRole) => jobRole.key).sort()).toEqual(['BA', 'DEV']);
    const aliceRow = overview.members.find((member) => member.principalId === 'dev-alice');
    expect(aliceRow?.heldJobRoleIds.sort()).toEqual([`${ORG_ID}:BA`, `${ORG_ID}:DEV`].sort());
    expect(aliceRow?.activeJobRoleIds).toEqual([`${ORG_ID}:DEV`]);
  });
});
