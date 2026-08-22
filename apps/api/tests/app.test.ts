import { createServer, type Server } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type {
  AgentExecutionSummaryUseCaseDeps,
  AgentUseCaseDeps,
  ArtifactUseCaseDeps,
  ProjectUseCaseDeps,
  WorkItemUseCaseDeps,
  WorkflowUseCaseDeps,
} from '@devos/application';
import type { DatabaseClient } from '@devos/database';
import type {
  Agent,
  AgentExecution,
  AgentExecutionRepository,
  AgentRepository,
  AgentVersion,
  AgentVersionRepository,
  Artifact,
  ArtifactRepository,
  ArtifactVersion,
  ArtifactVersionRepository,
  ContextManifest,
  ContextManifestRepository,
  Membership,
  MembershipRepository,
  Project,
  ProjectRepository,
  WorkItem,
  WorkItemRepository,
  WorkflowDefinition,
  WorkflowDefinitionRepository,
  WorkflowRun,
  WorkflowRunRepository,
  WorkflowTask,
  WorkflowTaskRepository,
  WorkflowVersion,
  WorkflowVersionRepository,
} from '@devos/domain';
import { createLocalFilesystemStorage } from '@devos/storage';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp, type CreateAppOptions, type DevosApi } from '../src/app.js';

const TEST_ENV = { NODE_ENV: 'test', DATABASE_URL: 'postgresql://localhost/devos-test' };

function createFakeDatabaseClient(healthy: boolean): DatabaseClient {
  return {
    db: null as unknown as DatabaseClient['db'],
    checkHealth: async () => healthy,
    close: async () => {},
  };
}

function createInMemoryProjectDeps(): ProjectUseCaseDeps {
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

  return { projects: projectRepository, memberships: membershipRepository };
}

function createInMemoryWorkItemDeps(projectDeps: ProjectUseCaseDeps): WorkItemUseCaseDeps {
  const workItems = new Map<string, WorkItem>();

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
      workItems.set(id, { ...existing, ...changes, updatedAt });
    },
  };

  return {
    projects: projectDeps.projects,
    memberships: projectDeps.memberships,
    workItems: workItemRepository,
  };
}

function createInMemoryWorkflowDeps(
  projectDeps: ProjectUseCaseDeps,
  workItemDeps: WorkItemUseCaseDeps,
): WorkflowUseCaseDeps {
  const definitions = new Map<string, WorkflowDefinition>();
  const versions = new Map<string, WorkflowVersion>();
  const runs = new Map<string, WorkflowRun>();
  const tasks = new Map<string, WorkflowTask>();

  const workflowDefinitions: WorkflowDefinitionRepository = {
    getById: async (id) => definitions.get(id) ?? null,
    getByProjectAndKey: async (projectId, key) =>
      [...definitions.values()].find((d) => d.projectId === projectId && d.key === key) ?? null,
    listForProject: async (projectId) =>
      [...definitions.values()].filter((d) => d.projectId === projectId),
    create: async (definition) => {
      definitions.set(definition.id, definition);
    },
  };

  const workflowVersions: WorkflowVersionRepository = {
    getById: async (id) => versions.get(id) ?? null,
    getByDefinitionAndVersion: async (workflowDefinitionId, version) =>
      [...versions.values()].find(
        (v) => v.workflowDefinitionId === workflowDefinitionId && v.version === version,
      ) ?? null,
    getLatestForDefinition: async (workflowDefinitionId) =>
      [...versions.values()]
        .filter((v) => v.workflowDefinitionId === workflowDefinitionId)
        .sort((a, b) => b.version - a.version)[0] ?? null,
    listForDefinition: async (workflowDefinitionId) =>
      [...versions.values()].filter((v) => v.workflowDefinitionId === workflowDefinitionId),
    create: async (version) => {
      versions.set(version.id, version);
    },
    updateDefinition: async (id, definition) => {
      const existing = versions.get(id);
      if (!existing) return;
      versions.set(id, { ...existing, definition });
    },
    publish: async (id, publishedAt) => {
      const existing = versions.get(id);
      if (!existing) return;
      versions.set(id, { ...existing, status: 'PUBLISHED', publishedAt });
    },
  };

  const workflowRuns: WorkflowRunRepository = {
    getById: async (id) => runs.get(id) ?? null,
    getByVersionAndIdempotencyKey: async (workflowVersionId, idempotencyKey) =>
      [...runs.values()].find(
        (r) => r.workflowVersionId === workflowVersionId && r.idempotencyKey === idempotencyKey,
      ) ?? null,
    create: async (run) => {
      runs.set(run.id, run);
    },
  };

  const workflowTasks: WorkflowTaskRepository = {
    getById: async (id) => tasks.get(id) ?? null,
    listForRun: async (workflowRunId) =>
      [...tasks.values()].filter((t) => t.workflowRunId === workflowRunId),
    create: async (task) => {
      tasks.set(task.id, task);
    },
  };

  return {
    projects: projectDeps.projects,
    memberships: projectDeps.memberships,
    workItems: workItemDeps.workItems,
    workflowDefinitions,
    workflowVersions,
    workflowRuns,
    workflowTasks,
    createDraft: async (definition, version) => {
      await workflowDefinitions.create(definition);
      await workflowVersions.create(version);
    },
    startRun: async (run, runTasks) => {
      await workflowRuns.create(run);
      for (const task of runTasks) await workflowTasks.create(task);
    },
  };
}

