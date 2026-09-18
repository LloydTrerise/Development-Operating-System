import type { Kysely } from 'kysely';
import type { Database } from '../database.js';
import { writeAuditRecord } from './audit-helper.js';
import { withTransaction, type QueryExecutor } from './base.js';
import { createEventEnvelope } from './event-envelope.js';
import { createOutboxEventRepository, getOrganisationIdForProject } from './outbox-events.js';

const SYSTEM_ACTOR_ID = 'devos-worker';

export interface ApprovalRunTransition {
  /**
   * Records the human decision itself as an audit event, then — only if
   * the run this approval gates is still `AWAITING_APPROVAL` (DEVOS-047) —
   * transitions it: `APPROVED` completes the run (there is no further stage
   * *within this run* to hand off to — the gated run's only job was to
   * reach the gate; whatever comes after, if anything, is started as its
   * own separate run, per the same "a gate needs a separate run" pattern
   * DEVOS-061/067/073 all use); `REJECTED` fails it, since neither the
   * planning re-planning loop (specs/workflows/software-change-workflow.md
   * §16: "Changes Requested -> appropriate planning stage -> new artifact
   * version -> re-approval") nor an equivalent release loop is implemented
   * — flagged as a known limitation, not fabricated. A no-op on the run if
   * it wasn't (or is no longer) `AWAITING_APPROVAL`, so deciding a
   * non-gating approval never corrupts run state.
   *
   * `approvalType` (DEVOS-073) only shapes the *rejection* error
   * code/message — `DEVOS_${approvalType}_APPROVAL_REJECTED` and
   * "${Titlecased approvalType} approval was rejected." — since that's the
   * only place DEVOS-047's original implementation had "Planning" baked in
   * as a literal string; the completion path was already approval-type
   * agnostic.
   */
  transitionAfterApprovalDecision: (
    approvalId: string,
    workflowRunId: string,
    approvalType: string,
    decision: 'APPROVED' | 'REJECTED',
    decidedBy: string,
    decisionReason: string | undefined,
    decidedAt: string,
  ) => Promise<void>;
}

/**
 * DEVOS-111: the actual transition logic, taking an already-open
 * transaction (or plain pool connection) rather than opening its own —
 * factored out so `createDecideApprovalAndTransition`
 * (`decide-approval-and-transition.ts`) can run this in the *same*
 * transaction as the approval decision write itself, making "decide the
 * approval" and "transition the run" one atomic commit instead of two
 * separate ones with a real (if previously unexercised) crash window
 * between them. `createApprovalRunTransition` below is now a thin
 * standalone wrapper over this for any caller that only needs the
 * transition in isolation.
 */
export async function transitionAfterApprovalDecisionInTrx(
  trx: QueryExecutor,
  approvalId: string,
  workflowRunId: string,
  approvalType: string,
  decision: 'APPROVED' | 'REJECTED',
  decidedBy: string,
  decisionReason: string | undefined,
  decidedAt: string,
): Promise<void> {
  const run = await trx
    .selectFrom('workflow_runs')
    .select(['id', 'project_id', 'status'])
    .where('id', '=', workflowRunId)
    .executeTakeFirst();
  if (!run) return;

  const organisationId = await getOrganisationIdForProject(trx, run.project_id);

  const decisionEnvelope = createEventEnvelope(
    decision === 'APPROVED' ? 'ApprovalGranted' : 'ApprovalRejected',
    'Approval',
    approvalId,
    { workflowRunId, decidedBy },
    { projectId: run.project_id },
  );
  await createOutboxEventRepository(trx).create(organisationId, decisionEnvelope);

  await writeAuditRecord(trx, {
    organisationId,
    projectId: run.project_id,
    actorType: 'USER',
    actorId: decidedBy,
    action: decision === 'APPROVED' ? 'approval.approved' : 'approval.rejected',
    targetType: 'Approval',
    targetId: approvalId,
    outcome: 'SUCCESS',
    ...(decisionReason !== undefined ? { metadata: { decisionReason } } : {}),
    correlationId: decisionEnvelope.correlationId,
  });

  if (run.status !== 'AWAITING_APPROVAL') return;

  if (decision === 'APPROVED') {
    await trx
      .updateTable('workflow_runs')
      .set({ status: 'COMPLETED', completed_at: decidedAt, updated_at: decidedAt })
      .where('id', '=', workflowRunId)
      .execute();

    const envelope = createEventEnvelope(
      'WorkflowRunCompleted',
      'WorkflowRun',
      workflowRunId,
      {},
      { projectId: run.project_id },
    );
    await createOutboxEventRepository(trx).create(organisationId, envelope);

    await writeAuditRecord(trx, {
      organisationId,
      projectId: run.project_id,
      actorType: 'SYSTEM',
      actorId: SYSTEM_ACTOR_ID,
      action: 'workflow_run.completed',
      targetType: 'WorkflowRun',
      targetId: workflowRunId,
      outcome: 'SUCCESS',
      correlationId: envelope.correlationId,
    });
  } else {
    const titleCasedType =
      approvalType.charAt(0).toUpperCase() + approvalType.slice(1).toLowerCase();
    const message = `${titleCasedType} approval was rejected.`;
    const errorCode = `DEVOS_${approvalType.toUpperCase()}_APPROVAL_REJECTED`;
    await trx
      .updateTable('workflow_runs')
      .set({
        status: 'FAILED',
        error_code: errorCode,
        error_message: decisionReason ?? message,
        completed_at: decidedAt,
        updated_at: decidedAt,
      })
      .where('id', '=', workflowRunId)
      .execute();

    const envelope = createEventEnvelope(
      'WorkflowRunFailed',
      'WorkflowRun',
      workflowRunId,
      { message: decisionReason ?? message },
      { projectId: run.project_id },
    );
    await createOutboxEventRepository(trx).create(organisationId, envelope);

    await writeAuditRecord(trx, {
      organisationId,
      projectId: run.project_id,
      actorType: 'SYSTEM',
      actorId: SYSTEM_ACTOR_ID,
      action: 'workflow_run.failed',
      targetType: 'WorkflowRun',
      targetId: workflowRunId,
      outcome: 'FAILURE',
      metadata: { message: decisionReason ?? message },
      correlationId: envelope.correlationId,
    });
  }
}

export function createApprovalRunTransition(db: Kysely<Database>): ApprovalRunTransition {
  return {
    async transitionAfterApprovalDecision(
      approvalId,
      workflowRunId,
      approvalType,
      decision,
      decidedBy,
      decisionReason,
      decidedAt,
    ) {
      await withTransaction(db, (trx) =>
        transitionAfterApprovalDecisionInTrx(
          trx,
          approvalId,
          workflowRunId,
          approvalType,
          decision,
          decidedBy,
          decisionReason,
          decidedAt,
        ),
      );
    },
  };
}
