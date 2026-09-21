import type {
  ApprovalId,
  ApprovalStatus,
  ProjectId,
  ToolCapabilityRiskClass,
  WorkflowRunId,
} from '@devos/contracts';
import type {
  Approval,
  ApprovalDecisionRecord,
  ApprovalEvidenceReference,
  ApprovalRepository,
} from '@devos/domain';
import type { ApprovalDecisionsTable, ApprovalsTable } from '../database.js';
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
    requiredApprovers: row.required_approvers,
    enforceSeparationOfDuties: row.enforce_separation_of_duties,
    ...(row.expires_at !== null ? { expiresAt: row.expires_at } : {}),
    requiredRejections: row.required_rejections,
    ...(row.risk_class !== null ? { riskClass: row.risk_class as ToolCapabilityRiskClass } : {}),
    ...(row.agent_id !== null ? { agentId: row.agent_id } : {}),
    ...(row.agent_version !== null ? { agentVersion: row.agent_version } : {}),
    ...(row.workflow_id !== null ? { workflowId: row.workflow_id } : {}),
    ...(row.workflow_version !== null ? { workflowVersion: row.workflow_version } : {}),
    ...(row.reliability_evidence !== null
      ? {
          reliabilityEvidence: row.reliability_evidence as NonNullable<
            Approval['reliabilityEvidence']
          >,
        }
      : {}),
  };
}

function toDecisionDomain(row: ApprovalDecisionsTable): ApprovalDecisionRecord {
  return {
    id: row.id,
    approvalId: row.approval_id as ApprovalId,
    decidedBy: row.decided_by,
    decision: row.decision as ApprovalDecisionRecord['decision'],
    ...(row.reason !== null ? { reason: row.reason } : {}),
    decidedAt: row.decided_at,
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
          required_approvers: approval.requiredApprovers,
          enforce_separation_of_duties: approval.enforceSeparationOfDuties,
          expires_at: approval.expiresAt ?? null,
          required_rejections: approval.requiredRejections,
          risk_class: approval.riskClass ?? null,
          agent_id: approval.agentId ?? null,
          agent_version: approval.agentVersion ?? null,
          workflow_id: approval.workflowId ?? null,
          workflow_version: approval.workflowVersion ?? null,
          reliability_evidence: approval.reliabilityEvidence
            ? JSON.stringify(approval.reliabilityEvidence)
            : null,
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

    async recordDecision(record) {
      await db
        .insertInto('approval_decisions')
        .values({
          id: record.id,
          approval_id: record.approvalId,
          decided_by: record.decidedBy,
          decision: record.decision,
          reason: record.reason ?? null,
          decided_at: record.decidedAt,
        })
        .execute();
    },

    async listDecisionsForApproval(approvalId) {
      const rows = await db
        .selectFrom('approval_decisions')
        .selectAll()
        .where('approval_id', '=', approvalId)
        .orderBy('decided_at', 'asc')
        .execute();
      return rows.map(toDecisionDomain);
    },

    async expirePending(now) {
      const result = await db
        .updateTable('approvals')
        .set({ status: 'EXPIRED' })
        .where('status', '=', 'PENDING')
        .where('expires_at', 'is not', null)
        .where('expires_at', '<', now)
        .executeTakeFirst();
      return Number(result.numUpdatedRows ?? 0n);
    },
  };
}
