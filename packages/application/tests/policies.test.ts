import { randomUUID } from 'node:crypto';
import {
  SOFTWARE_DEVELOPMENT_PROJECT_TYPE_ID,
  type AuditRecord,
  type AuditRecordRepository,
  type Membership,
  type MembershipRepository,
  type Organisation,
  type OrganisationId,
  type OrganisationRepository,
  type Policy,
  type PolicyRepository,
  type Project,
  type ProjectRepository,
  type ProjectType,
  type ProjectTypeAgentRepository,
  type ProjectTypeRepository,
  type ProjectTypeWorkflowRepository,
} from '@devos/domain';
import { beforeEach, describe, expect, it } from 'vitest';
import { createProject } from '../src/projects/create-project.js';
import type { CreateProjectWithClones } from '../src/projects/deps.js';
import { createOrganisationPolicy } from '../src/policy/create-organisation-policy.js';
import { createPolicy } from '../src/policy/create-policy.js';
import { getPolicyForPrincipal } from '../src/policy/get-policy.js';
import { listPoliciesForOrganisation } from '../src/policy/list-organisation-policies.js';
import { listPoliciesForProject } from '../src/policy/list-policies.js';
import { publishPolicy } from '../src/policy/publish-policy.js';
import { simulatePolicy } from '../src/policy/simulate-policy.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../src/errors.js';

function createInMemoryDeps() {
  const projects = new Map<string, Project>();
  const memberships = new Map<string, Membership>();
  const policiesStore = new Map<string, Policy>();
  const organisationsStore = new Map<string, Organisation>();

  const organisations: OrganisationRepository = {
    getById: async (id) => organisationsStore.get(id) ?? null,
    list: async () => [...organisationsStore.values()],
    create: async (organisation) => {
      organisationsStore.set(organisation.id, organisation);
    },
    update: async (id, changes, updatedAt) => {
      const existing = organisationsStore.get(id);
      if (!existing) return;
      organisationsStore.set(id, { ...existing, ...changes, updatedAt });
    },
  };

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
    getLatestForOrganisationAndKey: async (organisationId, key) =>
      [...policiesStore.values()]
        .filter(
          (p) => p.organisationId === organisationId && p.projectId === undefined && p.key === key,
        )
        .sort((a, b) => b.version - a.version)[0] ?? null,
    listForOrganisation: async (organisationId) =>
      [...policiesStore.values()].filter(
        (p) => p.organisationId === organisationId && p.projectId === undefined,
      ),
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
    listForOrganisation: async (organisationId) =>
      auditRecordsStore.filter((r) => r.organisationId === organisationId),
  };

  const now = new Date().toISOString();
  const projectTypesStore = new Map<string, ProjectType>([
    [
      SOFTWARE_DEVELOPMENT_PROJECT_TYPE_ID,
      {
        id: SOFTWARE_DEVELOPMENT_PROJECT_TYPE_ID,
        key: 'software-development',
        name: 'Software Development',
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
      },
    ],
  ]);
  const projectTypes: ProjectTypeRepository = {
    getById: async (id) => projectTypesStore.get(id) ?? null,
    getByKey: async (key) => [...projectTypesStore.values()].find((p) => p.key === key) ?? null,
    list: async () => [...projectTypesStore.values()],
    create: async (projectType) => {
      projectTypesStore.set(projectType.id, projectType);
    },
    update: async (id, changes, updatedAt) => {
      const existing = projectTypesStore.get(id);
      if (!existing) return;
      projectTypesStore.set(id, { ...existing, ...changes, updatedAt });
    },
  };
  const projectTypeWorkflows: ProjectTypeWorkflowRepository = {
    getById: async () => null,
    getByProjectTypeAndKey: async () => null,
    listForProjectType: async () => [],
    create: async () => {},
    update: async () => {},
  };
  const projectTypeAgents: ProjectTypeAgentRepository = {
    getById: async () => null,
    getByProjectTypeAndKey: async () => null,
    listForProjectType: async () => [],
    create: async () => {},
    update: async () => {},
  };
  const createProjectWithClones: CreateProjectWithClones = async (project, membership) => {
    await projectRepository.create(project);
    await membershipRepository.create(membership);
  };

  return {
    projects: projectRepository,
    organisations,
    memberships: membershipRepository,
    policies,
    auditRecords,
    projectTypes,
    projectTypeWorkflows,
    projectTypeAgents,
    createProjectWithClones,
  };
}

