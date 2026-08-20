export const workflowVersionStatuses = [
  "DRAFT",
  "VALIDATING",
  "PUBLISHED",
  "DEPRECATED",
  "ARCHIVED",
] as const;

export const workflowRunStatuses = [
  "PENDING",
  "RUNNING",
  "WAITING_FOR_APPROVAL",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
] as const;

export const workflowTaskStatuses = [
  "PENDING",
  "READY",
  "RUNNING",
  "WAITING_FOR_APPROVAL",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
] as const;

export const artifactStatuses = [
  "DRAFT",
  "IN_REVIEW",
  "APPROVED",
  "REJECTED",
  "SUPERSEDED",
] as const;

export type WorkflowVersionStatus = (typeof workflowVersionStatuses)[number];
export type WorkflowRunStatus = (typeof workflowRunStatuses)[number];
export type WorkflowTaskStatus = (typeof workflowTaskStatuses)[number];
export type ArtifactStatus = (typeof artifactStatuses)[number];

export interface CreateWorkItemRequest {
  title: string;
  source: string;
}

export interface StartWorkflowRunRequest {
  workItemId: string;
  inputs: Record<string, unknown>;
  idempotencyKey: string;
}

export interface ValidationIssue {
  field: string;
  message: string;
}

export interface ValidationSuccess<T> {
  success: true;
  data: T;
  issues: [];
}

export interface ValidationFailure {
  success: false;
  data?: never;
  issues: ValidationIssue[];
}

export type ValidationResult<T> =
  | ValidationSuccess<T>
  | ValidationFailure;

export function validateCreateWorkItemRequest(
  request: CreateWorkItemRequest,
): ValidationResult<CreateWorkItemRequest> {
  const issues: ValidationIssue[] = [];

  if (request.title.trim().length === 0) {
    issues.push({
      field: "title",
      message: "title is required",
    });
  }

  if (request.source.trim().length === 0) {
    issues.push({
      field: "source",
      message: "source is required",
    });
  }

  if (issues.length > 0) {
    return {
      success: false,
      issues,
    };
  }

  return {
    success: true,
    data: {
      title: request.title,
      source: request.source,
    },
    issues: [],
  };
}

export function validateStartWorkflowRunRequest(
  request: StartWorkflowRunRequest,
): ValidationResult<StartWorkflowRunRequest> {
  const issues: ValidationIssue[] = [];

  if (request.workItemId.trim().length === 0) {
    issues.push({
      field: "workItemId",
      message: "workItemId is required",
    });
  }

  if (request.idempotencyKey.trim().length === 0) {
    issues.push({
      field: "idempotencyKey",
      message: "idempotencyKey is required",
    });
  }

  if (request.inputs === null || typeof request.inputs !== "object") {
    issues.push({
      field: "inputs",
      message: "inputs must be an object",
    });
  }

  if (issues.length > 0) {
    return {
      success: false,
      issues,
    };
  }

  return {
    success: true,
    data: {
      workItemId: request.workItemId,
      inputs: request.inputs,
      idempotencyKey: request.idempotencyKey,
    },
    issues: [],
  };
}
