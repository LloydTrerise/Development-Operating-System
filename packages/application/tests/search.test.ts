import { randomUUID } from 'node:crypto';
import {
  SOFTWARE_DEVELOPMENT_PROJECT_TYPE_ID,
  type Agent,
  type AgentRepository,
  type Artifact,
  type ArtifactRepository,
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
  type WorkItem,
  type WorkItemRepository,
  type WorkflowDefinition,
  type WorkflowDefinitionRepository,
} from '@devos/domain';
import { beforeEach, describe, expect, it } from 'vitest';
import { createProject } from '../src/projects/create-project.js';
import type { CreateProjectWithClones } from '../src/projects/deps.js';
import { NotFoundError } from '../src/errors.js';
import { searchProject } from '../src/search/search-project.js';
import type { SearchUseCaseDeps } from '../src/search/deps.js';

function createInMemoryDeps() {
  const projects = new Map<string, Project>();
  const memberships = new Map<string, Membership>();
  const workItemsStore = new Map<string, WorkItem>();
  const artifactsStore = new Map<string, Artifact>();
  const workflowsStore = new Map<string, WorkflowDefinition>();
  const agentsStore = new Map<string, Agent>();

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

  function textSearch(haystack: string, query: string): boolean {
    return haystack.toLowerCase().includes(query.toLowerCase());
  }

  const workItems: WorkItemRepository = {
    getById: async (id) => workItemsStore.get(id) ?? null,
    listForProject: async (projectId) =>
      [...workItemsStore.values()].filter((item) => item.projectId === projectId),
    create: async (workItem) => {
      workItemsStore.set(workItem.id, workItem);
    },
    update: async (id, changes, updatedAt) => {
      const existing = workItemsStore.get(id);
      if (!existing) return;
      workItemsStore.set(id, { ...existing, ...changes, updatedAt });
    },
    searchForProject: async (projectId, query) =>
      [...workItemsStore.values()].filter(
        (item) =>
          item.projectId === projectId &&
          (textSearch(item.title, query) || textSearch(item.description ?? '', query)),
      ),
  };

  const artifacts: ArtifactRepository = {
    getById: async (id) => artifactsStore.get(id) ?? null,
    listForProject: async (projectId) =>
      [...artifactsStore.values()].filter((a) => a.projectId === projectId),
    create: async (artifact) => {
      artifactsStore.set(artifact.id, artifact);
    },
    searchForProject: async (projectId, query) =>
      [...artifactsStore.values()].filter(
        (a) => a.projectId === projectId && textSearch(a.name, query),
      ),
  };

  const workflowDefinitions: WorkflowDefinitionRepository = {
    getById: async (id) => workflowsStore.get(id) ?? null,
    getByProjectAndKey: async (projectId, key) =>
      [...workflowsStore.values()].find((w) => w.projectId === projectId && w.key === key) ?? null,
    listForProject: async (projectId) =>
      [...workflowsStore.values()].filter((w) => w.projectId === projectId),
    create: async (definition) => {
      workflowsStore.set(definition.id, definition);
    },
    searchForProject: async (projectId, query) =>
      [...workflowsStore.values()].filter(
        (w) =>
          w.projectId === projectId &&
          (textSearch(w.name, query) || textSearch(w.description ?? '', query)),
      ),
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
    searchForProject: async (projectId, query) =>
      [...agentsStore.values()].filter(
        (a) =>
          a.projectId === projectId &&
          (textSearch(a.name, query) || textSearch(a.description ?? '', query)),
      ),
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

  const auditRecordsStore: AuditRecord[] = [];
  const auditRecords: AuditRecordRepository = {
    create: async (record) => {
      auditRecordsStore.push(record);
    },
    listForProject: async (projectId) => auditRecordsStore.filter((r) => r.projectId === projectId),
    listForOrganisation: async (organisationId) =>
      auditRecordsStore.filter((r) => r.organisationId === organisationId),
  };

  return {
    projects: projectRepository,
    memberships: membershipRepository,
    workItems,
    artifacts,
    workflowDefinitions,
    agents,
    projectTypes,
    projectTypeWorkflows,
    projectTypeAgents,
    createProjectWithClones,
    auditRecords,
  };
}

describe('searchProject (DEVOS-262)', () => {
  let deps: ReturnType<typeof createInMemoryDeps> & SearchUseCaseDeps;
  let projectId: Project['id'];
  const organisationId = randomUUID() as OrganisationId;

  beforeEach(async () => {
    deps = createInMemoryDeps();
    const project = await createProject(deps, 'alice', {
      organisationId,
      name: 'Search Project',
      slug: 'search-project',
    });
    projectId = project.id;

    await deps.workItems.create({
      id: randomUUID() as WorkItem['id'],
      projectId,
      title: 'Add CSV export to the dashboard',
      description: 'A real work item',
      type: 'TASK',
      status: 'OPEN',
      priority: 'MEDIUM',
      metadata: {},
      createdBy: 'alice',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await deps.artifacts.create({
      id: randomUUID() as Artifact['id'],
      projectId,
      artifactType: 'REPORT',
      name: 'Discovery Report — dashboard',
      status: 'GENERATED',
      createdBy: 'alice',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await deps.workflowDefinitions.create({
      id: randomUUID() as WorkflowDefinition['id'],
      projectId,
      key: 'dashboard-path',
      name: 'Dashboard Path',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await deps.agents.create({
      id: randomUUID() as Agent['id'],
      projectId,
      key: 'dashboard-agent',
      name: 'Dashboard Agent',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });

  it('aggregates real matches across all four entity types for a member', async () => {
    const results = await searchProject(deps, 'alice', projectId, 'dashboard');

    expect(results.projectId).toBe(projectId);
    expect(results.query).toBe('dashboard');
    expect(results.workItems).toHaveLength(1);
    expect(results.artifacts).toHaveLength(1);
    expect(results.workflows).toHaveLength(1);
    expect(results.agents).toHaveLength(1);
  });

  it('short-circuits to empty results for all four entities on an empty query, without calling any repository', async () => {
    const results = await searchProject(deps, 'alice', projectId, '   ');

    expect(results).toEqual({
      projectId,
      query: '',
      workItems: [],
      artifacts: [],
      workflows: [],
      agents: [],
    });
  });

  it('returns empty results for a query with no matches', async () => {
    const results = await searchProject(deps, 'alice', projectId, 'nonexistent-keyword');

    expect(results.workItems).toHaveLength(0);
    expect(results.artifacts).toHaveLength(0);
    expect(results.workflows).toHaveLength(0);
    expect(results.agents).toHaveLength(0);
  });

  it('404s a non-member', async () => {
    await expect(searchProject(deps, 'mallory', projectId, 'dashboard')).rejects.toThrow(
      NotFoundError,
    );
  });

  it('404s a search against a project that does not exist', async () => {
    await expect(
      searchProject(deps, 'alice', randomUUID() as Project['id'], 'dashboard'),
    ).rejects.toThrow(NotFoundError);
  });
});