function createInMemoryArtifactDeps(
  projectDeps: ProjectUseCaseDeps,
  storageDir: string,
): ArtifactUseCaseDeps {
  const artifactsStore = new Map<string, Artifact>();
  const versionsStore = new Map<string, ArtifactVersion>();

  const artifacts: ArtifactRepository = {
    getById: async (id) => artifactsStore.get(id) ?? null,
    listForProject: async (projectId) =>
      [...artifactsStore.values()].filter((a) => a.projectId === projectId),
    create: async (artifact) => {
      artifactsStore.set(artifact.id, artifact);
    },
  };

  const artifactVersions: ArtifactVersionRepository = {
    getById: async (id) => versionsStore.get(id) ?? null,
    listForArtifact: async (artifactId) =>
      [...versionsStore.values()].filter((v) => v.artifactId === artifactId),
    create: async (version) => {
      versionsStore.set(version.id, version);
    },
  };

  return {
    projects: projectDeps.projects,
    memberships: projectDeps.memberships,
    artifacts,
    artifactVersions,
    storage: createLocalFilesystemStorage(storageDir),
    publishArtifact: async (artifact, version) => {
      await artifacts.create(artifact);
      await artifactVersions.create(version);
    },
  };
}

function createInMemoryAgentDeps(projectDeps: ProjectUseCaseDeps): AgentUseCaseDeps {
  const agentsStore = new Map<string, Agent>();
  const versionsStore = new Map<string, AgentVersion>();

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

  return {
    projects: projectDeps.projects,
    memberships: projectDeps.memberships,
    agents,
    agentVersions,
    createDraft: async (agent, version) => {
      await agents.create(agent);
      await agentVersions.create(version);
    },
  };
}

function createInMemoryAgentExecutionSummaryDeps(
  projectDeps: ProjectUseCaseDeps,
  workflowDeps: WorkflowUseCaseDeps,
): AgentExecutionSummaryUseCaseDeps {
  const versionsStore = new Map<string, AgentVersion>();
  const executionsStore = new Map<string, AgentExecution>();
  const manifestsStore = new Map<string, ContextManifest>();

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

  const agentExecutions: AgentExecutionRepository = {
    getById: async (id) => executionsStore.get(id) ?? null,
    listForTask: async (taskId) =>
      [...executionsStore.values()].filter((e) => e.workflowTaskId === taskId),
    create: async (execution) => {
      executionsStore.set(execution.id, execution);
    },
    complete: async (id, output, uncertainty, completedAt) => {
      const existing = executionsStore.get(id);
      if (!existing) return;
      executionsStore.set(id, {
        ...existing,
        status: 'SUCCEEDED',
        output,
        ...(uncertainty !== undefined ? { uncertainty } : {}),
        completedAt,
      });
    },
    fail: async (id, errorCode, errorMessage, completedAt) => {
      const existing = executionsStore.get(id);
      if (!existing) return;
      executionsStore.set(id, {
        ...existing,
        status: 'FAILED',
        ...(errorCode !== undefined ? { errorCode } : {}),
        errorMessage,
        completedAt,
      });
    },
  };

  const contextManifests: ContextManifestRepository = {
    getById: async (id) => manifestsStore.get(id) ?? null,
    getForExecution: async (executionId) =>
      [...manifestsStore.values()].find((m) => m.agentExecutionId === executionId) ?? null,
    create: async (manifest) => {
      manifestsStore.set(manifest.id, manifest);
    },
  };

  return {
    projects: projectDeps.projects,
    memberships: projectDeps.memberships,
    workflowRuns: workflowDeps.workflowRuns,
    workflowTasks: workflowDeps.workflowTasks,
    agentExecutions,
    agentVersions,
    contextManifests,
  };
}

