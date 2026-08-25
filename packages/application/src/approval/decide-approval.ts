import type { ApprovalId } from '@devos/contracts';
import { canDecideApproval, type Approval } from '@devos/domain';
import { ForbiddenError, NotFoundError, ValidationError } from '../errors.js';
import { resolveMembership } from '../projects/membership-access.js';
import type { ApprovalUseCaseDeps } from './deps.js';

const TERMINAL_RUN_STATUSES = new Set(['COMPLETED', 'FAILED', 'CANCELLED']);

export interface DecideApprovalInput {
  scopeHash: string;
  comment?: string;
}

/**
 * Shared verification for both approve and reject (specs/api/poc-api-contracts.md
 * §30: "The server verifies: approval scope hash; reviewer role; current
 * workflow state; applicable policy."):
 *
 * - scope hash: the caller must supply the exact hash computed over the
 *   evidence at request time — "the client cannot grant itself authority
 *   through the request payload" (§30) is enforced by requiring the caller
 *   to already know/reproduce server-computed evidence, not merely assert a
 *   decision.
 * - reviewer role: no dedicated "reviewer" role exists in this codebase
 *   (only `OWNER`/`MEMBER`, specs/database/poc-database-schema.md has no
 *   documented reviewer concept either) — `OWNER` is used as the reviewer
 *   role, an explicit assumption, consistent with every other consequential
 *   project action (e.g. removing the last owner) already requiring it.
 * - current workflow state: a decision cannot be recorded against a run
 *   that has already reached a terminal state.
 * - applicable policy: deliberately not consulted here — DEVOS-044's
 *   evaluator is not yet wired into any real decision point (see its own
 *   decision log entry); wiring it into approval decisions specifically is
 *   left for a future task if the product direction calls for it.
 */
async function decideApproval(
  deps: ApprovalUseCaseDeps,
  principalId: string,
  approvalId: ApprovalId,
  status: 'APPROVED' | 'REJECTED',
  input: DecideApprovalInput,
): Promise<Approval> {
  const approval = await deps.approvals.getById(approvalId);
  if (!approval) throw new NotFoundError('Approval');

  const project = await deps.projects.getById(approval.projectId);
  if (!project) throw new NotFoundError('Approval');

  const membership = await resolveMembership(deps, principalId, project);
  if (!membership) throw new NotFoundError('Approval');
  if (!canDecideApproval(membership.role)) {
    throw new ForbiddenError('Only a project owner may decide an approval.');
  }

  if (approval.status !== 'PENDING') {
    throw new ValidationError(`Approval is already ${approval.status}.`);
  }

  const run = await deps.workflowRuns.getById(approval.workflowRunId);
  if (!run) throw new NotFoundError('Approval');
  if (TERMINAL_RUN_STATUSES.has(run.status)) {
    throw new ValidationError(`Workflow run has already reached a terminal state (${run.status}).`);
  }

  if (input.scopeHash !== approval.evidenceReference.scopeHash) {
    throw new ValidationError(
      'scopeHash does not match the evidence this approval was requested against.',
    );
  }

  const decidedAt = new Date().toISOString();
  await deps.approvals.decide(approval.id, status, principalId, input.comment, decidedAt);
  await deps.transitionAfterApprovalDecision(
    approval.id,
    approval.workflowRunId,
    approval.approvalType,
    status,
    principalId,
    input.comment,
    decidedAt,
  );

  return {
    ...approval,
    status,
    decidedBy: principalId,
    ...(input.comment !== undefined ? { decisionReason: input.comment } : {}),
    decidedAt,
  };
}

export async function approveApproval(
  deps: ApprovalUseCaseDeps,
  principalId: string,
  approvalId: ApprovalId,
  input: DecideApprovalInput,
): Promise<Approval> {
  return decideApproval(deps, principalId, approvalId, 'APPROVED', input);
}

export async function rejectApproval(
  deps: ApprovalUseCaseDeps,
  principalId: string,
  approvalId: ApprovalId,
  input: DecideApprovalInput,
): Promise<Approval> {
  return decideApproval(deps, principalId, approvalId, 'REJECTED', input);
}
