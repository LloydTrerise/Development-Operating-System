import type { WorkflowRun, WorkflowTask } from '@devos/domain';
import { BadRequestError } from '../http/errors.js';

export function toWorkflowRunDto(run: WorkflowRun) {
  return {
    id: run.id,
    projectId: run.projectId,
    workflowVersionId: run.workflowVersionId,
    workItemId: run.workItemId,
    status: run.status,
    input: run.input,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    errorCode: run.errorCode,
    errorMessage: run.errorMessage,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
  };
}

export function toWorkflowTaskDto(task: WorkflowTask) {
  return {
    id: task.id,
    runId: task.workflowRunId,
    nodeId: task.taskKey,
    type: task.taskType,
    status: task.status,
    attempt: task.attempt,
    inputRefs: [],
    outputRefs: [],
    error: task.errorMessage ?? null,
    startedAt: task.startedAt ?? null,
    completedAt: task.completedAt ?? null,
  };
}

export interface StartRunBody {
  workItemId: string;
  inputs: Record<string, unknown>;
  idempotencyKey: string;
}

export function parseStartRunBody(body: unknown): StartRunBody {
  if (typeof body !== 'object' || body === null) {
    throw new BadRequestError('Request body must be a JSON object.');
  }
  const { workItemId, inputs, idempotencyKey } = body as Record<string, unknown>;

  if (typeof workItemId !== 'string' || workItemId.trim().length === 0) {
    throw new BadRequestError('workItemId is required.');
  }
  if (inputs !== undefined && (typeof inputs !== 'object' || inputs === null)) {
    throw new BadRequestError('inputs must be an object.');
  }
  if (typeof idempotencyKey !== 'string' || idempotencyKey.trim().length === 0) {
    throw new BadRequestError('idempotencyKey is required.');
  }

  return {
    workItemId,
    inputs: (inputs as Record<string, unknown> | undefined) ?? {},
    idempotencyKey,
  };
}
