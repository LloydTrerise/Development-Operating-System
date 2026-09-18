import { randomUUID } from 'node:crypto';
import type {
  Approval,
  ApprovalRepository,
  ArtifactVersion,
  ArtifactVersionRepository,
  WorkflowRun,
  WorkflowRunRepository,
  WorkflowTask,
  WorkflowTaskRepository,
  WorkflowVersionRepository,
} from '@devos/domain';
import { describe, expect, it } from 'vitest';
import type { ApprovalTaskHandlerDeps } from '../src/tasks/run-approval-task.js';
import { runApprovalTask } from '../src/tasks/run-approval-task.js';

const now = new Date(0).toISOString();

function makeRun(): WorkflowRun {
  return {
    id: randomUUID() as WorkflowRun['id'],
    projectId: randomUUID() as WorkflowRun['projectId'],
    workflowVersionId: randomUUID() as WorkflowRun['workflowVersionId'],
    workItemId: randomUUID() as WorkflowRun['workItemId'],
    status: 'PENDING',
    input: {},
    createdAt: now,
    updatedAt: now,
  };
}

function makeTask(
  run: WorkflowRun,
  taskKey: string,
  output?: Record<string, unknown>,
): WorkflowTask {
  return {
    id: randomUUID() as WorkflowTask['id'],
    workflowRunId: run.id,
    taskKey,
    taskType: 'APPROVAL',
    status: 'RUNNING',
    attempt: 1,
    input: {},
    ...(output !== undefined ? { output } : {}),
    createdAt: now,
    updatedAt: now,
  };
}

function makeDeps(
  run: WorkflowRun,
  nodeConfig: Record<string, unknown> | undefined,
  options: {
    siblingTasks?: WorkflowTask[];
    artifactVersions?: ArtifactVersion[];
    approvals?: Approval[];
  } = {},
): ApprovalTaskHandlerDeps & { createdApprovals: Approval[] } {
  const siblingTasks = options.siblingTasks ?? [];
  const artifactVersions = options.artifactVersions ?? [];
  const approvals = [...(options.approvals ?? [])];
  const createdApprovals: Approval[] = [];

  const workflowRuns: WorkflowRunRepository = {
    getById: async (id) => (id === run.id ? run : null),
    getByVersionAndIdempotencyKey: async () => null,
    listForWorkItem: async () => [],
    create: async () => {},
  };

  const workflowVersions: WorkflowVersionRepository = {
    getById: async (id) =>
      id === run.workflowVersionId
        ? {
            id: run.workflowVersionId,
            workflowDefinitionId: randomUUID() as never,
            version: 1,
            status: 'PUBLISHED',
            definition: {
              name: 'Approval Test Workflow',
              trigger: { type: 'WORK_ITEM_MANUAL' },
              inputs: [],
              nodes: [
                {
                  id: 'gate',
                  type: 'APPROVAL',
                  ...(nodeConfig !== undefined ? { config: nodeConfig } : {}),
                },
              ],
              edges: [],
              policies: [],
              outputs: [],
            },
            createdBy: 'test',
            createdAt: now,
          }
        : null,
    getByDefinitionAndVersion: async () => null,
    getLatestForDefinition: async () => null,
    listForDefinition: async () => [],
    create: async () => {},
    updateDefinition: async () => {},
    publish: async () => {},
  };

  const workflowTasks: WorkflowTaskRepository = {
    getById: async (id) => siblingTasks.find((task) => task.id === id) ?? null,
    listForRun: async () => siblingTasks,
    create: async () => {},
  };

  const artifactVersionRepo: ArtifactVersionRepository = {
    getById: async (id) => artifactVersions.find((version) => version.id === id) ?? null,
    listForArtifact: async (artifactId) =>
      artifactVersions.filter((version) => version.artifactId === artifactId),
    create: async () => {},
  };

  const approvalRepo: ApprovalRepository = {
    getById: async (id) => approvals.find((approval) => approval.id === id) ?? null,
    listForProject: async () => [],
    listForRun: async (workflowRunId) =>
      approvals.filter((approval) => approval.workflowRunId === workflowRunId),
    getPendingForRunAndType: async () => null,
    create: async (approval) => {
      approvals.push(approval);
      createdApprovals.push(approval);
    },
    decide: async () => {},
  };

  return {
    workflowRuns,
    workflowVersions,
    workflowTasks,
    artifactVersions: artifactVersionRepo,
    approvals: approvalRepo,
    createdApprovals,
  };
}

