import { randomUUID } from 'node:crypto';
import type {
  AuditRecord,
  AuditRecordRepository,
  Membership,
  MembershipRepository,
  OrganisationId,
  Policy,
  PolicyRepository,
  Project,
  ProjectRepository,
} from '@devos/domain';
import { beforeEach, describe, expect, it } from 'vitest';
import { createProject } from '../src/projects/create-project.js';
import { createPolicy } from '../src/policy/create-policy.js';
import type { PolicyUseCaseDeps } from '../src/policy/deps.js';
import { getPolicyForPrincipal } from '../src/policy/get-policy.js';
import { listPoliciesForProject } from '../src/policy/list-policies.js';
import { publishPolicy } from '../src/policy/publish-policy.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../src/errors.js';

function createInMemoryDeps(): PolicyUseCaseDeps {
  const projects = new Map<string, Project>();
  const memberships = new Map<string, Membership>();
  const policiesStore = new Map<string, Policy>();

  const projectRepository: ProjectRepository = {
    getById: async (id) => projects.get(id) ?? null,
    listForOrganisation: async (organisationId) =>
      [...projects.values()].filter((p) => p.organisationId === organisationId),
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

  const policies: PolicyRepository = {
    getById: async (id) => policiesStore.get(id) ?? null,
    getByProjectAndKeyAndVersion: async (projectId, key, version) =>
      [...policiesStore.values()].find(
        (p) => p.projectId === projectId && p.key === key && p.version === version,
      ) ?? null,
    getLatestForProjectAndKey: async (projectId, key) =>
      [...policiesStore.values()]
        .filter((p) => p.projectId === projectId && p.key === key)
        .sort((a, b) => b.version - a.version)[0] ?? null,
    listForProject: async (projectId) =>
      [...policiesStore.values()].filter((p) => p.projectId === projectId),
    create: async (policy) => {
      policiesStore.set(policy.id, policy);
    },
    publish: async (id, publishedAt) => {
      const existing = policiesStore.get(id);
      if (!existing) return;
      policiesStore.set(id, { ...existing, status: 'PUBLISHED', publishedAt });
    },
  };

  const auditRecordsStore: AuditRecord[] = [];
  const auditRecords: AuditRecordRepository = {
    create: async (record) => {
      auditRecordsStore.push(record);
    },
    listForProject: async (projectId) => auditRecordsStore.filter((r) => r.projectId === projectId),
  };

  return { projects: projectRepository, memberships: membershipRepository, policies, auditRecords };
}

const VALID_DEFINITION = { rule: 'require-approval', scope: 'production-release' };

describe('policy use cases', () => {
  let deps: PolicyUseCaseDeps;
  let projectId: Project['id'];
  const organisationId = randomUUID() as OrganisationId;

  beforeEach(async () => {
    deps = createInMemoryDeps();
    const project = await createProject(deps, 'alice', {
      organisationId,
      name: 'Test Project',
      slug: 'test-project',
    });
    projectId = project.id;
  });

  it('creates a draft policy at version 1', async () => {
    const policy = await createPolicy(deps, 'alice', projectId, {
      key: 'release-approval',
      definition: VALID_DEFINITION,
    });

    expect(policy.version).toBe(1);
    expect(policy.status).toBe('DRAFT');
    expect(policy.organisationId).toBe(organisationId);
    expect(policy.createdBy).toBe('alice');
  });

  it('rejects creating a second draft while one is already pending', async () => {
    await createPolicy(deps, 'alice', projectId, { key: 'dup', definition: VALID_DEFINITION });

    await expect(
      createPolicy(deps, 'alice', projectId, { key: 'dup', definition: VALID_DEFINITION }),
    ).rejects.toThrow(ValidationError);
  });

  it('creates version 2 as a new draft once version 1 is published', async () => {
    const v1 = await createPolicy(deps, 'alice', projectId, {
      key: 'revisable',
      definition: VALID_DEFINITION,
    });
    await publishPolicy(deps, 'alice', v1.id);

    const v2 = await createPolicy(deps, 'alice', projectId, {
      key: 'revisable',
      definition: { ...VALID_DEFINITION, scope: 'staging-release' },
    });

    expect(v2.version).toBe(2);
    expect(v2.status).toBe('DRAFT');
  });

  it('rejects an empty definition', async () => {
    await expect(
      createPolicy(deps, 'alice', projectId, { key: 'empty', definition: {} }),
    ).rejects.toThrow(ValidationError);
  });

  it('publishes a draft, then rejects publishing again (immutability)', async () => {
    const policy = await createPolicy(deps, 'alice', projectId, {
      key: 'publishable',
      definition: VALID_DEFINITION,
    });

    const published = await publishPolicy(deps, 'alice', policy.id);
    expect(published.status).toBe('PUBLISHED');
    expect(published.publishedAt).toBeDefined();

    await expect(publishPolicy(deps, 'alice', policy.id)).rejects.toThrow(ValidationError);
  });

  it('DEVOS-086: writes an audit record when a policy is published', async () => {
    const policy = await createPolicy(deps, 'alice', projectId, {
      key: 'audited',
      definition: VALID_DEFINITION,
    });

    await publishPolicy(deps, 'alice', policy.id);

    const records = await deps.auditRecords.listForProject(projectId);
    expect(records).toContainEqual(
      expect.objectContaining({
        action: 'policy.published',
        actorId: 'alice',
        targetType: 'Policy',
        targetId: policy.id,
        outcome: 'SUCCESS',
      }),
    );
  });

  it('lists policies for a project and rejects non-members', async () => {
    await createPolicy(deps, 'alice', projectId, { key: 'listed', definition: VALID_DEFINITION });

    const policies = await listPoliciesForProject(deps, 'alice', projectId);
    expect(policies).toHaveLength(1);

    await expect(listPoliciesForProject(deps, 'mallory', projectId)).rejects.toThrow(NotFoundError);
  });

  it('rejects publishing by a non-owner member (DEVOS-082 RBAC hardening)', async () => {
    const policy = await createPolicy(deps, 'alice', projectId, {
      key: 'member-cannot-publish',
      definition: VALID_DEFINITION,
    });

    await deps.memberships.create({
      id: randomUUID() as Membership['id'],
      organisationId,
      projectId,
      principalId: 'bob',
      role: 'MEMBER',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await expect(publishPolicy(deps, 'bob', policy.id)).rejects.toThrow(ForbiddenError);
  });

  it('gets a single policy by id for a member, and 404s for a non-member', async () => {
    const policy = await createPolicy(deps, 'alice', projectId, {
      key: 'gettable',
      definition: VALID_DEFINITION,
    });

    const fetched = await getPolicyForPrincipal(deps, 'alice', policy.id);
    expect(fetched.id).toBe(policy.id);

    await expect(getPolicyForPrincipal(deps, 'mallory', policy.id)).rejects.toThrow(NotFoundError);
  });
});