async function startServer(
  options: Partial<CreateAppOptions> = {},
): Promise<{ server: Server; baseUrl: string; app: DevosApi }> {
  const app = createApp({
    env: TEST_ENV,
    database: createFakeDatabaseClient(true),
    ...options,
  });
  const server = createServer((req, res) => {
    void app.handleRequest(req, res);
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('Expected server to bind to a TCP port.');
  }

  return { server, baseUrl: `http://127.0.0.1:${address.port}`, app };
}

describe('api application', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const started = await startServer();
    server = started.server;
    baseUrl = started.baseUrl;
  });

  afterAll(() => {
    server.close();
  });

  it('reports health under /api/v1, including database status', async () => {
    const response = await fetch(`${baseUrl}/api/v1/health`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({ status: 'ok', checks: { database: 'ok' } });
    expect(body.meta.requestId).toEqual(expect.any(String));
  });

  it('echoes a supplied correlation id as the request id', async () => {
    const response = await fetch(`${baseUrl}/api/v1/health`, {
      headers: { 'x-correlation-id': 'test-correlation-id' },
    });
    const body = await response.json();

    expect(response.headers.get('x-correlation-id')).toBe('test-correlation-id');
    expect(body.meta.requestId).toBe('test-correlation-id');
  });

  it('returns the standard error envelope for an unknown route', async () => {
    const response = await fetch(`${baseUrl}/api/v1/does-not-exist`);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe('DEVOS_NOT_FOUND');
    expect(body.meta.requestId).toEqual(expect.any(String));
  });

  it('returns the standard error envelope for a malformed JSON body', async () => {
    const response = await fetch(`${baseUrl}/api/v1/health`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{not valid json',
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe('DEVOS_BAD_REQUEST');
  });

  it('reflects the request origin so a browser can read cross-origin responses', async () => {
    const response = await fetch(`${baseUrl}/api/v1/health`, {
      headers: { origin: 'http://localhost:5173' },
    });

    expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
  });

  it('answers an OPTIONS preflight request', async () => {
    const response = await fetch(`${baseUrl}/api/v1/health`, {
      method: 'OPTIONS',
      headers: { origin: 'http://localhost:5173' },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
    expect(response.headers.get('access-control-allow-methods')).toContain('GET');
  });

  it('rejects /api/v1/me without an authorization header', async () => {
    const response = await fetch(`${baseUrl}/api/v1/me`);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe('DEVOS_UNAUTHENTICATED');
  });

  it('identifies the current user on /api/v1/me when authenticated', async () => {
    const response = await fetch(`${baseUrl}/api/v1/me`, {
      headers: { authorization: 'Bearer alice' },
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({ id: 'alice' });
  });
});

describe('api application with an unreachable database', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const started = await startServer({ database: createFakeDatabaseClient(false) });
    server = started.server;
    baseUrl = started.baseUrl;
  });

  afterAll(() => {
    server.close();
  });

  it('reports degraded health when the database check fails', async () => {
    const response = await fetch(`${baseUrl}/api/v1/health`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({ status: 'degraded', checks: { database: 'error' } });
  });
});

describe('app shutdown', () => {
  it('closes the database client', async () => {
    let closed = false;
    const database = createFakeDatabaseClient(true);
    database.close = async () => {
      closed = true;
    };

    const app = createApp({ env: TEST_ENV, database });
    await app.close();

    expect(closed).toBe(true);
  });
});

describe('project and membership routes', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const started = await startServer({ projectDeps: createInMemoryProjectDeps() });
    server = started.server;
    baseUrl = started.baseUrl;
  });

  afterAll(() => {
    server.close();
  });

  async function authed(path: string, principal: string, init: RequestInit = {}) {
    return fetch(`${baseUrl}${path}`, {
      ...init,
      headers: { ...init.headers, authorization: `Bearer ${principal}` },
    });
  }

  it('rejects unauthenticated project listing', async () => {
    const response = await fetch(`${baseUrl}/api/v1/projects`);
    expect(response.status).toBe(401);
  });

  it('creates a project, making the creator an OWNER', async () => {
    const response = await authed('/api/v1/projects', 'alice', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Test Project', slug: 'test-project' }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({ name: 'Test Project', slug: 'test-project' });

    const listResponse = await authed('/api/v1/projects', 'alice');
    const listBody = await listResponse.json();
    expect(listBody.data).toHaveLength(1);
  });

  it('rejects project creation with a missing name', async () => {
    const response = await authed('/api/v1/projects', 'alice', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug: 'no-name' }),
    });
    expect(response.status).toBe(400);
  });

  it('returns 404 for a project a principal is not a member of', async () => {
    const createResponse = await authed('/api/v1/projects', 'bob', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Bob Project', slug: 'bob-project-2' }),
    });
    const created = await createResponse.json();

    const response = await authed(`/api/v1/projects/${created.data.id}`, 'mallory');
    expect(response.status).toBe(404);
  });

  it('allows OWNER to add a member and denies MEMBER from doing so', async () => {
    const createResponse = await authed('/api/v1/projects', 'carol', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Carol Project', slug: 'carol-project' }),
    });
    const project = (await createResponse.json()).data;

    const addResponse = await authed(`/api/v1/projects/${project.id}/members`, 'carol', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId: 'dave', role: 'MEMBER' }),
    });
    expect(addResponse.status).toBe(200);

    const deniedResponse = await authed(`/api/v1/projects/${project.id}/members`, 'dave', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId: 'erin', role: 'MEMBER' }),
    });
    expect(deniedResponse.status).toBe(403);
  });

  it('prevents removing the last owner via the API', async () => {
    const createResponse = await authed('/api/v1/projects', 'frank', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Frank Project', slug: 'frank-project' }),
    });
    const project = (await createResponse.json()).data;

    const response = await authed(`/api/v1/projects/${project.id}/members/frank`, 'frank', {
      method: 'DELETE',
    });
    expect(response.status).toBe(400);
  });
});

