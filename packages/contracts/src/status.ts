export const workflowVersionStatuses = [
  "DRAFT",
  "VALIDATING",
  "PUBLISHED",
  "DEPRECATED",
  "ARCHIVED",
] as const;
export type WorkflowVersionStatus = typeof workflowVersionStatuses[number];

export const workflowRunStatuses = [
  "DRAFT",
  "QUEUED",
  "RUNNING",
  "WAITING_FOR_INPUT",
  "WAITING_FOR_APPROVAL",
  "PAUSED",
  "FAILED",
  "CANCELLED",
  "COMPLETED",
] as const;
export type WorkflowRunStatus = typeof workflowRunStatuses[number];

export const workflowTaskStatuses = [
  "PENDING",
  "READY",
  "QUEUED",
  "RUNNING",
  "WAITING",
  "SUCCEEDED",
  "FAILED",
] as const;
export type WorkflowTaskStatus = typeof workflowTaskStatuses[number];

export const artifactStatuses = [
  "DRAFT",
  "GENERATED",
  "VALIDATING",
  "REVIEW",
  "CHANGES_REQUESTED",
  "APPROVED",
  "SUPERSEDED",
  "REJECTED",
  "ARCHIVED",
] as const;
export type ArtifactStatus = typeof artifactStatuses[number];

/**
 * The source specifications provide OPEN as the canonical example for a
 * WorkItem status but do not define the complete enumeration. Until that
 * enumeration is formally specified, the contract intentionally preserves
 * the status as an opaque string rather than inventing lifecycle values.
 */
export type WorkItemStatus = string;

export const workflowNodeTypes = [
  "TRIGGER",
  "TASK",
  "AGENT_TASK",
  "TOOL_TASK",
  "APPROVAL",
  "CONDITION",
  "PARALLEL",
  "JOIN",
  "WAIT",
  "END",
] as const;
export type WorkflowNodeType = typeof workflowNodeTypes[number];
