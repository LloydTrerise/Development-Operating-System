import type { CreateWorkItemRequest } from './work-items.js';
import type { StartWorkflowRunRequest } from './workflows.js';

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

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

export function validateCreateWorkItemRequest(
  request: CreateWorkItemRequest,
): ValidationResult<CreateWorkItemRequest> {
  const issues: ValidationIssue[] = [];

  if (request.title.trim().length === 0) {
    issues.push({
      field: 'title',
      message: 'title is required',
    });
  }

  if (request.source.trim().length === 0) {
    issues.push({
      field: 'source',
      message: 'source is required',
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
      field: 'workItemId',
      message: 'workItemId is required',
    });
  }

  if (request.idempotencyKey.trim().length === 0) {
    issues.push({
      field: 'idempotencyKey',
      message: 'idempotencyKey is required',
    });
  }

  if (request.inputs === null || typeof request.inputs !== 'object') {
    issues.push({
      field: 'inputs',
      message: 'inputs must be an object',
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
