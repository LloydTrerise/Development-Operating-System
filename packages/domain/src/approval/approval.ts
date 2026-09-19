import type {
  ApprovalId,
  ApprovalStatus,
  ProjectId,
  ToolCapabilityRiskClass,
  WorkflowRunId,
} from '@devos/contracts';

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
  /**
   * DEVOS-143: how many *distinct* `APPROVED` decisions this approval needs
   * before it finalizes. Defaults to `1` everywhere it is created — every
   * pre-DEVOS-143 approval behaves exactly as before.
   */
  requiredApprovers: number;
  /**
   * DEVOS-144: when true, `decideApproval` rejects a decision from the same
   * identity that requested the approval. Defaults to `false`.
   */
  enforceSeparationOfDuties: boolean;
  /** DEVOS-145: a `PENDING` approval past this instant transitions to `EXPIRED`. */
  expiresAt?: string;
  /**
   * Gap revisit (post-Sprint-16): how many *distinct* `REJECTED` decisions
   * this approval needs before a rejection finalizes it — the configurable
   * mirror of `requiredApprovers`. Defaults to `1` everywhere it is created
   * (fail-fast on the first rejection), preserving DEVOS-143's own original
   * behaviour exactly; a policy may configure a higher threshold via
   * DEVOS-146's own risk-tiered routing mechanism.
   */
  requiredRejections: number;
  /**
   * Gap revisit (post-Sprint-16): real ABAC context for an approval
   * triggered by a policy's own `REQUIRE_APPROVAL` decision on a real tool
   * invocation (`invoke-tool.ts`) — so `decide-approval.ts`'s own policy
   * check can evaluate the same DEVOS-138 attributes a tool invocation
   * itself was governed by. All optional and unset by every pre-existing
   * approval path (the two hardcoded whole-run gates, the `APPROVAL` graph
   * node) — completely unaffected.
   */
  riskClass?: ToolCapabilityRiskClass;
  agentId?: string;
  agentVersion?: number;
  workflowId?: string;
  workflowVersion?: number;
}

/**
 * DEVOS-143: one individual decision toward a (possibly multi-approver)
 * `Approval`. `Approval.decidedBy`/`decisionReason`/`decidedAt` continue to
 * record only the decision that actually finalized it — this is the full,
 * per-decider audit trail underneath that.
 */
export interface ApprovalDecisionRecord {
  id: string;
  approvalId: ApprovalId;
  decidedBy: string;
  decision: 'APPROVED' | 'REJECTED';
  reason?: string;
  decidedAt: string;
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
  /** DEVOS-143: records one individual decision without itself finalizing the approval. */
  recordDecision: (record: ApprovalDecisionRecord) => Promise<void>;
  listDecisionsForApproval: (approvalId: ApprovalId) => Promise<ApprovalDecisionRecord[]>;
  /** DEVOS-145: transitions every `PENDING` approval whose `expiresAt` has
   * passed to `EXPIRED`, mirroring `TaskQueue.resumeReadyWaits()`'s own
   * shape. Returns the number of rows transitioned. */
  expirePending: (now: string) => Promise<number>;
}
