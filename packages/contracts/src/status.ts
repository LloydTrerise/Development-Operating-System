export const workflowVersionStatuses = [
  'DRAFT',
  'VALIDATING',
  'PUBLISHED',
  'DEPRECATED',
  'ARCHIVED',
] as const;
export type WorkflowVersionStatus = (typeof workflowVersionStatuses)[number];

/**
 * Source of truth: specs/api/poc-api-contracts.md §18 "Workflow Run State
 * Contract", verbatim-matched by specs/workflows/software-change-workflow.md
 * §9 "Workflow-Level State".
 */
export const workflowRunStatuses = [
  'PENDING',
  'RUNNING',
  'WAITING',
  'AWAITING_APPROVAL',
  'PAUSED',
  'FAILED',
  'CANCELLED',
  'COMPLETED',
] as const;
export type WorkflowRunStatus = (typeof workflowRunStatuses)[number];

/**
 * PROVISIONAL — no spec defines an authoritative task-status enumeration.
 * specs/api/poc-api-contracts.md §19 shows a single example value
 * ("RUNNING") with no enumerated table. Revisit when task execution
 * (DEVOS-0xx) is implemented rather than treating this list as settled.
 */
export const workflowTaskStatuses = [
  'PENDING',
  'READY',
  'QUEUED',
  'RUNNING',
  'WAITING',
  'SUCCEEDED',
  'FAILED',
] as const;
export type WorkflowTaskStatus = (typeof workflowTaskStatuses)[number];

/**
 * PROVISIONAL — no spec defines an authoritative artifact-status
 * enumeration. specs/database/poc-database-schema.md describes the column
 * as "Draft/Approved/Final/etc." (explicitly non-exhaustive), and
 * specs/api/poc-api-contracts.md §25's example value ("VALIDATED") does not
 * appear in this list. Revisit when artifact endpoints (DEVOS-0xx) are
 * implemented rather than treating this list as settled.
 */
export const artifactStatuses = [
  'DRAFT',
  'GENERATED',
  'VALIDATING',
  'REVIEW',
  'CHANGES_REQUESTED',
  'APPROVED',
  'SUPERSEDED',
  'REJECTED',
  'ARCHIVED',
] as const;
export type ArtifactStatus = (typeof artifactStatuses)[number];

/**
 * The source specifications provide OPEN as the canonical example for a
 * WorkItem status but do not define the complete enumeration. Until that
 * enumeration is formally specified, the contract intentionally preserves
 * the status as an opaque string rather than inventing lifecycle values.
 */
export type WorkItemStatus = string;

/**
 * Source of truth: specs/database/poc-database-schema.md §9.2 —
 * agent_versions.status is documented as "Draft/Published/Retired", a
 * simpler three-state lifecycle than workflow versions' five states (no
 * VALIDATING/DEPRECATED/ARCHIVED equivalent is specified for agents).
 */
export const agentVersionStatuses = ['DRAFT', 'PUBLISHED', 'RETIRED'] as const;
export type AgentVersionStatus = (typeof agentVersionStatuses)[number];

/**
 * Source of truth: specs/database/poc-database-schema.md §12.1 —
 * policies.status is documented as "Draft/Published/Retired", the same
 * three-state shape as agent_versions.status (a separate type, not reused,
 * since these are conceptually distinct domains that happen to share a
 * lifecycle shape).
 */
export const policyStatuses = ['DRAFT', 'PUBLISHED', 'RETIRED'] as const;
export type PolicyStatus = (typeof policyStatuses)[number];

/**
 * Source of truth: specs/database/poc-database-schema.md §11.1 —
 * approvals.status is documented as "Pending/Approved/Rejected" (3 values).
 * specs/architecture/domain-model.md §20's conceptual lifecycle diagram
 * shows 5 states (Required/Requested/Rejected/Changes Requested/Approved) —
 * reconciled explicitly (DEVOS-045's decision log) rather than silently
 * picking one: "Required" is not a persisted state at all (it's the
 * absence of an approval row, before a request exists); "Changes
 * Requested" has no distinct persisted value and is represented as
 * REJECTED with a `decisionReason` describing what changed, since the
 * schema defines no fourth status value for it.
 */
export const approvalStatuses = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export type ApprovalStatus = (typeof approvalStatuses)[number];

/**
 * PROVISIONAL — specs/architecture/domain-model.md §18 gives only a
 * conceptual lifecycle (Created → Started → Output Produced → Validated →
 * Completed, with a Failed branch) and explicitly states "the final state
 * model belongs in the technical design," which doesn't further specify
 * one. Collapsed here to a terminal-status pair (SUCCEEDED/FAILED) matching
 * how workflowTaskStatuses already collapses the same conceptual richness,
 * since agent executions ride on the same WorkflowTask machinery.
 */
export const agentExecutionStatuses = ['PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED'] as const;
export type AgentExecutionStatus = (typeof agentExecutionStatuses)[number];

export const workflowNodeTypes = [
  'TRIGGER',
  'TASK',
  'AGENT_TASK',
  'TOOL_TASK',
  'APPROVAL',
  'CONDITION',
  'PARALLEL',
  'JOIN',
  'WAIT',
  'END',
] as const;
export type WorkflowNodeType = (typeof workflowNodeTypes)[number];
