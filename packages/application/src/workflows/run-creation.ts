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
    input: input.inputs,
    idempotencyKey: input.idempotencyKey,
    createdAt: now,
    updatedAt: now,
  };

  const baseCreatedAt = Date.parse(now);
  const tasks: WorkflowTask[] = version.definition.nodes.map((node, index) => ({
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
    input: node.agentRef !== undefined ? { agentRef: node.agentRef } : {},
    // DEVOS-035: sibling tasks in one run previously all shared the exact
    // same `createdAt`, so claimNext()'s `ORDER BY created_at ASC` gave no
    // guarantee about which claimed first — harmless while every Sprint 1
    // workflow had at most one task per run (see hardening.test.ts's own
    // comment working around this), but the four-stage planning-path
    // workflow (discovery -> requirements -> technical design -> planning)
    // depends on each stage's artifact existing before the next one reads
    // it. A one-millisecond-per-node offset makes node declaration order
    // the deterministic claim order, without touching the queue/claim logic
    // itself.
    createdAt: new Date(baseCreatedAt + index).toISOString(),
    updatedAt: now,
  }));

  await deps.startRun(run, tasks, principalId);

  return run;
}
