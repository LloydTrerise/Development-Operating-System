import { randomUUID } from 'node:crypto';
import {
  SOFTWARE_DEVELOPMENT_PROJECT_TYPE_ID,
  type AuditRecord,
  type AuditRecordRepository,
  type Integration,
  type IntegrationRepository,
  type Membership,
  type MembershipRepository,
  type OrganisationId,
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
import { ForbiddenError, NotFoundError, ValidationError } from '../src/errors.js';
import { createIntegration } from '../src/integrations/create-integration.js';
import { getIntegrationForPrincipal } from '../src/integrations/get-integration.js';
import { listIntegrationsForProject } from '../src/integrations/list-integrations.js';

function createInMemoryDeps() {
  const projects = new Map<string, Project>();
  const memberships = new Map<string, Membership>();
  const integrationsStore = new Map<string, Integration>();

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

  const integrations: IntegrationRepository = {
    getById: async (id) => integrationsStore.get(id) ?? null,
    listForProject: async (projectId) =>
      [...integrationsStore.values()].filter((i) => i.projectId === projectId),
    create: async (integration) => {
      integrationsStore.set(integration.id, integration);
    },
  };

  const auditRecordsStore: AuditRecord[] = [];
  const auditRecords: AuditRecordRepository = {
    create: async (record) => {
      auditRecordsStore.push(record);
    },
    listForProject: async (projectId) => auditRecordsStore.filter((r) => r.projectId === projectId),
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
    memberships: membershipRepository,
    integrations,
    auditRecords,
    projectTypes,
    projectTypeWorkflows,
    projectTypeAgents,
    createProjectWithClones,
  };
}

const VALID_INPUT = {
  type: 'Git',
  provider: 'github',
  name: 'Primary GitHub connection',
  credentialReference: 'GITHUB_TOKEN',
  configuration: { owner: 'devos', repo: 'devos' },
};

describe('integration use cases', () => {
  let deps: ReturnType<typeof createInMemoryDeps>;
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

  it('creates an ACTIVE integration storing only a credential reference, never a secret value', async () => {
    const integration = await createIntegration(deps, 'alice', projectId, VALID_INPUT);

    expect(integration.status).toBe('ACTIVE');
    expect(integration.credentialReference).toBe('GITHUB_TOKEN');
    expect(integration.configuration).toEqual({ owner: 'devos', repo: 'devos' });
  });

  it('DEVOS-086: writes an audit record when an integration is registered', async () => {
    const integration = await createIntegration(deps, 'alice', projectId, VALID_INPUT);

    const records = await deps.auditRecords.listForProject(projectId);
    expect(records).toContainEqual(
      expect.objectContaining({
        action: 'integration.created',
        actorId: 'alice',
        targetType: 'Integration',
        targetId: integration.id,
        outcome: 'SUCCESS',
      }),
    );
    // The credential value is never in scope here to leak — only its
    // reference name — but confirm the audit metadata doesn't carry it
    // either (DEVOS-083's guarantee, re-checked at this new call site).
    const record = records.find((r) => r.targetId === integration.id);
    expect(JSON.stringify(record?.metadata)).not.toContain('GITHUB_TOKEN');
  });

  it('rejects a missing credentialReference', async () => {
    await expect(
      createIntegration(deps, 'alice', projectId, { ...VALID_INPUT, credentialReference: '  ' }),
    ).rejects.toThrow(ValidationError);
  });

  it('rejects empty type/provider/name', async () => {
    await expect(
      createIntegration(deps, 'alice', projectId, { ...VALID_INPUT, type: '' }),
    ).rejects.toThrow(ValidationError);
    await expect(
      createIntegration(deps, 'alice', projectId, { ...VALID_INPUT, provider: '' }),
    ).rejects.toThrow(ValidationError);
    await expect(
      createIntegration(deps, 'alice', projectId, { ...VALID_INPUT, name: '' }),
    ).rejects.toThrow(ValidationError);
  });

  it('lists integrations for a project and rejects non-members', async () => {
    await createIntegration(deps, 'alice', projectId, VALID_INPUT);

    const listed = await listIntegrationsForProject(deps, 'alice', projectId);
    expect(listed).toHaveLength(1);

    await expect(listIntegrationsForProject(deps, 'mallory', projectId)).rejects.toThrow(
      NotFoundError,
    );
  });

  it('rejects a configuration value that looks like a secret rather than a reference (DEVOS-083 secret hardening)', async () => {
    await expect(
      createIntegration(deps, 'alice', projectId, {
        ...VALID_INPUT,
        configuration: { owner: 'devos', token: 'ghp_actualSecretValue' },
      }),
    ).rejects.toThrow(ValidationError);

    await expect(
      createIntegration(deps, 'alice', projectId, {
        ...VALID_INPUT,
        configuration: { auth: { apiKey: 'sk-actual-secret' } },
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('accepts configuration with no secret-shaped keys', async () => {
    const integration = await createIntegration(deps, 'alice', projectId, {
      ...VALID_INPUT,
      configuration: { owner: 'devos', repo: 'devos', repositoryPath: '/tmp/repo' },
    });

    expect(integration.configuration).toEqual({
      owner: 'devos',
      repo: 'devos',
      repositoryPath: '/tmp/repo',
    });
  });

  it('rejects registering an integration by a non-owner member (DEVOS-082 RBAC hardening)', async () => {
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

    await expect(createIntegration(deps, 'bob', projectId, VALID_INPUT)).rejects.toThrow(
      ForbiddenError,
    );
  });

  it('gets a single integration by id for a member, and 404s for a non-member', async () => {
    const integration = await createIntegration(deps, 'alice', projectId, VALID_INPUT);

    const fetched = await getIntegrationForPrincipal(deps, 'alice', integration.id);
    expect(fetched.id).toBe(integration.id);

    await expect(getIntegrationForPrincipal(deps, 'mallory', integration.id)).rejects.toThrow(
      NotFoundError,
    );
  });
});