describe('work item routes', () => {
  let server: Server;
  let baseUrl: string;
  let projectId: string;

  beforeAll(async () => {
    const projectDeps = createInMemoryProjectDeps();
    const workItemDeps = createInMemoryWorkItemDeps(projectDeps);
    const started = await startServer({ projectDeps, workItemDeps });
    server = started.server;
    baseUrl = started.baseUrl;

    const createResponse = await fetch(`${baseUrl}/api/v1/projects`, {
      method: 'POST',
      headers: { authorization: 'Bearer alice', 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Work Item Project', slug: 'work-item-project' }),
    });
    projectId = (await createResponse.json()).data.id;
  });

  afterAll(() => {
    server.close();
  });

  async function authed(path: string, principal: string, init: RequestInit = {}) {
    return fetch(`${baseUrl}${path}`, {
      ...init,
      headers: { ...init.headers, authorization: `Bearer ${principal}` },
    });
  }

  it('creates a work item with defaulted type/priority/status', async () => {
    const response = await authed(`/api/v1/projects/${projectId}/work-items`, 'alice', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Fix the thing' }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({
      title: 'Fix the thing',
      type: 'GENERAL',
      priority: 'MEDIUM',
      status: 'OPEN',
      metadata: {},
    });
  });

  it('rejects work item creation with a missing title', async () => {
    const response = await authed(`/api/v1/projects/${projectId}/work-items`, 'alice', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(response.status).toBe(400);
  });

  it('lists work items for a project and rejects a non-member', async () => {
    await authed(`/api/v1/projects/${projectId}/work-items`, 'alice', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Another item' }),
    });

    const listResponse = await authed(`/api/v1/projects/${projectId}/work-items`, 'alice');
    const listBody = await listResponse.json();
    expect(listBody.data.length).toBeGreaterThanOrEqual(1);

    const deniedResponse = await authed(`/api/v1/projects/${projectId}/work-items`, 'mallory');
    expect(deniedResponse.status).toBe(404);
  });

  it('gets and updates a single work item', async () => {
    const createResponse = await authed(`/api/v1/projects/${projectId}/work-items`, 'alice', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Update me', metadata: { source: 'test' } }),
    });
    const created = (await createResponse.json()).data;

    const getResponse = await authed(`/api/v1/work-items/${created.id}`, 'alice');
    expect((await getResponse.json()).data.title).toBe('Update me');

    const updateResponse = await authed(`/api/v1/work-items/${created.id}`, 'alice', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'IN_PROGRESS' }),
    });
    const updated = await updateResponse.json();

    expect(updateResponse.status).toBe(200);
    expect(updated.data.status).toBe('IN_PROGRESS');
    expect(updated.data.metadata).toEqual({ source: 'test' });
  });

  it('returns 404 for a non-existent work item', async () => {
    const response = await authed(
      '/api/v1/work-items/00000000-0000-4000-8000-000000009999',
      'alice',
    );
    expect(response.status).toBe(404);
  });
});

