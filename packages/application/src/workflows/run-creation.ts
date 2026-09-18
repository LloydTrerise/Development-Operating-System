import { randomUUID } from 'node:crypto';
import type { WorkItemId } from '@devos/contracts';
import type { WorkflowRun, WorkflowTask, WorkflowVersion } from '@devos/domain';
import { NotFoundError, ValidationError } from '../errors.js';
import { resolveMembership } from '../projects/membership-access.js';
import type { WorkflowUseCaseDeps } from './deps.js';

export interface StartRunInput {
  workItemId: WorkItemId;
  inputs: Record<string, unknown>;
  idempotencyKey: string;
  /**
   * DEVOS-088: the API request's correlation id, if the caller supplied
   * one. Folded into the run's own `input` and every task's `input` under
   * a reserved key — the same extensibility point `node.agentRef` already
   * uses — rather than a new database column, so it can be traced from the
   * API request through the workflow into whatever agent/tool activity it
   * causes.
   */
  correlationId?: string;
}

export async function startRunForVersion(
  deps: WorkflowUseCaseDeps,
  principalId: string,
  version: WorkflowVersion,
  input: StartRunInput,
): Promise<WorkflowRun> {
  if (version.status !== 'PUBLISHED') {
    throw new ValidationError('Only a published workflow version can be run.');
  }

  const definition = await deps.workflowDefinitions.getById(version.workflowDefinitionId);
  if (!definition) throw new NotFoundError('Workflow');

  const project = await deps.projects.getById(definition.projectId);
  if (!project) throw new NotFoundError('Workflow');

  const membership = await resolveMembership(deps, principalId, project);
  if (!membership) throw new NotFoundError('Workflow');

  const workItem = await deps.workItems.getById(input.workItemId);
  if (!workItem || workItem.projectId !== project.id) {
    throw new ValidationError('workItemId must reference a work item in the same project.');
  }

  const existing = await deps.workflowRuns.getByVersionAndIdempotencyKey(
    version.id,
    input.idempotencyKey,
  );
  if (existing) return existing;

  const now = new Date().toISOString();
  const run: WorkflowRun = {
    id: randomUUID() as WorkflowRun['id'],
    projectId: project.id,
    workflowVersionId: version.id,
    workItemId: input.workItemId,
    status: 'PENDING',
    input:
      input.correlationId !== undefined
        ? { ...input.inputs, correlationId: input.correlationId }
        : input.inputs,
    idempotencyKey: input.idempotencyKey,
    createdAt: now,
    updatedAt: now,
  };

  const baseCreatedAt = Date.parse(now);
  const tasks: WorkflowTask[] = version.definition.nodes.map((node, index) => {
    // DEVOS-108-followup: `claimNext()` (packages/database/src/repositories/
    // task-queue.ts) previously had no way to know one task depends on
    // another's real output — the one-millisecond `createdAt` offset below
    // only ever biased *ordering among otherwise-equal candidates* for a
    // single sequential claimer; it was never a barrier against a *second*
    // concurrent worker (a real multi-instance production deployment's own
    // normal operating mode, and — confirmed live during DEVOS-108's own
    // pilot verification — an imperfectly-cleaned-up test worker process on
    // this Windows dev machine) claiming a downstream task before its real
    // upstream dependency has actually finished. `dependsOn` (the declared
    // node ids this node's own incoming edges point *from*) is folded into
    // the task's own `input`, the same extensibility point `agentRef`/
    // `correlationId` already use — `claimNext()` now refuses to claim a
    // task until every task named here has reached `SUCCEEDED` in the same
    // run, a real barrier enforced in the same atomic claim query, not just
    // an ordering hint.
    const dependsOn = version.definition.edges
      .filter((edge) => edge.to === node.id)
      .map((edge) => edge.from);

    return {
      id: randomUUID() as WorkflowTask['id'],
      workflowRunId: run.id,
      taskKey: node.id,
      taskType: node.type,
      status: 'PENDING' as const,
      attempt: 0,
      // agentRef (DEVOS-026) is the only per-node config an AGENT_TASK's
      // handler needs to resolve which agent to run — carried through the
      // task's generic `input` blob rather than a new column, the same
      // extensibility point runAgentTask reads from.
      //
      // DEVOS-114: `input.inputs` (the run-start caller's own generic
      // inputs, e.g. a real UI action's `rollbackToRevision`) is now spread
      // into every task's own `input` too — previously only `run.input` got
      // it, leaving no way for a TOOL_TASK like `runReleaseRollbackTask`
      // (which reads `task.input.rollbackToRevision`) to ever actually
      // receive a caller-supplied value. Spread first so the reserved,
      // system-managed keys below always win over a same-named caller input.
      input: {
        ...input.inputs,
        ...(node.agentRef !== undefined ? { agentRef: node.agentRef } : {}),
        ...(input.correlationId !== undefined ? { correlationId: input.correlationId } : {}),
        ...(dependsOn.length > 0 ? { dependsOn } : {}),
      },
      // DEVOS-035: sibling tasks in one run previously all shared the exact
      // same `createdAt`, so claimNext()'s `ORDER BY created_at ASC` gave no
      // guarantee about which claimed first — harmless while every Sprint 1
      // workflow had at most one task per run (see hardening.test.ts's own
      // comment working around this). A one-millisecond-per-node offset
      // keeps node declaration order as a tie-breaker among tasks that are
      // *all* actually claimable at once; `dependsOn` above is what now
      // actually enforces real ordering between tasks that depend on each
      // other.
      createdAt: new Date(baseCreatedAt + index).toISOString(),
      updatedAt: now,
    };
  });

  await deps.startRun(run, tasks, principalId);

  return run;
}
