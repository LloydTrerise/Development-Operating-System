import { randomUUID } from 'node:crypto';
import type {
  Membership,
  MembershipRepository,
  OrganisationId,
  Project,
  ProjectRepository,
  WorkflowDefinition,
  WorkflowDefinitionRepository,
  WorkflowRun,
  WorkflowRunRepository,
  WorkflowTask,
  WorkflowTaskRepository,
  WorkflowVersion,
  WorkflowVersionRepository,
  WorkItem,
  WorkItemRepository,
} from '@devos/domain';
import { beforeEach, describe, expect, it } from 'vitest';
import { createProject } from '../src/projects/create-project.js';
import { createWorkflowDefinition } from '../src/workflows/create-workflow-definition.js';
import type { WorkflowUseCaseDeps } from '../src/workflows/deps.js';
import { publishWorkflowVersion } from '../src/workflows/publish-workflow-version.js';
import { startWorkflowRunFromActiveVersion } from '../src/workflows/start-run-from-active-version.js';
import { updateDraftWorkflow } from '../src/workflows/update-draft-workflow.js';
import { validateDraftWorkflow } from '../src/workflows/validate-draft-workflow.js';
import { ForbiddenError, ValidationError } from '../src/errors.js';

function createInMemoryDeps(): WorkflowUseCaseDeps {
  const projects = new Map<string, Project>();
  const memberships = new Map<string, Membership>();
  const definitions = new Map<string, WorkflowDefinition>();
  const versions = new Map<string, WorkflowVersion>();

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

  const workItemsStore = new Map<string, WorkItem>();
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
  };

  const runsStore = new Map<string, WorkflowRun>();
  const workflowRuns: WorkflowRunRepository = {
    getById: async (id) => runsStore.get(id) ?? null,
    getByVersionAndIdempotencyKey: async (workflowVersionId, idempotencyKey) =>
      [...runsStore.values()].find(
        (r) => r.workflowVersionId === workflowVersionId && r.idempotencyKey === idempotencyKey,
      ) ?? null,
    create: async (run) => {
      runsStore.set(run.id, run);
    },
  };

  const tasksStore = new Map<string, WorkflowTask>();
  const workflowTasks: WorkflowTaskRepository = {
    getById: async (id) => tasksStore.get(id) ?? null,
    listForRun: async (workflowRunId) =>
      [...tasksStore.values()].filter((t) => t.workflowRunId === workflowRunId),
    create: async (task) => {
      tasksStore.set(task.id, task);
    },
  };

  return {
    projects: projectRepository,
    memberships: membershipRepository,
    workItems,
    workflowDefinitions,
    workflowVersions,
    workflowRuns,
    workflowTasks,
    createDraft: async (definition, version) => {
      await workflowDefinitions.create(definition);
      await workflowVersions.create(version);
    },
    startRun: async (run, tasks) => {
      await workflowRuns.create(run);
      for (const task of tasks) await workflowTasks.create(task);
    },
  };
}

const VALID_GRAPH = {
  name: 'Intake to Artifact',
  nodes: [{ id: 'discovery', type: 'TASK' }],
  edges: [],
};