describe('workflow routes', () => {
  let server: Server;
  let baseUrl: string;
  let projectId: string;

  const validGraph = {
    name: 'Intake to Artifact',
    nodes: [{ id: 'discovery', type: 'TASK' }],
    edges: [],
  };

  beforeAll(async () => {
    const projectDeps = createInMemoryProjectDeps();
    const workItemDeps = createInMemoryWorkItemDeps(projectDeps);
    const workflowDeps = createInMemoryWorkflowDeps(projectDeps, workItemDeps);
    const started = await startServer({ projectDeps, workItemDeps, workflowDeps });
    server = started.server;
    baseUrl = started.baseUrl;

    const createResponse = await fetch(`${baseUrl}/api/v1/projects`, {
      method: 'POST',
      headers: { authorization: 'Bearer alice', 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Workflow Project', slug: 'workflow-project' }),
    });
    projectId = (await createResponse.json()).data.id;
  });

  afterAll(() => {
    server.close();
  });

  async function authed(path: string, principal: string, init: RequestInit = {}) {
    return fetch(`${baseUrl}${path}`, {
      ...init,
      headers: { ...init.headers, authorization: `Bearer ${principal}` },
    });
  }

  it('creates a draft workflow at version 1', async () => {
    const response = await authed(`/api/v1/projects/${projectId}/workflows`, 'alice', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key: 'intake', name: 'Intake', definition: validGraph }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.key).toBe('intake');
    expect(body.data.version).toMatchObject({ version: 1, status: 'DRAFT' });
  });

  it('rejects an invalid workflow graph on create', async () => {
    const response = await authed(`/api/v1/projects/${projectId}/workflows`, 'alice', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key: 'bad', name: 'Bad', definition: { name: 'x', nodes: [] } }),
    });
    expect(response.status).toBe(400);
  });

  it('updates, validates, and publishes a draft, then rejects further edits', async () => {
    const createResponse = await authed(`/api/v1/projects/${projectId}/workflows`, 'alice', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key: 'lifecycle', name: 'Lifecycle', definition: validGraph }),
    });
    const workflowId = (await createResponse.json()).data.id;

    const updateResponse = await authed(`/api/v1/workflows/${workflowId}`, 'alice', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...validGraph, description: 'updated' }),
    });
    expect(updateResponse.status).toBe(200);

    const validateResponse = await authed(`/api/v1/workflows/${workflowId}/validate`, 'alice', {
      method: 'POST',
    });
    const validateBody = await validateResponse.json();
    expect(validateBody.data.valid).toBe(true);

    const publishResponse = await authed(`/api/v1/workflows/${workflowId}/publish`, 'alice', {
      method: 'POST',
    });
    const publishBody = await publishResponse.json();
    expect(publishBody.data.status).toBe('PUBLISHED');

    const versionResponse = await authed(`/api/v1/workflows/${workflowId}/versions/1`, 'alice');
    expect((await versionResponse.json()).data.status).toBe('PUBLISHED');

    const rejectedUpdate = await authed(`/api/v1/workflows/${workflowId}`, 'alice', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validGraph),
    });
    expect(rejectedUpdate.status).toBe(400);
  });

  it('denies a non-member from reading a workflow', async () => {
    const createResponse = await authed(`/api/v1/projects/${projectId}/workflows`, 'alice', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key: 'secret', name: 'Secret', definition: validGraph }),
    });
    const workflowId = (await createResponse.json()).data.id;

    const response = await authed(`/api/v1/workflows/${workflowId}`, 'mallory');
    expect(response.status).toBe(404);
  });
});