describe('runApprovalTask', () => {
  it('creates a pending approval and reports waitUntil on its first call', async () => {
    const run = makeRun();
    const task = makeTask(run, 'gate');
    const deps = makeDeps(run, undefined);

    const output = await runApprovalTask(deps, task);

    expect(deps.createdApprovals).toHaveLength(1);
    const created = deps.createdApprovals[0];
    expect(created).toBeDefined();
    expect(created?.status).toBe('PENDING');
    expect(created?.approvalType).toBe('gate');
    expect(output.approvalId).toBe(created?.id);
    expect(typeof output.waitUntil).toBe('string');
  });

  it('namespaces approvalType with the node key when config.approvalType is set', async () => {
    const run = makeRun();
    const task = makeTask(run, 'gate');
    const deps = makeDeps(run, { approvalType: 'MID_BRANCH' });

    await runApprovalTask(deps, task);

    expect(deps.createdApprovals[0]?.approvalType).toBe('MID_BRANCH:gate');
  });

  it('binds evidence to the latest artifact version produced by a prior task in the run', async () => {
    const run = makeRun();
    const task = makeTask(run, 'gate');
    const artifactId = randomUUID();
    const producer = makeTask(run, 'produce', { artifactId });
    const olderVersion: ArtifactVersion = {
      id: randomUUID() as ArtifactVersion['id'],
      artifactId: artifactId as ArtifactVersion['artifactId'],
      version: 1,
      contentType: 'text/plain',
      contentUri: 'file:///old',
      contentHash: 'old',
      createdBy: 'test',
      createdAt: now,
    };
    const latestVersion: ArtifactVersion = {
      ...olderVersion,
      id: randomUUID() as ArtifactVersion['id'],
      version: 2,
      contentUri: 'file:///latest',
      contentHash: 'latest',
    };
    const deps = makeDeps(run, undefined, {
      siblingTasks: [producer],
      artifactVersions: [olderVersion, latestVersion],
    });

    await runApprovalTask(deps, task);

    expect(deps.createdApprovals[0]?.evidenceReference.artifactVersionIds).toEqual([
      latestVersion.id,
    ]);
  });

  it('reports another waitUntil while the approval is still pending', async () => {
    const run = makeRun();
    const approvalId = randomUUID() as Approval['id'];
    const pending: Approval = {
      id: approvalId,
      projectId: run.projectId,
      workflowRunId: run.id,
      approvalType: 'gate',
      status: 'PENDING',
      requestedBy: 'devos-worker',
      evidenceReference: { artifactVersionIds: [], scopeHash: 'hash' },
      requestedAt: now,
    };
    const task = makeTask(run, 'gate');
    const deps = makeDeps(run, undefined, { approvals: [pending] });

    const output = await runApprovalTask(deps, task);

    expect(deps.createdApprovals).toHaveLength(0);
    expect(output.approvalId).toBe(approvalId);
    expect(typeof output.waitUntil).toBe('string');
  });

  it('completes once the approval is APPROVED', async () => {
    const run = makeRun();
    const approvalId = randomUUID() as Approval['id'];
    const approved: Approval = {
      id: approvalId,
      projectId: run.projectId,
      workflowRunId: run.id,
      approvalType: 'gate',
      status: 'APPROVED',
      requestedBy: 'devos-worker',
      decidedBy: 'owner@example.com',
      evidenceReference: { artifactVersionIds: [], scopeHash: 'hash' },
      requestedAt: now,
      decidedAt: now,
    };
    const task = makeTask(run, 'gate');
    const deps = makeDeps(run, undefined, { approvals: [approved] });

    const output = await runApprovalTask(deps, task);

    expect(output).toMatchObject({
      status: 'SUCCEEDED',
      approvalId,
      decidedBy: 'owner@example.com',
    });
  });

  it('throws a non-retryable error once the approval is REJECTED', async () => {
    const run = makeRun();
    const approvalId = randomUUID() as Approval['id'];
    const rejected: Approval = {
      id: approvalId,
      projectId: run.projectId,
      workflowRunId: run.id,
      approvalType: 'gate',
      status: 'REJECTED',
      requestedBy: 'devos-worker',
      decidedBy: 'owner@example.com',
      decisionReason: 'Not ready.',
      evidenceReference: { artifactVersionIds: [], scopeHash: 'hash' },
      requestedAt: now,
      decidedAt: now,
    };
    const task = makeTask(run, 'gate');
    const deps = makeDeps(run, undefined, { approvals: [rejected] });

    await expect(runApprovalTask(deps, task)).rejects.toThrow('Not ready.');
  });

  it('throws when the run cannot be found', async () => {
    const run = makeRun();
    const task = makeTask(run, 'gate');
    const deps = makeDeps(run, undefined);
    const missingTask = { ...task, workflowRunId: randomUUID() as WorkflowTask['workflowRunId'] };

    await expect(runApprovalTask(deps, missingTask)).rejects.toThrow('not found');
  });
});
