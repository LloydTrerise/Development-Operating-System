export type Brand<T, B extends string> = T & { readonly __brand: B };

export type OrganisationId = Brand<string, 'OrganisationId'>;
export type ProjectId = Brand<string, 'ProjectId'>;
export type UserId = Brand<string, 'UserId'>;
export type MembershipId = Brand<string, 'MembershipId'>;
export type WorkItemId = Brand<string, 'WorkItemId'>;
export type WorkflowId = Brand<string, 'WorkflowId'>;
export type WorkflowVersionId = Brand<string, 'WorkflowVersionId'>;
export type WorkflowRunId = Brand<string, 'WorkflowRunId'>;
export type WorkflowTaskId = Brand<string, 'WorkflowTaskId'>;
export type AgentId = Brand<string, 'AgentId'>;
export type AgentVersionId = Brand<string, 'AgentVersionId'>;
export type AgentExecutionId = Brand<string, 'AgentExecutionId'>;
export type ContextManifestId = Brand<string, 'ContextManifestId'>;
export type ToolId = Brand<string, 'ToolId'>;
export type ToolInvocationId = Brand<string, 'ToolInvocationId'>;
export type ArtifactId = Brand<string, 'ArtifactId'>;
export type ArtifactVersionId = Brand<string, 'ArtifactVersionId'>;
export type ApprovalId = Brand<string, 'ApprovalId'>;
export type KnowledgeSourceId = Brand<string, 'KnowledgeSourceId'>;
export type KnowledgeReferenceId = Brand<string, 'KnowledgeReferenceId'>;
export type PolicyId = Brand<string, 'PolicyId'>;
export type ToolCapabilityId = Brand<string, 'ToolCapabilityId'>;
export type IntegrationId = Brand<string, 'IntegrationId'>;
export type EventId = Brand<string, 'EventId'>;
export type AuditId = Brand<string, 'AuditId'>;

export type UUID = string;

export function isUuid(value: unknown): value is UUID {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}
