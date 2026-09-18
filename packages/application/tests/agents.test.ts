import { randomUUID } from 'node:crypto';
import {
  SOFTWARE_DEVELOPMENT_PROJECT_TYPE_ID,
  type Agent,
  type AgentRepository,
  type AgentVersion,
  type AgentVersionRepository,
  type AuditRecord,
  type AuditRecordRepository,
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
import { createAgent } from '../src/agents/create-agent.js';
import type { CreateAgentDraft } from '../src/agents/deps.js';
import { getAgentForPrincipal } from '../src/agents/get-agent.js';
import { listAgentsForProject } from '../src/agents/list-agents.js';
import { publishAgentVersion } from '../src/agents/publish-agent-version.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../src/errors.js';
import type { CreateProjectWithClones } from '../src/projects/deps.js';

function createInMemoryDeps() {
  const projects = new Map<string, Project>();
  const memberships = new Map<string, Membership>();
  const agentsStore = new Map<string, Agent>();
  const versionsStore = new Map<string, AgentVersion>();

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

  const agents: AgentRepository = {
    getById: async (id) => agentsStore.get(id) ?? null,
    getByProjectAndKey: async (projectId, key) =>
      [...agentsStore.values()].find((a) => a.projectId === projectId && a.key === key) ?? null,
    listForProject: async (projectId) =>
      [...agentsStore.values()].filter((a) => a.projectId === projectId),
    create: async (agent) => {
      agentsStore.set(agent.id, agent);
    },
  };

  const agentVersions: AgentVersionRepository = {
    getById: async (id) => versionsStore.get(id) ?? null,
    getByAgentAndVersion: async (agentId, version) =>
      [...versionsStore.values()].find((v) => v.agentId === agentId && v.version === version) ??
      null,
    getLatestForAgent: async (agentId) =>
      [...versionsStore.values()]
        .filter((v) => v.agentId === agentId)
        .sort((a, b) => b.version - a.version)[0] ?? null,
    listForAgent: async (agentId) =>
      [...versionsStore.values()].filter((v) => v.agentId === agentId),
    create: async (version) => {
      versionsStore.set(version.id, version);
    },
    publish: async (id, publishedAt) => {
      const existing = versionsStore.get(id);
      if (!existing) return;
      versionsStore.set(id, { ...existing, status: 'PUBLISHED', publishedAt });
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
  const createDraft: CreateAgentDraft = async (agent, version) => {
    await agents.create(agent);
    await agentVersions.create(version);
  };

  return {
    projects: projectRepository,
    memberships: membershipRepository,
    agents,
    agentVersions,
    createDraft,
    auditRecords,
    projectTypes,
    projectTypeWorkflows,
    projectTypeAgents,
    createProjectWithClones,
  };
}

const VALID_CONFIGURATION = {
  role: 'REQUIREMENTS',
  provider: 'gemini',
  modelRef: 'gemini-2.0-flash',
  allowedCapabilities: ['knowledge.read', 'artifact.write'],
};

describe('agent use cases', () => {
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

  it('creates a draft agent at version 1', async () => {
    const { agent, version } = await createAgent(deps, 'alice', projectId, {
      key: 'requirements-agent',
      name: 'Requirements Agent',
      configuration: VALID_CONFIGURATION,
    });

    expect(agent.key).toBe('requirements-agent');
    expect(agent.status).toBe('ACTIVE');
    expect(version.version).toBe(1);
    expect(version.status).toBe('DRAFT');
    expect(version.createdBy).toBe('alice');
  });

  it('rejects a duplicate key within the same project', async () => {
    await createAgent(deps, 'alice', projectId, {
      key: 'dup',
      name: 'First',
      configuration: VALID_CONFIGURATION,
    });

    await expect(
      createAgent(deps, 'alice', projectId, {
        key: 'dup',
        name: 'Second',
        configuration: VALID_CONFIGURATION,
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('rejects a configuration missing a required field', async () => {
    await expect(
      createAgent(deps, 'alice', projectId, {
        key: 'incomplete',
        name: 'Incomplete',
        configuration: { ...VALID_CONFIGURATION, role: '' },
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('publishes a draft, then rejects publishing again (no draft left)', async () => {
    const { agent } = await createAgent(deps, 'alice', projectId, {
      key: 'publishable',
      name: 'Publishable',
      configuration: VALID_CONFIGURATION,
    });

    const published = await publishAgentVersion(deps, 'alice', agent.id);
    expect(published.status).toBe('PUBLISHED');
    expect(published.publishedAt).toBeDefined();

    await expect(publishAgentVersion(deps, 'alice', agent.id)).rejects.toThrow(ValidationError);
  });

  it('DEVOS-086: writes an audit record when an agent version is published', async () => {
    const { agent, version } = await createAgent(deps, 'alice', projectId, {
      key: 'audited',
      name: 'Audited',
      configuration: VALID_CONFIGURATION,
    });

    await publishAgentVersion(deps, 'alice', agent.id);

    const records = await deps.auditRecords.listForProject(projectId);
    expect(records).toContainEqual(
      expect.objectContaining({
        action: 'agent_version.published',
        actorId: 'alice',
        targetType: 'AgentVersion',
        targetId: version.id,
        outcome: 'SUCCESS',
      }),
    );
  });

  it('rejects publishing an agent version by a non-owner member (DEVOS-082 RBAC hardening)', async () => {
    const { agent } = await createAgent(deps, 'alice', projectId, {
      key: 'member-cannot-publish',
      name: 'Member Cannot Publish',
      configuration: VALID_CONFIGURATION,
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

    await expect(publishAgentVersion(deps, 'bob', agent.id)).rejects.toThrow(ForbiddenError);
  });

  it('lists agents for a project and rejects non-members with 404-equivalent NotFoundError', async () => {
    await createAgent(deps, 'alice', projectId, {
      key: 'listed',
      name: 'Listed',
      configuration: VALID_CONFIGURATION,
    });

    const agents = await listAgentsForProject(deps, 'alice', projectId);
    expect(agents).toHaveLength(1);

    await expect(listAgentsForProject(deps, 'mallory', projectId)).rejects.toThrow(NotFoundError);
  });

  it('gets a single agent by id for a member, and 404s for a non-member', async () => {
    const { agent } = await createAgent(deps, 'alice', projectId, {
      key: 'gettable',
      name: 'Gettable',
      configuration: VALID_CONFIGURATION,
    });

    const fetched = await getAgentForPrincipal(deps, 'alice', agent.id);
    expect(fetched.id).toBe(agent.id);

    await expect(getAgentForPrincipal(deps, 'mallory', agent.id)).rejects.toThrow(NotFoundError);
  });
});