const VALID_DEFINITION = { rule: 'require-approval', scope: 'production-release' };

describe('policy use cases', () => {
  let deps: ReturnType<typeof createInMemoryDeps>;
  let projectId: Project['id'];
  const organisationId = randomUUID() as OrganisationId;

  beforeEach(async () => {
    deps = createInMemoryDeps();
    const now = new Date().toISOString();
    await deps.organisations.create({
      id: organisationId,
      name: 'Test Organisation',
      slug: 'test-organisation',
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    });
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

  describe('DEVOS-139: organisation-scoped policies', () => {
    it('creates a draft organisation policy at version 1 with no projectId', async () => {
      const policy = await createOrganisationPolicy(deps, 'alice', organisationId, {
        key: 'org-release-approval',
        definition: VALID_DEFINITION,
      });

      expect(policy.version).toBe(1);
      expect(policy.status).toBe('DRAFT');
      expect(policy.organisationId).toBe(organisationId);
      expect(policy.projectId).toBeUndefined();
    });

    it('rejects creating a second organisation draft while one is already pending', async () => {
      await createOrganisationPolicy(deps, 'alice', organisationId, {
        key: 'org-dup',
        definition: VALID_DEFINITION,
      });

      await expect(
        createOrganisationPolicy(deps, 'alice', organisationId, {
          key: 'org-dup',
          definition: VALID_DEFINITION,
        }),
      ).rejects.toThrow(ValidationError);
    });

    it('creates organisation version 2 as a new draft once version 1 is published', async () => {
      const v1 = await createOrganisationPolicy(deps, 'alice', organisationId, {
        key: 'org-revisable',
        definition: VALID_DEFINITION,
      });
      const published = await publishPolicy(deps, 'alice', v1.id);
      expect(published.status).toBe('PUBLISHED');
      expect(published.projectId).toBeUndefined();

      const v2 = await createOrganisationPolicy(deps, 'alice', organisationId, {
        key: 'org-revisable',
        definition: { ...VALID_DEFINITION, scope: 'staging-release' },
      });

      expect(v2.version).toBe(2);
      expect(v2.status).toBe('DRAFT');
    });

    it('rejects publishing an organisation policy by a non-owner member', async () => {
      const policy = await createOrganisationPolicy(deps, 'alice', organisationId, {
        key: 'org-member-cannot-publish',
        definition: VALID_DEFINITION,
      });

      await deps.memberships.create({
        id: randomUUID() as Membership['id'],
        organisationId,
        projectId: null,
        principalId: 'bob',
        role: 'MEMBER',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await expect(publishPolicy(deps, 'bob', policy.id)).rejects.toThrow(ForbiddenError);
    });

    it('lists organisation policies separately from project policies, and rejects non-members', async () => {
      await createPolicy(deps, 'alice', projectId, {
        key: 'project-only',
        definition: VALID_DEFINITION,
      });
      await createOrganisationPolicy(deps, 'alice', organisationId, {
        key: 'org-only',
        definition: VALID_DEFINITION,
      });

      const organisationPolicies = await listPoliciesForOrganisation(deps, 'alice', organisationId);
      expect(organisationPolicies).toHaveLength(1);
      expect(organisationPolicies[0]?.key).toBe('org-only');

      const projectPolicies = await listPoliciesForProject(deps, 'alice', projectId);
      expect(projectPolicies).toHaveLength(1);
      expect(projectPolicies[0]?.key).toBe('project-only');

      await expect(listPoliciesForOrganisation(deps, 'mallory', organisationId)).rejects.toThrow(
        NotFoundError,
      );
    });

    it('gets a single organisation policy by id for a member, and 404s for a non-member', async () => {
      const policy = await createOrganisationPolicy(deps, 'alice', organisationId, {
        key: 'org-gettable',
        definition: VALID_DEFINITION,
      });

      const fetched = await getPolicyForPrincipal(deps, 'alice', policy.id);
      expect(fetched.id).toBe(policy.id);

      await expect(getPolicyForPrincipal(deps, 'mallory', policy.id)).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  describe('DEVOS-141: policy simulation against real historical requests', () => {
    async function seedToolInvocationAuditRecord(
      action: string,
      outcome: AuditRecord['outcome'],
    ): Promise<void> {
      await deps.auditRecords.create({
        id: randomUUID() as AuditRecord['id'],
        organisationId,
        projectId,
        actorType: 'SYSTEM',
        actorId: 'devos-agent-runtime',
        action: `tool_invocation.${outcome === 'SUCCESS' ? 'succeeded' : 'rejected'}`,
        targetType: 'ToolInvocation',
        targetId: randomUUID(),
        outcome,
        metadata: { capability: action },
        createdAt: new Date().toISOString(),
      });
    }

    it('shows a draft DENY rule would have rejected a real historical request that actually succeeded', async () => {
      await seedToolInvocationAuditRecord('deploy', 'SUCCESS');

      const draft = await createPolicy(deps, 'alice', projectId, {
        key: 'sim-deploy-lockdown',
        definition: { rules: [{ action: 'deploy', effect: 'DENY' }] },
      });

      const simulated = await simulatePolicy(deps, 'alice', draft.id);

      expect(simulated).toHaveLength(1);
      expect(simulated[0]).toMatchObject({
        action: 'deploy',
        actualOutcome: 'SUCCESS',
        decision: { decision: 'DENY' },
      });
    });

    it('ignores audit records with no recorded capability (no reliable action to replay)', async () => {
      await deps.auditRecords.create({
        id: randomUUID() as AuditRecord['id'],
        organisationId,
        projectId,
        actorType: 'USER',
        actorId: 'alice',
        action: 'policy.published',
        targetType: 'Policy',
        targetId: randomUUID(),
        outcome: 'SUCCESS',
        metadata: { key: 'some-policy', version: 1 },
        createdAt: new Date().toISOString(),
      });

      const draft = await createPolicy(deps, 'alice', projectId, {
        key: 'sim-unrelated',
        definition: { rules: [{ action: 'deploy', effect: 'DENY' }] },
      });

      const simulated = await simulatePolicy(deps, 'alice', draft.id);

      expect(simulated).toHaveLength(0);
    });

    it('rejects simulation for a non-member', async () => {
      const draft = await createPolicy(deps, 'alice', projectId, {
        key: 'sim-isolated',
        definition: { rules: [{ action: 'deploy', effect: 'DENY' }] },
      });

      await expect(simulatePolicy(deps, 'mallory', draft.id)).rejects.toThrow(NotFoundError);
    });

    it("an organisation-scoped draft is simulated against the organisation's own historical requests", async () => {
      await seedToolInvocationAuditRecord('release.publish', 'SUCCESS');

      const draft = await createOrganisationPolicy(deps, 'alice', organisationId, {
        key: 'sim-org-lockdown',
        definition: { rules: [{ action: 'release.publish', effect: 'REQUIRE_APPROVAL' }] },
      });

      const simulated = await simulatePolicy(deps, 'alice', draft.id);

      expect(simulated).toHaveLength(1);
      expect(simulated[0]).toMatchObject({
        action: 'release.publish',
        decision: { decision: 'REQUIRE_APPROVAL' },
      });
    });

    it('Gap revisit: replays a real approval.approved record using its own approvalType, now that it carries one', async () => {
      await deps.auditRecords.create({
        id: randomUUID() as AuditRecord['id'],
        organisationId,
        projectId,
        actorType: 'USER',
        actorId: 'bob',
        action: 'approval.approved',
        targetType: 'Approval',
        targetId: randomUUID(),
        outcome: 'SUCCESS',
        metadata: { approvalType: 'remediation-gate', decisionReason: 'Looks fine.' },
        createdAt: new Date().toISOString(),
      });

      const draft = await createPolicy(deps, 'alice', projectId, {
        key: 'sim-remediation-lockdown',
        definition: { rules: [{ action: 'remediation-gate', effect: 'DENY' }] },
      });

      const simulated = await simulatePolicy(deps, 'alice', draft.id);

      expect(simulated).toHaveLength(1);
      expect(simulated[0]).toMatchObject({
        action: 'remediation-gate',
        actualOutcome: 'SUCCESS',
        decision: { decision: 'DENY' },
      });
    });
  });
});