describe('agent routes', () => {
  let server: Server;
  let baseUrl: string;
  let projectId: string;

  const validConfiguration = {
    role: 'REQUIREMENTS',
    provider: 'gemini',
    modelRef: 'gemini-2.0-flash',
    allowedCapabilities: ['knowledge.read', 'artifact.write'],
  };

  beforeAll(async () => {
    const projectDeps = createInMemoryProjectDeps();
    const agentDeps = createInMemoryAgentDeps(projectDeps);
    const started = await startServer({ projectDeps, agentDeps });
    server = started.server;
    baseUrl = started.baseUrl;

    const createResponse = await fetch(`${baseUrl}/api/v1/projects`, {
      method: 'POST',
      headers: { authorization: 'Bearer alice', 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Agent Project', slug: 'agent-project' }),
    });
    projectId = (await createResponse.json()).data.id;
  });

  afterAll(() => {
    server.close();
  });

  async function authed(path: string, principal: string, init: RequestInit = {}) {
    return fetch(`${baseUrl}${path}`, {
      ...init,
      headers: { ...init.headers, authorization: `Bearer ${principal}` },
    });
  }

  it('rejects unauthenticated requests with 401', async () => {
    const response = await fetch(`${baseUrl}/api/v1/projects/${projectId}/agents`);
    expect(response.status).toBe(401);
  });

  it('creates a draft agent at version 1', async () => {
    const response = await authed(`/api/v1/projects/${projectId}/agents`, 'alice', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        key: 'requirements-agent',
        name: 'Requirements Agent',
        configuration: validConfiguration,
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.key).toBe('requirements-agent');
    expect(body.data.status).toBe('ACTIVE');
    expect(body.data.version).toMatchObject({ version: 1, status: 'DRAFT' });
  });

  it('rejects a configuration missing a required field', async () => {
    const response = await authed(`/api/v1/projects/${projectId}/agents`, 'alice', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        key: 'bad',
        name: 'Bad',
        configuration: { provider: 'gemini', modelRef: 'x' },
      }),
    });
    expect(response.status).toBe(400);
  });

  it('publishes a draft, then rejects publishing again', async () => {
    const createResponse = await authed(`/api/v1/projects/${projectId}/agents`, 'alice', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        key: 'lifecycle-agent',
        name: 'Lifecycle Agent',
        configuration: validConfiguration,
      }),
    });
    const agentId = (await createResponse.json()).data.id;

    const publishResponse = await authed(`/api/v1/agents/${agentId}/publish`, 'alice', {
      method: 'POST',
    });
    const publishBody = await publishResponse.json();
    expect(publishBody.data.status).toBe('PUBLISHED');

    const secondPublish = await authed(`/api/v1/agents/${agentId}/publish`, 'alice', {
      method: 'POST',
    });
    expect(secondPublish.status).toBe(400);
  });

  it('lists agents for a project', async () => {
    await authed(`/api/v1/projects/${projectId}/agents`, 'alice', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        key: 'listed-agent',
        name: 'Listed Agent',
        configuration: validConfiguration,
      }),
    });

    const response = await authed(`/api/v1/projects/${projectId}/agents`, 'alice');
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.some((agent: { key: string }) => agent.key === 'listed-agent')).toBe(true);
  });

  it('denies a non-member from reading an agent', async () => {
    const createResponse = await authed(`/api/v1/projects/${projectId}/agents`, 'alice', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        key: 'secret-agent',
        name: 'Secret Agent',
        configuration: validConfiguration,
      }),
    });
    const agentId = (await createResponse.json()).data.id;

    const response = await authed(`/api/v1/agents/${agentId}`, 'mallory');
    expect(response.status).toBe(404);
  });
});

describe('workflow run routes', () => {
  let server: Server;
  let baseUrl: string;
  let projectId: string;
  let workflowId: string;
  let workItemId: string;

  const validGraph = {
    name: 'Intake to Artifact',
    nodes: [{ id: 'discovery', type: 'TASK' }],
    edges: [],
  };

  beforeAll(async () => {
    const projectDeps = createInMemoryProjectDeps();
    const workItemDeps = createInMemoryWorkItemDeps(projectDeps);
    const workflowDeps = createInMemoryWorkflowDeps(projectDeps, workItemDeps);
    const started = await startServer({ projectDeps, workItemDeps, workflowDeps });
    server = started.server;
    baseUrl = started.baseUrl;

    async function authedSetup(path: string, init: RequestInit = {}) {
      return fetch(`${baseUrl}${path}`, {
        ...init,
        headers: { ...init.headers, authorization: 'Bearer alice' },
      });
    }

    const projectResponse = await authedSetup('/api/v1/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Run Project', slug: 'run-project' }),
    });
    projectId = (await projectResponse.json()).data.id;

    const workflowResponse = await authedSetup(`/api/v1/projects/${projectId}/workflows`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key: 'intake', name: 'Intake', definition: validGraph }),
    });
    workflowId = (await workflowResponse.json()).data.id;
    await authedSetup(`/api/v1/workflows/${workflowId}/publish`, { method: 'POST' });

    const workItemResponse = await authedSetup(`/api/v1/projects/${projectId}/work-items`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Run me' }),
    });
    workItemId = (await workItemResponse.json()).data.id;
  });

  afterAll(() => {
    server.close();
  });

  async function authed(path: string, principal: string, init: RequestInit = {}) {
    return fetch(`${baseUrl}${path}`, {
      ...init,
      headers: { ...init.headers, authorization: `Bearer ${principal}` },
    });
  }

  it('starts a run from the active version and creates its tasks', async () => {
    const response = await authed(`/api/v1/workflows/${workflowId}/runs`, 'alice', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workItemId, inputs: {}, idempotencyKey: 'run-1' }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.status).toBe('PENDING');

    const tasksResponse = await authed(`/api/v1/runs/${body.data.id}/tasks`, 'alice');
    const tasksBody = await tasksResponse.json();
    expect(tasksBody.data).toHaveLength(1);
    expect(tasksBody.data[0]).toMatchObject({
      nodeId: 'discovery',
      type: 'TASK',
      status: 'PENDING',
    });

    const getResponse = await authed(`/api/v1/runs/${body.data.id}`, 'alice');
    expect((await getResponse.json()).data.id).toBe(body.data.id);
  });

  it('rejects a work item from a different project', async () => {
    const otherProjectResponse = await authed('/api/v1/projects', 'alice', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Other Project', slug: 'other-project' }),
    });
    const otherProjectId = (await otherProjectResponse.json()).data.id;

    const otherWorkItemResponse = await authed(
      `/api/v1/projects/${otherProjectId}/work-items`,
      'alice',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Wrong project' }),
      },
    );
    const otherWorkItemId = (await otherWorkItemResponse.json()).data.id;

    const response = await authed(`/api/v1/workflows/${workflowId}/runs`, 'alice', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        workItemId: otherWorkItemId,
        inputs: {},
        idempotencyKey: 'run-cross-project',
      }),
    });
    expect(response.status).toBe(400);
  });

  it('denies a non-member from starting a run', async () => {
    const response = await authed(`/api/v1/workflows/${workflowId}/runs`, 'mallory', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workItemId, inputs: {}, idempotencyKey: 'run-mallory' }),
    });
    expect(response.status).toBe(404);
  });
});

