import type {
  EventId,
  ProjectId,
  UUID,
} from "./ids.js";

export const eventTypes = [
  "WorkflowRunStarted",
  "WorkflowTaskStarted",
  "WorkflowTaskCompleted",
  "WorkflowTaskFailed",
  "AgentExecutionStarted",
  "AgentExecutionCompleted",
  "ArtifactCreated",
  "ArtifactPublished",
  "ApprovalRequested",
  "ApprovalGranted",
  "ApprovalRejected",
  "ToolInvocationStarted",
  "ToolInvocationCompleted",
  "ValidationFailed",
  "WorkflowRunCompleted",
  "WorkflowRunFailed",
] as const;

export type EventType = typeof eventTypes[number];

export interface EventEnvelope<TPayload = Record<string, unknown>> {
  id: EventId;
  type: EventType;
  version: number;
  aggregateType: string;
  aggregateId: UUID;
  projectId?: ProjectId;
  correlationId: UUID;
  causationId?: UUID;
  occurredAt: string;
  payload: TPayload;
}
