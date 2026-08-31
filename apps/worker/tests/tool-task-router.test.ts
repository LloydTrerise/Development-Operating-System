import { randomUUID } from 'node:crypto';
import type {
  Artifact,
  ArtifactRepository,
  ProjectId,
  WorkflowRun,
  WorkflowRunRepository,
  WorkflowTask,
  WorkItem,
} from '@devos/domain';
import { describe, expect, it } from 'vitest';
import { routeToolTask } from '../src/tool-task-router.js';

const now = new Date(0).toISOString();

function buildRun(): { run: WorkflowRun; projectId: ProjectId; workItem: WorkItem } {
  const projectId = randomUUID() as ProjectId;
  const workItem: WorkItem = {
    id: randomUUID() as WorkItem['id'],
    projectId,
    title: 'Router test work item',
    description: 'Exercises DEVOS-073s tool-task routing.',
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
  return { run, projectId, workItem };
}

function buildTask(runId: string, taskKey: string): WorkflowTask {
  return {
    id: randomUUID() as WorkflowTask['id'],
    workflowRunId: runId as WorkflowTask['workflowRunId'],
    taskKey,
    taskType: 'TOOL_TASK',
    status: 'RUNNING',
    attempt: 1,
    input: {},
    createdAt: now,
    updatedAt: now,
  };
}

describe('routeToolTask', () => {
  it('routes taskKey "validation" to runValidationTask (DEVOS-064)', async () => {
    const { run, workItem } = buildRun();
    const workflowRuns: WorkflowRunRepository = {
      getById: async (id) => (id === run.id ? run : null),
      getByVersionAndIdempotencyKey: async () => null,
      create: async () => {},
    };
    const artifacts: ArtifactRepository = {
      getById: async () => null,
      listForProject: async () => [],
      create: async () => {},
    };
    const deps = {
      workflowRuns,
      workItems: {
        getById: async (id: string) => (id === workItem.id ? workItem : null),
        listForProject: async () => [],
      } as never,
      storage: {} as never,
      publishArtifact: async () => {},
      artifacts,
      artifactVersions: { listForArtifact: async () => [] } as never,
      projects: {} as never,
      memberships: {} as never,
      policies: {} as never,
      toolCapabilities: {} as never,
      toolInvocations: {} as never,
      auditRecords: {} as never,
      integrations: {} as never,
    };

    await expect(routeToolTask(deps, buildTask(run.id, 'validation'))).rejects.toThrow(
      'No CODE_CHANGE artifact found',
    );
  });

  it('routes taskKey "release-readiness-check" to runReleaseReadinessCheckTask (DEVOS-073)', async () => {
    const { run } = buildRun();
    const workflowRuns: WorkflowRunRepository = {
      getById: async (id) => (id === run.id ? run : null),
      getByVersionAndIdempotencyKey: async () => null,
      create: async () => {},
    };
    const artifacts: ArtifactRepository = {
      getById: async () => null,
      listForProject: async () => [] as Artifact[],
      create: async () => {},
    };
    const deps = {
      workflowRuns,
      workItems: {} as never,
      storage: {} as never,
      publishArtifact: async () => {},
      artifacts,
      artifactVersions: { listForArtifact: async () => [] } as never,
      projects: {} as never,
      memberships: {} as never,
      policies: {} as never,
      toolCapabilities: {} as never,
      toolInvocations: {} as never,
      auditRecords: {} as never,
      integrations: {} as never,
    };

    await expect(routeToolTask(deps, buildTask(run.id, 'release-readiness-check'))).rejects.toThrow(
      'Release is not ready',
    );
  });

  it('routes taskKey "release" to runReleaseTask (DEVOS-076)', async () => {
    const { run } = buildRun();
    const workflowRuns: WorkflowRunRepository = {
      getById: async (id) => (id === run.id ? run : null),
      getByVersionAndIdempotencyKey: async () => null,
      create: async () => {},
    };
    const artifacts: ArtifactRepository = {
      getById: async () => null,
      listForProject: async () => [] as Artifact[],
      create: async () => {},
    };
    const deps = {
      workflowRuns,
      workItems: {} as never,
      storage: {} as never,
      publishArtifact: async () => {},
      artifacts,
      artifactVersions: { listForArtifact: async () => [] } as never,
      projects: {} as never,
      memberships: {} as never,
      policies: {} as never,
      toolCapabilities: {} as never,
      toolInvocations: {} as never,
      auditRecords: {} as never,
      integrations: {} as never,
      approvals: {} as never,
      closeWorkItem: async () => {},
    };

    await expect(routeToolTask(deps, buildTask(run.id, 'release'))).rejects.toThrow(
      'No CODE_CHANGE artifact found',
    );
  });

  it('routes taskKey "rollback" to runReleaseRollbackTask (DEVOS-114)', async () => {
    const { run } = buildRun();
    const workflowRuns: WorkflowRunRepository = {
      getById: async (id) => (id === run.id ? run : null),
      getByVersionAndIdempotencyKey: async () => null,
      create: async () => {},
    };
    const deps = {
      workflowRuns,
      workItems: {} as never,
      storage: {} as never,
      publishArtifact: async () => {},
      artifacts: {} as never,
      artifactVersions: {} as never,
      projects: {} as never,
      memberships: {} as never,
      policies: {} as never,
      toolCapabilities: {} as never,
      toolInvocations: {} as never,
      auditRecords: {} as never,
      integrations: {} as never,
      approvals: {} as never,
      closeWorkItem: async () => {},
    };

    // No rollbackToRevision in the task's own input (buildTask() defaults
    // it to {}) — proves the switch case actually dispatches to
    // runReleaseRollbackTask, which requires it explicitly and is never
    // triggered automatically (DEVOS-077).
    await expect(routeToolTask(deps, buildTask(run.id, 'rollback'))).rejects.toThrow(
      'rollbackToRevision is required',
    );
  });

  it('routes taskKey "closure" to runClosureTask (DEVOS-078)', async () => {
    const { run } = buildRun();
    const workflowRuns: WorkflowRunRepository = {
      getById: async (id) => (id === run.id ? run : null),
      getByVersionAndIdempotencyKey: async () => null,
      create: async () => {},
    };
    const deps = {
      workflowRuns,
      workItems: { getById: async () => null } as never,
      storage: {} as never,
      publishArtifact: async () => {},
      artifacts: {} as never,
      artifactVersions: {} as never,
      projects: {} as never,
      memberships: {} as never,
      policies: {} as never,
      toolCapabilities: {} as never,
      toolInvocations: {} as never,
      auditRecords: {} as never,
      integrations: {} as never,
      approvals: {} as never,
      closeWorkItem: async () => {},
    };

    await expect(routeToolTask(deps, buildTask(run.id, 'closure'))).rejects.toThrow(
      'WorkItem not found',
    );
  });

  it('throws clearly for an unrecognized taskKey', async () => {
    const { run } = buildRun();
    const workflowRuns: WorkflowRunRepository = {
      getById: async (id) => (id === run.id ? run : null),
      getByVersionAndIdempotencyKey: async () => null,
      create: async () => {},
    };
    const deps = {
      workflowRuns,
      workItems: {} as never,
      storage: {} as never,
      publishArtifact: async () => {},
      artifacts: {} as never,
      artifactVersions: {} as never,
      projects: {} as never,
      memberships: {} as never,
      policies: {} as never,
      toolCapabilities: {} as never,
      toolInvocations: {} as never,
      auditRecords: {} as never,
      integrations: {} as never,
    };

    await expect(routeToolTask(deps, buildTask(run.id, 'not-a-real-task-key'))).rejects.toThrow(
      'No tool-task handler registered',
    );
  });
});
