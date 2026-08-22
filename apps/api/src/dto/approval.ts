import type { Approval } from '@devos/domain';
import { BadRequestError } from '../http/errors.js';

export function toApprovalDto(approval: Approval) {
  return {
    id: approval.id,
    projectId: approval.projectId,
    workflowRunId: approval.workflowRunId,
    approvalType: approval.approvalType,
    status: approval.status,
    requestedBy: approval.requestedBy,
    decidedBy: approval.decidedBy,
    decisionReason: approval.decisionReason,
    evidenceReference: approval.evidenceReference,
    requestedAt: approval.requestedAt,
    decidedAt: approval.decidedAt,
  };
}

function asRecord(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null) {
    throw new BadRequestError('Request body must be a JSON object.');
  }
  return body as Record<string, unknown>;
}

export interface RequestApprovalBody {
  workflowRunId: string;
  approvalType: string;
  artifactVersionIds: string[];
}

export function parseRequestApprovalBody(body: unknown): RequestApprovalBody {
  const record = asRecord(body);

  const workflowRunId = record.workflowRunId;
  if (typeof workflowRunId !== 'string' || workflowRunId.trim().length === 0) {
    throw new BadRequestError('workflowRunId is required.');
  }

  const approvalType = record.approvalType;
  if (typeof approvalType !== 'string' || approvalType.trim().length === 0) {
    throw new BadRequestError('approvalType is required.');
  }

  const artifactVersionIds = record.artifactVersionIds;
  if (
    !Array.isArray(artifactVersionIds) ||
    artifactVersionIds.length === 0 ||
    !artifactVersionIds.every((item) => typeof item === 'string')
  ) {
    throw new BadRequestError('artifactVersionIds must be a non-empty array of strings.');
  }

  return { workflowRunId, approvalType, artifactVersionIds };
}

export interface DecideApprovalBody {
  scopeHash: string;
  comment?: string;
}

export function parseDecideApprovalBody(body: unknown): DecideApprovalBody {
  const record = asRecord(body);

  const scopeHash = record.scopeHash;
  if (typeof scopeHash !== 'string' || scopeHash.trim().length === 0) {
    throw new BadRequestError('scopeHash is required.');
  }

  const comment = record.comment;
  if (comment !== undefined && typeof comment !== 'string') {
    throw new BadRequestError('comment must be a string.');
  }

  return { scopeHash, ...(comment !== undefined ? { comment } : {}) };
}
