import type { ApprovalId, ApprovalStatus, ProjectId, WorkflowRunId } from '@devos/contracts';

/**
 * "The manifest should identify material sources without unnecessarily
 * persisting sensitive content" (specs/api/poc-api-contracts.md §28,
 * applied here by the same principle) — evidence is a list of references
 * (what is being approved), not the content itself. `scopeHash` is not a
 * documented column in specs/database/poc-database-schema.md §11.1 (only
 * `evidence_reference` JSONB is) — computed server-side at request time and
 * embedded inside `evidence_reference` rather than added as a new top-level
 * column, so a decision can be bound to the exact evidence approved
 * (§29–§30: "Approval decisions must be bound to the exact evidence being
 * approved") without inventing an undocumented schema column.
 */
export interface ApprovalEvidenceReference {
  artifactVersionIds: string[];
  scopeHash: string;
}

/**
 * A concrete request for a human decision (specs/architecture/domain-model.md
 * §10.2), associated with a workflow run. `approvalType` is free-form
 * (schema: "Planning/Release/etc.", not a closed enum) — e.g. `'PLANNING'`
 * for the gate DEVOS-047 introduces.
 */
export interface Approval {
  id: ApprovalId;
  projectId: ProjectId;
  workflowRunId: WorkflowRunId;
  approvalType: string;
  status: ApprovalStatus;
  requestedBy: string;
  decidedBy?: string;
  decisionReason?: string;
  evidenceReference: ApprovalEvidenceReference;
  requestedAt: string;
  decidedAt?: string;
}

export interface ApprovalRepository {
  getById: (id: ApprovalId) => Promise<Approval | null>;
  listForProject: (projectId: ProjectId) => Promise<Approval[]>;
  listForRun: (workflowRunId: WorkflowRunId) => Promise<Approval[]>;
  getPendingForRunAndType: (
    workflowRunId: WorkflowRunId,
    approvalType: string,
  ) => Promise<Approval | null>;
  create: (approval: Approval) => Promise<void>;
  decide: (
    id: ApprovalId,
    status: 'APPROVED' | 'REJECTED',
    decidedBy: string,
    decisionReason: string | undefined,
    decidedAt: string,
  ) => Promise<void>;
}
