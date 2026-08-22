import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type {
  Artifact,
  ArtifactVersion,
  ProjectId,
  WorkflowRun,
  WorkflowRunRepository,
  WorkflowTask,
  WorkItem,
  WorkItemRepository,
} from '@devos/domain';
import { createLocalFilesystemStorage } from '@devos/storage';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runDiscoveryTask } from '../src/tasks/run-discovery-task.js';
import type { TaskHandlerDeps } from '../src/tasks/deps.js';

describe('runDiscoveryTask', () => {
  let storageDir: string;

  beforeEach(async () => {
    storageDir = await mkdtemp(path.join(tmpdir(), 'devos-run-discovery-task-'));
  });

  afterEach(async () => {
    await rm(storageDir, { recursive: true, force: true });
  });

  it('produces a DISCOVERY_REPORT artifact referencing the work item', async () => {
    const projectId = randomUUID() as ProjectId;
    const now = new Date(0).toISOString();

    const workItem: WorkItem = {
      id: randomUUID() as WorkItem['id'],
      projectId,
      title: 'Investigate slow query',
      description: 'Users report timeouts.',
      type: 'GENERAL',
      status: 'OPEN',
      priority: 'MEDIUM',
      metadata: {},
      createdBy: 'alice',
      createdAt: now,
      updatedAt: now,
    };

    const run: WorkflowRun = {
      id: randomUUID() as WorkflowRun['id'],
      projectId,
      workflowVersionId: randomUUID() as WorkflowRun['workflowVersionId'],
      workItemId: workItem.id,
      status: 'PENDING',
      input: {},
      createdAt: now,
      updatedAt: now,
    };

    const task: WorkflowTask = {
      id: randomUUID() as WorkflowTask['id'],
      workflowRunId: run.id,
      taskKey: 'discovery',
      taskType: 'TASK',
      status: 'RUNNING',
      attempt: 1,
      input: {},
      createdAt: now,
      updatedAt: now,
    };

    let publishedArtifact: Artifact | undefined;
    let publishedVersion: ArtifactVersion | undefined;

    const workflowRuns: WorkflowRunRepository = {
      getById: async (id) => (id === run.id ? run : null),
      getByVersionAndIdempotencyKey: async () => null,
      create: async () => {},
    };
    const workItems: WorkItemRepository = {
      getById: async (id) => (id === workItem.id ? workItem : null),
      listForProject: async () => [],
      create: async () => {},
      update: async () => {},
    };

    const deps: TaskHandlerDeps = {
      workflowRuns,
      workItems,
      storage: createLocalFilesystemStorage(storageDir),
      publishArtifact: async (artifact, version) => {
        publishedArtifact = artifact;
        publishedVersion = version;
      },
    };

    const output = await runDiscoveryTask(deps, task);

    expect(publishedArtifact).toMatchObject({
      artifactType: 'DISCOVERY_REPORT',
      status: 'GENERATED',
      projectId,
      workflowRunId: run.id,
      workflowTaskId: task.id,
    });
    expect(publishedVersion?.contentHash).toHaveLength(64);
    expect(publishedVersion?.metadata).toMatchObject({ workItemId: workItem.id });
    expect(output).toMatchObject({ status: 'SUCCEEDED', artifactType: 'DISCOVERY_REPORT' });
  });

  it('throws when the run cannot be found', async () => {
    const deps: TaskHandlerDeps = {
      workflowRuns: {
        getById: async () => null,
        getByVersionAndIdempotencyKey: async () => null,
        create: async () => {},
      },
      workItems: {
        getById: async () => null,
        listForProject: async () => [],
        create: async () => {},
        update: async () => {},
      },
      storage: createLocalFilesystemStorage(storageDir),
      publishArtifact: async () => {},
    };

    const task: WorkflowTask = {
      id: randomUUID() as WorkflowTask['id'],
      workflowRunId: randomUUID() as WorkflowTask['workflowRunId'],
      taskKey: 'discovery',
      taskType: 'TASK',
      status: 'RUNNING',
      attempt: 1,
      input: {},
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    };

    await expect(runDiscoveryTask(deps, task)).rejects.toThrow('not found');
  });
});
