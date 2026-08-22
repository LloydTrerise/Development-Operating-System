import type { Kysely } from 'kysely';
import type { Database } from '../database.js';
import { writeAuditRecord } from './audit-helper.js';
import { withTransaction } from './base.js';
import { createEventEnvelope } from './event-envelope.js';
import { createOutboxEventRepository, getOrganisationIdForProject } from './outbox-events.js';

const SYSTEM_ACTOR_ID = 'devos-worker';

export interface ApprovalRunTransition {
  /**
   * Records the human decision itself as an audit event, then — only if
   * the run this approval gates is still `AWAITING_APPROVAL` (DEVOS-047) —
   * transitions it: `APPROVED` completes the run (there is no development
   * stage yet to hand off to, per this sprint's own scope boundary);
   * `REJECTED` fails it, since the re-planning loop
   * (specs/workflows/software-change-workflow.md §16: "Changes Requested ->
   * appropriate planning stage -> new artifact version -> re-approval") is
   * not implemented — flagged as a known limitation, not fabricated.
   * A no-op on the run if it wasn't (or is no longer) `AWAITING_APPROVAL`,
   * so deciding a non-gating approval never corrupts run state.
   */
  transitionAfterApprovalDecision: (
    approvalId: string,
    workflowRunId: string,
    decision: 'APPROVED' | 'REJECTED',
    decidedBy: string,
    decisionReason: string | undefined,
    decidedAt: string,
  ) => Promise<void>;
}

export function createApprovalRunTransition(db: Kysely<Database>): ApprovalRunTransition {
  return {
    async transitionAfterApprovalDecision(
      approvalId,
      workflowRunId,
      decision,
      decidedBy,
      decisionReason,
      decidedAt,
    ) {
      await withTransaction(db, async (trx) => {
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
          const message = 'Planning approval was rejected.';
          await trx
            .updateTable('workflow_runs')
            .set({
              status: 'FAILED',
              error_code: 'DEVOS_PLANNING_APPROVAL_REJECTED',
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
      });
    },
  };
}