describe('agent execution summary routes', () => {
  let server: Server;
  let baseUrl: string;
  let projectId: string;
  let workflowId: string;
  let workItemId: string;
  let agentExecutionSummaryDeps: AgentExecutionSummaryUseCaseDeps;

  const validGraph = {
    name: 'Planning Path',
    nodes: [{ id: 'discovery', type: 'AGENT_TASK', agentRef: 'discovery-agent' }],
    edges: [],
  };

  beforeAll(async () => {
    const projectDeps = createInMemoryProjectDeps();
    const workItemDeps = createInMemoryWorkItemDeps(projectDeps);
    const workflowDeps = createInMemoryWorkflowDeps(projectDeps, workItemDeps);
    agentExecutionSummaryDeps = createInMemoryAgentExecutionSummaryDeps(projectDeps, workflowDeps);
    const started = await startServer({
      projectDeps,
      workItemDeps,
      workflowDeps,
      agentExecutionSummaryDeps,
    });
    server = started.server;
    baseUrl = started.baseUrl;

    async function authedSetup(path: string, init: RequestInit = {}) {
      return fetch(`${baseUrl}${path}`, {
        ...init,
        headers: { ...init.headers, authorization: 'Bearer alice' },
      });
    }

    const projectResponse = await authedSetup('/api/v1/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Agent Exec Project', slug: 'agent-exec-project' }),
    });
    projectId = (await projectResponse.json()).data.id;

    const workflowResponse = await authedSetup(`/api/v1/projects/${projectId}/workflows`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key: 'planning-path', name: 'Planning Path', definition: validGraph }),
    });
    workflowId = (await workflowResponse.json()).data.id;
    await authedSetup(`/api/v1/workflows/${workflowId}/publish`, { method: 'POST' });

    const workItemResponse = await authedSetup(`/api/v1/projects/${projectId}/work-items`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Plan me' }),
    });
    workItemId = (await workItemResponse.json()).data.id;
  });

  afterAll(() => {
    server.close();
  });

  async function authed(path: string, principal: string, init: RequestInit = {}) {
    return fetch(`${baseUrl}${path}`, {
      ...init,
      headers: { ...init.headers, authorization: `Bearer ${principal}` },
    });
  }

  it("shows a task's prompt version, context manifest summary, status, and output", async () => {
    const runResponse = await authed(`/api/v1/workflows/${workflowId}/runs`, 'alice', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workItemId, inputs: {}, idempotencyKey: 'summary-run-1' }),
    });
    const runId = (await runResponse.json()).data.id;

    const tasksResponse = await authed(`/api/v1/runs/${runId}/tasks`, 'alice');
    const taskId = (await tasksResponse.json()).data[0].id;

    const now = new Date(0).toISOString();
    const agentVersion: AgentVersion = {
      id: 'version-1',
      agentId: 'agent-1',
      version: 1,
      status: 'PUBLISHED',
      configuration: {
        role: 'DISCOVERY',
        provider: 'gemini',
        modelRef: 'gemini-3.6-flash',
        allowedCapabilities: [],
      },
      promptReference: 'discovery/v1',
      createdBy: 'alice',
      createdAt: now,
    };
    await agentExecutionSummaryDeps.agentVersions.create(agentVersion);

    const execution: AgentExecution = {
      id: 'execution-1',
      workflowTaskId: taskId,
      agentVersionId: agentVersion.id,
      status: 'SUCCEEDED',
      input: {},
      output: { summary: 'a discovery summary' },
      createdAt: now,
    };
    await agentExecutionSummaryDeps.agentExecutions.create(execution);

    const manifest: ContextManifest = {
      id: 'manifest-1',
      projectId,
      workflowTaskId: taskId,
      agentExecutionId: execution.id,
      version: 1,
      sources: [{ type: 'WORK_ITEM', ref: `work-item:${workItemId}` }],
      policySnapshot: { policyVersion: 'none' },
      createdAt: now,
    };
    await agentExecutionSummaryDeps.contextManifests.create(manifest);

    const summaryResponse = await authed(
      `/api/v1/runs/${runId}/agent-execution-summaries`,
      'alice',
    );
    const summaryBody = await summaryResponse.json();

    expect(summaryResponse.status).toBe(200);
    expect(summaryBody.data).toHaveLength(1);
    expect(summaryBody.data[0]).toMatchObject({
      taskId,
      executionId: execution.id,
      status: 'SUCCEEDED',
      role: 'DISCOVERY',
      promptReference: 'discovery/v1',
      output: { summary: 'a discovery summary' },
      contextManifest: {
        sourceCount: 1,
        sources: [{ type: 'WORK_ITEM', ref: `work-item:${workItemId}` }],
      },
    });
  });

  it('denies a non-member from reading agent execution summaries', async () => {
    const runResponse = await authed(`/api/v1/workflows/${workflowId}/runs`, 'alice', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workItemId, inputs: {}, idempotencyKey: 'summary-run-2' }),
    });
    const runId = (await runResponse.json()).data.id;

    const response = await authed(`/api/v1/runs/${runId}/agent-execution-summaries`, 'mallory');
    expect(response.status).toBe(404);
  });
});

