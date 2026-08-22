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

export interface Project {
  id: string;
  organisationId: string;
  name: string;
  slug: string;
  description?: string;
  status: string;
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
}): Promise<ApiResult<Project>> {
  return request<Project>('/api/v1/projects', { method: 'POST', body: input });
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

export function listArtifacts(projectId: string): Promise<ApiResult<Artifact[]>> {
  return request<Artifact[]>(`/api/v1/projects/${projectId}/artifacts`);
}

export function listAgentExecutionSummaries(
  runId: string,
): Promise<ApiResult<AgentExecutionSummary[]>> {
  return request<AgentExecutionSummary[]>(`/api/v1/runs/${runId}/agent-execution-summaries`);
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
