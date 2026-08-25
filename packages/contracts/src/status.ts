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

/**
 * Source of truth: specs/database/poc-database-schema.md §14.1 —
 * tool_capabilities.risk_class is documented directly as "R0–R4", matching
 * specs/workflows/software-change-workflow.md §27's Risk Model table
 * (R0 automatic through R4 explicit-approval-required).
 */
export const toolCapabilityRiskClasses = ['R0', 'R1', 'R2', 'R3', 'R4'] as const;
export type ToolCapabilityRiskClass = (typeof toolCapabilityRiskClasses)[number];

/**
 * Source of truth: specs/database/poc-database-schema.md §14.1 —
 * tool_capabilities.status is documented as "Active/Disabled", a simpler
 * two-state lifecycle than policies/agent_versions (no draft/publish step:
 * a capability definition is either usable or not).
 */
export const toolCapabilityStatuses = ['ACTIVE', 'DISABLED'] as const;
export type ToolCapabilityStatus = (typeof toolCapabilityStatuses)[number];

/**
 * PROVISIONAL — specs/database/poc-database-schema.md §14.2 documents
 * `tool_invocations.status` only as "Execution state" with no enumerated
 * table (the same gap workflowTaskStatuses/agentExecutionStatuses already
 * flag for their own tables). `REJECTED` covers everything the Tool
 * Gateway's Typed Validation/Project Scope/Policy/Capability Permission
 * steps stop before the provider adapter (specs/api/poc-api-contracts.md
 * §56); `SUCCEEDED`/`FAILED` cover the provider adapter's own outcome.
 */
export const toolInvocationStatuses = ['REJECTED', 'SUCCEEDED', 'FAILED'] as const;
export type ToolInvocationStatus = (typeof toolInvocationStatuses)[number];

/**
 * Source of truth: specs/database/poc-database-schema.md §13.1 —
 * integrations.status is documented as "Active/Disabled/etc." (explicitly
 * non-exhaustive, the same hedge artifactStatuses' source column already
 * uses). Collapsed to the two named values, matching
 * `ToolCapabilityStatus`'s identical shape for the same reason: no
 * draft/publish lifecycle is described for an integration.
 */
export const integrationStatuses = ['ACTIVE', 'DISABLED'] as const;
export type IntegrationStatus = (typeof integrationStatuses)[number];

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