describe('artifact routes', () => {
  let server: Server;
  let baseUrl: string;
  let projectId: string;
  let storageDir: string;

  beforeAll(async () => {
    storageDir = await mkdtemp(path.join(tmpdir(), 'devos-api-artifacts-'));
    const projectDeps = createInMemoryProjectDeps();
    const artifactDeps = createInMemoryArtifactDeps(projectDeps, storageDir);
    const started = await startServer({ projectDeps, artifactDeps });
    server = started.server;
    baseUrl = started.baseUrl;

    const projectResponse = await fetch(`${baseUrl}/api/v1/projects`, {
      method: 'POST',
      headers: { authorization: 'Bearer alice', 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Artifact Project', slug: 'artifact-project' }),
    });
    projectId = (await projectResponse.json()).data.id;
  });

  afterAll(async () => {
    server.close();
    await rm(storageDir, { recursive: true, force: true });
  });

  async function authed(path: string, principal: string, init: RequestInit = {}) {
    return fetch(`${baseUrl}${path}`, {
      ...init,
      headers: { ...init.headers, authorization: `Bearer ${principal}` },
    });
  }

  it('creates an artifact and stores content addressed by its hash', async () => {
    const response = await authed(`/api/v1/projects/${projectId}/artifacts`, 'alice', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        artifactType: 'DISCOVERY_REPORT',
        name: 'Test Report',
        content: JSON.stringify({ hello: 'world' }),
        contentType: 'application/json',
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({
      type: 'DISCOVERY_REPORT',
      name: 'Test Report',
      status: 'GENERATED',
    });
  });

  it('lists artifacts, gets one, lists its versions, and gets a version by number', async () => {
    const createResponse = await authed(`/api/v1/projects/${projectId}/artifacts`, 'alice', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        artifactType: 'DISCOVERY_REPORT',
        name: 'Listable Report',
        content: 'plain text content',
      }),
    });
    const artifactId = (await createResponse.json()).data.id;

    const listResponse = await authed(`/api/v1/projects/${projectId}/artifacts`, 'alice');
    const listBody = await listResponse.json();
    expect(listBody.data.some((a: { id: string }) => a.id === artifactId)).toBe(true);

    const getResponse = await authed(`/api/v1/artifacts/${artifactId}`, 'alice');
    expect((await getResponse.json()).data.id).toBe(artifactId);

    const versionsResponse = await authed(`/api/v1/artifacts/${artifactId}/versions`, 'alice');
    const versionsBody = await versionsResponse.json();
    expect(versionsBody.data).toHaveLength(1);
    expect(versionsBody.data[0].contentHash).toHaveLength(64);

    const versionResponse = await authed(`/api/v1/artifacts/${artifactId}/versions/1`, 'alice');
    expect((await versionResponse.json()).data.version).toBe(1);

    const provenanceResponse = await authed(`/api/v1/artifacts/${artifactId}/provenance`, 'alice');
    expect(provenanceResponse.status).toBe(200);
  });

  it('denies a non-member from reading an artifact', async () => {
    const createResponse = await authed(`/api/v1/projects/${projectId}/artifacts`, 'alice', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ artifactType: 'DISCOVERY_REPORT', name: 'Secret', content: 'x' }),
    });
    const artifactId = (await createResponse.json()).data.id;

    const response = await authed(`/api/v1/artifacts/${artifactId}`, 'mallory');
    expect(response.status).toBe(404);
  });
});
