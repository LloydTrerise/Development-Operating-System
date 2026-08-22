import type { ApprovalId, ApprovalStatus, ProjectId, WorkflowRunId } from '@devos/contracts';
import type { Approval, ApprovalEvidenceReference, ApprovalRepository } from '@devos/domain';
import type { ApprovalsTable } from '../database.js';
import type { QueryExecutor } from './base.js';

function toDomain(row: ApprovalsTable): Approval {
  return {
    id: row.id as ApprovalId,
    projectId: row.project_id as ProjectId,
    workflowRunId: row.workflow_run_id as WorkflowRunId,
    approvalType: row.approval_type,
    status: row.status as ApprovalStatus,
    requestedBy: row.requested_by,
    ...(row.decided_by !== null ? { decidedBy: row.decided_by } : {}),
    ...(row.decision_reason !== null ? { decisionReason: row.decision_reason } : {}),
    evidenceReference: row.evidence_reference as ApprovalEvidenceReference,
    requestedAt: row.requested_at,
    ...(row.decided_at !== null ? { decidedAt: row.decided_at } : {}),
  };
}

export function createApprovalRepository(db: QueryExecutor): ApprovalRepository {
  return {
    async getById(id) {
      const row = await db
        .selectFrom('approvals')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst();
      return row ? toDomain(row) : null;
    },

    async listForProject(projectId) {
      const rows = await db
        .selectFrom('approvals')
        .selectAll()
        .where('project_id', '=', projectId)
        .orderBy('requested_at', 'desc')
        .execute();
      return rows.map(toDomain);
    },

    async listForRun(workflowRunId) {
      const rows = await db
        .selectFrom('approvals')
        .selectAll()
        .where('workflow_run_id', '=', workflowRunId)
        .orderBy('requested_at', 'asc')
        .execute();
      return rows.map(toDomain);
    },

    async getPendingForRunAndType(workflowRunId, approvalType) {
      const row = await db
        .selectFrom('approvals')
        .selectAll()
        .where('workflow_run_id', '=', workflowRunId)
        .where('approval_type', '=', approvalType)
        .where('status', '=', 'PENDING')
        .executeTakeFirst();
      return row ? toDomain(row) : null;
    },

    async create(approval) {
      await db
        .insertInto('approvals')
        .values({
          id: approval.id,
          project_id: approval.projectId,
          workflow_run_id: approval.workflowRunId,
          approval_type: approval.approvalType,
          status: approval.status,
          requested_by: approval.requestedBy,
          decided_by: approval.decidedBy ?? null,
          decision_reason: approval.decisionReason ?? null,
          evidence_reference: JSON.stringify(approval.evidenceReference),
          requested_at: approval.requestedAt,
          decided_at: approval.decidedAt ?? null,
        })
        .execute();
    },

    async decide(id, status, decidedBy, decisionReason, decidedAt) {
      await db
        .updateTable('approvals')
        .set({
          status,
          decided_by: decidedBy,
          decision_reason: decisionReason ?? null,
          decided_at: decidedAt,
        })
        .where('id', '=', id)
        .execute();
    },
  };
}
