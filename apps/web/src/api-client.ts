import type { ApiErrorResponse, ApiResponse } from '@devos/contracts';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

/**
 * DEVOS-020 decision: no login UI exists yet (real OIDC auth is out of
 * Sprint 1 scope). The API's local dev auth provider (DEVOS-010) treats the
 * bearer token as the principal id directly, so the web app authenticates
 * every request as this fixed seeded principal, matching how this session's
 * curl-based verification has worked throughout. Overridable for local
 * testing via VITE_DEV_PRINCIPAL_ID.
 */
export const DEV_PRINCIPAL_ID = import.meta.env.VITE_DEV_PRINCIPAL_ID ?? 'seed-user';

export interface HealthStatus {
  status: 'ok';
}

export interface Organisation {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  organisationId: string;
  projectTypeId: string;
  name: string;
  slug: string;
  description?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectType {
  id: string;
  key: string;
  name: string;
  description?: string;
  status: 'ACTIVE' | 'DISABLED';
  createdAt: string;
  updatedAt: string;
}

/** Mirrors @devos/contracts WorkflowNode — kept as a local shape so the web
 * app doesn't take a workspace-internal dependency just for these few
 * fields. */
export interface WorkflowNode {
  id: string;
  type: string;
  name?: string;
  agentRef?: string;
}

export interface WorkflowEdge {
  from: string;
  to: string;
}

/** Mirrors @devos/contracts WorkflowDefinition (the graph shape, not the
 * persisted entity of the same name) — what a ProjectTypeWorkflow's
 * `definition` and a real WorkflowVersion's `definition` both carry. */
export interface WorkflowGraph {
  name: string;
  description?: string;
  trigger: Record<string, unknown>;
  inputs: { name: string; type: string; required: boolean }[];
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  policies: string[];
  outputs: unknown[];
}

export interface ProjectTypeWorkflow {
  id: string;
  projectTypeId: string;
  key: string;
  name: string;
  definition: WorkflowGraph;
  createdAt: string;
  updatedAt: string;
}

export interface AgentConfiguration {
  role: string;
  provider: string;
  modelRef: string;
  inputSchemaRef?: string;
  outputSchemaRef?: string;
  allowedCapabilities: string[];
}

export interface ProjectTypeAgent {
  id: string;
  projectTypeId: string;
  key: string;
  name: string;
  configuration: AgentConfiguration;
  promptReference?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkItem {
  id: string;
  projectId: string;
  externalRef?: string;
  title: string;
  description?: string;
  type: string;
  status: string;
  priority: string;
  source?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowDefinitionSummary {
  id: string;
  projectId: string;
  key: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowRun {
  id: string;
  projectId: string;
  workflowVersionId: string;
  workItemId: string;
  status: string;
  input: Record<string, unknown>;
  startedAt?: string;
  completedAt?: string;
  errorCode?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowTask {
  id: string;
  runId: string;
  nodeId: string;
  type: string;
  status: string;
  attempt: number;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

export interface AgentExecutionSummary {
  taskId: string;
  executionId: string;
  status: string;
  agentVersionId: string;
  role: string;
  promptReference?: string;
  output?: Record<string, unknown>;
  errorMessage?: string;
  contextManifest?: {
    sourceCount: number;
    sources: { type: string; ref: string }[];
  };
}

export interface ToolInvocationSummary {
  taskId: string;
  invocationId: string;
  capabilityKey: string;
  status: string;
  outputMetadata?: Record<string, unknown>;
  providerReference?: string;
  errorCode?: string;
  createdAt: string;
}

export interface Artifact {
  id: string;
  projectId: string;
  type: string;
  name: string;
  status: string;
  provenance: {
    workflowRunId?: string;
    workflowTaskId?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ArtifactVersion {
  id: string;
  artifactId: string;
  version: number;
  contentType: string;
  metadata?: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
}

export interface ReleaseReadiness {
  ready: boolean;
  reasons: string[];
  evidence: {
    testEvidence?: { artifactId: string; passed: boolean };
    reviewEvidence?: {
      artifactId: string;
      decision: string;
      findings: { severity: string; description?: string }[];
    };
  };
}

export type ApiResult<T> =
  | { ok: true; data: T; requestId: string }
  | { ok: false; error: ApiErrorResponse['error']; requestId: string };

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; authenticated?: boolean } = {},
): Promise<ApiResult<T>> {
  const { method = 'GET', body, authenticated = true } = options;

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(authenticated ? { authorization: `Bearer ${DEV_PRINCIPAL_ID}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Network request failed.';
    return { ok: false, error: { code: 'DEVOS_NETWORK_ERROR', message }, requestId: '' };
  }

  const responseBody = (await response.json()) as ApiResponse<T> | ApiErrorResponse;

  if (!response.ok || 'error' in responseBody) {
    const errorBody = responseBody as ApiErrorResponse;
    return { ok: false, error: errorBody.error, requestId: errorBody.meta.requestId };
  }

  return { ok: true, data: responseBody.data, requestId: responseBody.meta.requestId };
}

export function getHealth(): Promise<ApiResult<HealthStatus>> {
  return request<HealthStatus>('/api/v1/health', { authenticated: false });
}

export function listProjects(): Promise<ApiResult<Project[]>> {
  return request<Project[]>('/api/v1/projects');
}

export function createProject(input: {
  name: string;
  slug: string;
  description?: string;
  organisationId?: string;
  projectTypeId: string;
}): Promise<ApiResult<Project>> {
  return request<Project>('/api/v1/projects', { method: 'POST', body: input });
}

export function listProjectTypes(): Promise<ApiResult<ProjectType[]>> {
  return request<ProjectType[]>('/api/v1/project-types');
}

export function createProjectType(input: {
  key: string;
  name: string;
  description?: string;
}): Promise<ApiResult<ProjectType>> {
  return request<ProjectType>('/api/v1/project-types', { method: 'POST', body: input });
}

export function updateProjectType(
  projectTypeId: string,
  input: { name?: string; description?: string; status?: 'ACTIVE' | 'DISABLED' },
): Promise<ApiResult<ProjectType>> {
  return request<ProjectType>(`/api/v1/project-types/${projectTypeId}`, {
    method: 'PATCH',
    body: input,
  });
}

export function listProjectTypeWorkflows(
  projectTypeId: string,
): Promise<ApiResult<ProjectTypeWorkflow[]>> {
  return request<ProjectTypeWorkflow[]>(`/api/v1/project-types/${projectTypeId}/workflows`);
}

export function createProjectTypeWorkflow(
  projectTypeId: string,
  input: { key: string; name: string; definition: WorkflowGraph },
): Promise<ApiResult<ProjectTypeWorkflow>> {
  return request<ProjectTypeWorkflow>(`/api/v1/project-types/${projectTypeId}/workflows`, {
    method: 'POST',
    body: input,
  });
}

export function updateProjectTypeWorkflow(
  projectTypeId: string,
  key: string,
  input: { name?: string; definition?: WorkflowGraph },
): Promise<ApiResult<ProjectTypeWorkflow>> {
  return request<ProjectTypeWorkflow>(
    `/api/v1/project-types/${projectTypeId}/workflows/${key}`,
    { method: 'PATCH', body: input },
  );
}

export function listProjectTypeAgents(
  projectTypeId: string,
): Promise<ApiResult<ProjectTypeAgent[]>> {
  return request<ProjectTypeAgent[]>(`/api/v1/project-types/${projectTypeId}/agents`);
}

export function createProjectTypeAgent(
  projectTypeId: string,
  input: { key: string; name: string; configuration: AgentConfiguration; promptReference?: string },
): Promise<ApiResult<ProjectTypeAgent>> {
  return request<ProjectTypeAgent>(`/api/v1/project-types/${projectTypeId}/agents`, {
    method: 'POST',
    body: input,
  });
}

export function updateProjectTypeAgent(
  projectTypeId: string,
  key: string,
  input: { name?: string; configuration?: AgentConfiguration; promptReference?: string },
): Promise<ApiResult<ProjectTypeAgent>> {
  return request<ProjectTypeAgent>(`/api/v1/project-types/${projectTypeId}/agents/${key}`, {
    method: 'PATCH',
    body: input,
  });
}

export function listOrganisations(): Promise<ApiResult<Organisation[]>> {
  return request<Organisation[]>('/api/v1/organisations');
}

export function createOrganisation(input: {
  name: string;
  slug: string;
}): Promise<ApiResult<Organisation>> {
  return request<Organisation>('/api/v1/organisations', { method: 'POST', body: input });
}

export function getOrganisation(organisationId: string): Promise<ApiResult<Organisation>> {
  return request<Organisation>(`/api/v1/organisations/${organisationId}`);
}

export function updateOrganisation(
  organisationId: string,
  input: { name?: string; slug?: string },
): Promise<ApiResult<Organisation>> {
  return request<Organisation>(`/api/v1/organisations/${organisationId}`, {
    method: 'PATCH',
    body: input,
  });
}

export function listWorkItems(projectId: string): Promise<ApiResult<WorkItem[]>> {
  return request<WorkItem[]>(`/api/v1/projects/${projectId}/work-items`);
}

export function createWorkItem(
  projectId: string,
  input: { title: string; type?: string; priority?: string; description?: string },
): Promise<ApiResult<WorkItem>> {
  return request<WorkItem>(`/api/v1/projects/${projectId}/work-items`, {
    method: 'POST',
    body: input,
  });
}

export function listWorkflows(projectId: string): Promise<ApiResult<WorkflowDefinitionSummary[]>> {
  return request<WorkflowDefinitionSummary[]>(`/api/v1/projects/${projectId}/workflows`);
}

export function startRun(
  workflowId: string,
  input: { workItemId: string; inputs?: Record<string, unknown>; idempotencyKey: string },
): Promise<ApiResult<WorkflowRun>> {
  return request<WorkflowRun>(`/api/v1/workflows/${workflowId}/runs`, {
    method: 'POST',
    body: { inputs: {}, ...input },
  });
}

export function getRun(runId: string): Promise<ApiResult<WorkflowRun>> {
  return request<WorkflowRun>(`/api/v1/runs/${runId}`);
}

export function listRunTasks(runId: string): Promise<ApiResult<WorkflowTask[]>> {
  return request<WorkflowTask[]>(`/api/v1/runs/${runId}/tasks`);
}

/** DEVOS-080: every run a work item's change has gone through (planning,
 * development, release, ...), oldest first — closes the gap DEVOS-071
 * flagged ("no API exposes a work item's runs"). */
export function listWorkflowRunsForWorkItem(workItemId: string): Promise<ApiResult<WorkflowRun[]>> {
  return request<WorkflowRun[]>(`/api/v1/work-items/${workItemId}/workflow-runs`);
}

export function listArtifacts(projectId: string): Promise<ApiResult<Artifact[]>> {
  return request<Artifact[]>(`/api/v1/projects/${projectId}/artifacts`);
}

export function listAgentExecutionSummaries(
  runId: string,
): Promise<ApiResult<AgentExecutionSummary[]>> {
  return request<AgentExecutionSummary[]>(`/api/v1/runs/${runId}/agent-execution-summaries`);
}

export function listToolInvocationSummaries(
  runId: string,
): Promise<ApiResult<ToolInvocationSummary[]>> {
  return request<ToolInvocationSummary[]>(`/api/v1/runs/${runId}/tool-invocation-summaries`);
}

export function getArtifactVersion(
  artifactId: string,
  version: number,
): Promise<ApiResult<ArtifactVersion>> {
  return request<ArtifactVersion>(`/api/v1/artifacts/${artifactId}/versions/${version}`);
}

/** DEVOS-095: resolves a bare artifact-version id to its owning artifact's
 * name/type — what an approval's evidence reference actually carries. */
export interface ArtifactVersionWithArtifact extends ArtifactVersion {
  artifactName: string;
  artifactType: string;
}

export function getArtifactVersionById(
  artifactVersionId: string,
): Promise<ApiResult<ArtifactVersionWithArtifact>> {
  return request<ArtifactVersionWithArtifact>(`/api/v1/artifact-versions/${artifactVersionId}`);
}

export function getReleaseReadiness(projectId: string): Promise<ApiResult<ReleaseReadiness>> {
  return request<ReleaseReadiness>(`/api/v1/projects/${projectId}/release-readiness`);
}

export const RUN_TERMINAL_STATUSES = new Set(['COMPLETED', 'FAILED', 'CANCELLED']);

export interface Approval {
  id: string;
  projectId: string;
  workflowRunId: string;
  approvalType: string;
  status: string;
  requestedBy: string;
  decidedBy?: string;
  decisionReason?: string;
  evidenceReference: {
    artifactVersionIds: string[];
    scopeHash: string;
  };
  requestedAt: string;
  decidedAt?: string;
}

export function listApprovalsForProject(projectId: string): Promise<ApiResult<Approval[]>> {
  return request<Approval[]>(`/api/v1/projects/${projectId}/approvals`);
}

export function approveApproval(
  approvalId: string,
  input: { scopeHash: string; comment?: string },
): Promise<ApiResult<Approval>> {
  return request<Approval>(`/api/v1/approvals/${approvalId}/approve`, {
    method: 'POST',
    body: input,
  });
}

export function rejectApproval(
  approvalId: string,
  input: { scopeHash: string; comment?: string },
): Promise<ApiResult<Approval>> {
  return request<Approval>(`/api/v1/approvals/${approvalId}/reject`, {
    method: 'POST',
    body: input,
  });
}

/** DEVOS-090: for the governance dashboard's "Policies" section. */
export interface Policy {
  id: string;
  organisationId: string;
  projectId: string;
  key: string;
  version: number;
  status: string;
  definition: Record<string, unknown>;
  createdBy: string;
  publishedAt?: string;
  createdAt: string;
}

export function listPoliciesForProject(projectId: string): Promise<ApiResult<Policy[]>> {
  return request<Policy[]>(`/api/v1/projects/${projectId}/policies`);
}

/** DEVOS-090: for the governance dashboard's "Risk activity" section — a
 * REJECTED/FAILED-outcome audit record is exactly a denied or failed
 * security-significant action (policy denial, capability denial, a failed
 * tool invocation), the same real signal invoke-tool.ts's own audit calls
 * already produce. No separate "denied invocations" endpoint exists or is
 * needed — the audit trail already carries this. */
export interface AuditRecord {
  id: string;
  organisationId: string;
  projectId?: string;
  actorType: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  outcome: string;
  metadata?: Record<string, unknown>;
  correlationId?: string;
  createdAt: string;
}

export function listAuditRecordsForProject(projectId: string): Promise<ApiResult<AuditRecord[]>> {
  return request<AuditRecord[]>(`/api/v1/projects/${projectId}/audit`);
}