describe('workflow use cases', () => {
  let deps: WorkflowUseCaseDeps;
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

  it('creates a draft workflow definition at version 1', async () => {
    const { definition, version } = await createWorkflowDefinition(deps, 'alice', projectId, {
      key: 'intake-to-artifact',
      name: 'Intake to Artifact',
      definition: VALID_GRAPH,
    });

    expect(definition.key).toBe('intake-to-artifact');
    expect(version.version).toBe(1);
    expect(version.status).toBe('DRAFT');
  });

  it('rejects a duplicate key within the same project', async () => {
    await createWorkflowDefinition(deps, 'alice', projectId, {
      key: 'dup',
      name: 'First',
      definition: VALID_GRAPH,
    });

    await expect(
      createWorkflowDefinition(deps, 'alice', projectId, {
        key: 'dup',
        name: 'Second',
        definition: VALID_GRAPH,
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('rejects an invalid graph on create', async () => {
    await expect(
      createWorkflowDefinition(deps, 'alice', projectId, {
        key: 'invalid',
        name: 'Invalid',
        definition: { name: 'x', nodes: [] },
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('updates the draft, then publishes it, then rejects further updates', async () => {
    const { definition } = await createWorkflowDefinition(deps, 'alice', projectId, {
      key: 'updatable',
      name: 'Updatable',
      definition: VALID_GRAPH,
    });

    const updatedGraph = { ...VALID_GRAPH, name: 'Renamed' };
    const updated = await updateDraftWorkflow(deps, 'alice', definition.id, updatedGraph);
    expect(updated.definition.name).toBe('Renamed');

    const validation = await validateDraftWorkflow(deps, 'alice', definition.id);
    expect(validation.valid).toBe(true);

    const published = await publishWorkflowVersion(deps, 'alice', definition.id);
    expect(published.status).toBe('PUBLISHED');
    expect(published.publishedAt).toBeDefined();

    await expect(updateDraftWorkflow(deps, 'alice', definition.id, updatedGraph)).rejects.toThrow(
      ValidationError,
    );
  });

  it('rejects publishing a workflow version by a non-owner member (DEVOS-082 RBAC hardening)', async () => {
    const { definition } = await createWorkflowDefinition(deps, 'alice', projectId, {
      key: 'member-cannot-publish',
      name: 'Member Cannot Publish',
      definition: VALID_GRAPH,
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

    await expect(publishWorkflowVersion(deps, 'bob', definition.id)).rejects.toThrow(
      ForbiddenError,
    );
  });

  it('rejects starting a run against a draft (unpublished) version', async () => {
    const { definition } = await createWorkflowDefinition(deps, 'alice', projectId, {
      key: 'no-publish',
      name: 'No Publish',
      definition: VALID_GRAPH,
    });

    const workItem: WorkItem = {
      id: randomUUID() as WorkItem['id'],
      projectId,
      title: 'Test item',
      type: 'GENERAL',
      status: 'OPEN',
      priority: 'MEDIUM',
      metadata: {},
      createdBy: 'alice',
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    };
    await deps.workItems.create(workItem);

    await expect(
      startWorkflowRunFromActiveVersion(deps, 'alice', definition.id, {
        workItemId: workItem.id,
        inputs: {},
        idempotencyKey: 'key-1',
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('starts a run from the active published version and creates one task per node', async () => {
    const { definition } = await createWorkflowDefinition(deps, 'alice', projectId, {
      key: 'runnable',
      name: 'Runnable',
      definition: VALID_GRAPH,
    });
    await publishWorkflowVersion(deps, 'alice', definition.id);

    const workItem: WorkItem = {
      id: randomUUID() as WorkItem['id'],
      projectId,
      title: 'Test item',
      type: 'GENERAL',
      status: 'OPEN',
      priority: 'MEDIUM',
      metadata: {},
      createdBy: 'alice',
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    };
    await deps.workItems.create(workItem);

    const run = await startWorkflowRunFromActiveVersion(deps, 'alice', definition.id, {
      workItemId: workItem.id,
      inputs: { foo: 'bar' },
      idempotencyKey: 'key-2',
    });

    expect(run.status).toBe('PENDING');
    const tasks = await deps.workflowTasks.listForRun(run.id);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({ taskKey: 'discovery', taskType: 'TASK', status: 'PENDING' });
  });

  it("DEVOS-088: folds a supplied correlationId into the run's and every task's own input", async () => {
    const { definition } = await createWorkflowDefinition(deps, 'alice', projectId, {
      key: 'correlated',
      name: 'Correlated',
      definition: VALID_GRAPH,
    });
    await publishWorkflowVersion(deps, 'alice', definition.id);

    const workItem: WorkItem = {
      id: randomUUID() as WorkItem['id'],
      projectId,
      title: 'Test item',
      type: 'GENERAL',
      status: 'OPEN',
      priority: 'MEDIUM',
      metadata: {},
      createdBy: 'alice',
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    };
    await deps.workItems.create(workItem);

    const run = await startWorkflowRunFromActiveVersion(deps, 'alice', definition.id, {
      workItemId: workItem.id,
      inputs: { foo: 'bar' },
      idempotencyKey: 'key-correlated',
      correlationId: 'trace-abcd',
    });

    expect(run.input).toEqual({ foo: 'bar', correlationId: 'trace-abcd' });
    const tasks = await deps.workflowTasks.listForRun(run.id);
    expect(tasks[0]?.input).toMatchObject({ correlationId: 'trace-abcd' });
  });

  it('is idempotent: starting a run twice with the same key returns the same run', async () => {
    const { definition } = await createWorkflowDefinition(deps, 'alice', projectId, {
      key: 'idempotent',
      name: 'Idempotent',
      definition: VALID_GRAPH,
    });
    await publishWorkflowVersion(deps, 'alice', definition.id);

    const workItem: WorkItem = {
      id: randomUUID() as WorkItem['id'],
      projectId,
      title: 'Test item',
      type: 'GENERAL',
      status: 'OPEN',
      priority: 'MEDIUM',
      metadata: {},
      createdBy: 'alice',
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    };
    await deps.workItems.create(workItem);

    const first = await startWorkflowRunFromActiveVersion(deps, 'alice', definition.id, {
      workItemId: workItem.id,
      inputs: {},
      idempotencyKey: 'same-key',
    });
    const second = await startWorkflowRunFromActiveVersion(deps, 'alice', definition.id, {
      workItemId: workItem.id,
      inputs: {},
      idempotencyKey: 'same-key',
    });

    expect(second.id).toBe(first.id);
  });
});
