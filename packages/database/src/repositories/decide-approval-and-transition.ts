import type { ApprovalId } from '@devos/contracts';
import type { Kysely } from 'kysely';
import type { Database } from '../database.js';
import { withTransaction } from './base.js';
import { createApprovalRepository } from './approvals.js';
import { transitionAfterApprovalDecisionInTrx } from './approval-run-transition.js';

/**
 * DEVOS-111: "make approval-decide and run-transition one atomic
 * transaction" — the approval's own `decide()` write and the resulting
 * run-status transition (`transitionAfterApprovalDecisionInTrx`,
 * `approval-run-transition.ts`) now run inside a single database
 * transaction, so a crash between the two (previously two sequential,
 * separately-committed operations) can no longer leave an approval decided
 * but its run not transitioned, or vice versa. `createApprovalRepository`
 * already accepts a plain `QueryExecutor` (pool or transaction) — the same
 * established pattern `withTransaction` callers throughout this codebase
 * already use (e.g. `createProjectWithClonesCreator`,
 * `createWorkflowDraftCreator`) — so no change to that repository was
 * needed to make it composable inside this transaction.
 */
export type DecideApprovalAndTransition = (
  approvalId: string,
  workflowRunId: string,
  approvalType: string,
  decision: 'APPROVED' | 'REJECTED',
  decidedBy: string,
  decisionReason: string | undefined,
  decidedAt: string,
) => Promise<void>;

export function createDecideApprovalAndTransition(
  db: Kysely<Database>,
): DecideApprovalAndTransition {
  return async (
    approvalId,
    workflowRunId,
    approvalType,
    decision,
    decidedBy,
    decisionReason,
    decidedAt,
  ) => {
    await withTransaction(db, async (trx) => {
      await createApprovalRepository(trx).decide(
        approvalId as ApprovalId,
        decision,
        decidedBy,
        decisionReason,
        decidedAt,
      );
      await transitionAfterApprovalDecisionInTrx(
        trx,
        approvalId,
        workflowRunId,
        approvalType,
        decision,
        decidedBy,
        decisionReason,
        decidedAt,
      );
    });
  };
}
