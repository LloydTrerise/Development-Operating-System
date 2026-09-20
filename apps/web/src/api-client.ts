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

/**
 * DEVOS-107: `session.tsx`'s `SessionProvider` registers a real getter here
 * (backed by Auth0's `getAccessTokenSilently`) once a real user is
 * authenticated through a real Auth0 tenant — every `request()` call below
 * then attaches that real access token instead of the dev principal. `null`
 * (the default, and what every existing test exercises) preserves the
 * original dev-identity-as-bearer-token behaviour exactly.
 */
let accessTokenGetter: (() => Promise<string>) | null = null;

export function setAccessTokenGetter(getter: (() => Promise<string>) | null): void {
  accessTokenGetter = getter;
}

async function resolveAuthorizationHeader(): Promise<string> {
  if (accessTokenGetter) return `Bearer ${await accessTokenGetter()}`;
  return `Bearer ${DEV_PRINCIPAL_ID}`;
}

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
  /** `| undefined` (not just `?`) so the inspector's mode toggle (DEVOS-160)
   * can explicitly clear this field when switching to role/capability
   * targeting, distinguished from "omitted" under exactOptionalPropertyTypes. */
  agentRef?: string | undefined;
  /** Mirrors @devos/contracts' WorkflowNode.requiredRole/requiredCapabilities
   * (DEVOS-158) — an alternative to agentRef for AGENT_TASK nodes, resolved
   * by a real capability-based selection algorithm (DEVOS-159) instead of a
   * single literal agent key. Also `| undefined` for the same reason as
   * agentRef above. */
  requiredRole?: string | undefined;
  requiredCapabilities?: string[] | undefined;
  /** Mirrors @devos/contracts' WorkflowNode.config — the generic per-node
   * extension point CONDITION/JOIN/WAIT/APPROVAL's real config lives in
   * (DEVOS-130), and where the canvas stores a node's own on-screen
   * position (DEVOS-128's `canvasPosition`, additive and purely visual). */
  config?: Record<string, unknown>;
}

export interface WorkflowEdge {
  from: string;
  to: string;
  /** Mirrors @devos/contracts' WorkflowEdge.branch (DEVOS-119) — which
   * outgoing edge of a CONDITION node this represents. */
  branch?: string;
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
  /** DEVOS-135: only present on the project-list route (`toWorkflowDefinitionSummaryDto`) —
   * absent on the single-definition GET, which still uses the plain `toWorkflowDefinitionDto`. */
  latestVersionStatus?: string | null;
  versionCount?: number;
}

/** Mirrors `apps/api/src/dto/workflow.ts`'s `toWorkflowVersionDto` — a real
 * project's own `WorkflowVersion` (draft/published), as opposed to
 * `ProjectTypeWorkflow` (a template, no version concept at all). */
export interface WorkflowVersionDto {
  id: string;
  workflowId: string;
  version: number;
  status: string;
  definition: WorkflowGraph;
  publishedAt?: string;
  createdBy: string;
  createdAt: string;
}

/** Mirrors `apps/api/src/dto/agent.ts`'s `toAgentDto` — a real project's own
 * published `Agent` (as opposed to `ProjectTypeAgent`, a template). */
export interface Agent {
  id: string;
  projectId: string;
  key: string;
  name: string;
  description?: string;
  status: string;
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
    // DEVOS-113: real security/static-analysis scan evidence, checked the
    // same way testEvidence already is.
    securityScanEvidence?: { artifactId: string; passed: boolean };
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
        ...(authenticated ? { authorization: await resolveAuthorizationHeader() } : {}),
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
  return request<ProjectTypeWorkflow>(`/api/v1/project-types/${projectTypeId}/workflows/${key}`, {
    method: 'PATCH',
    body: input,
  });
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

/** DEVOS-135: the real `createWorkflowDefinition` use case had no client
 * wrapper anywhere — every existing `WorkflowDefinition` reaches a project
 * only via the project-type clone pipeline at project-creation time. The
 * library page's "clone into new draft" action is the first UI-driven
 * caller, so this wraps the existing, unmodified API exactly as it stands. */
export function createWorkflow(
  projectId: string,
  input: { key: string; name: string; description?: string; definition: WorkflowGraph },
): Promise<ApiResult<WorkflowDefinitionSummary & { version: WorkflowVersionDto }>> {
  return request<WorkflowDefinitionSummary & { version: WorkflowVersionDto }>(
    `/api/v1/projects/${projectId}/workflows`,
    { method: 'POST', body: input },
  );
}

/**
 * DEVOS-136 (Sprint 14): the real per-project `WorkflowVersion` draft →
 * validate → publish lifecycle already existed server-side
 * (`apps/api/src/routes/workflows.ts`) with zero client function calling it
 * — `specs/architecture/organisations-and-project-types.md` §2's own
 * confirmed gap. These wrap that real, unmodified API exactly the way
 * `createProjectTypeWorkflow`/`updateProjectTypeWorkflow` already wrap the
 * template one.
 */
export function getWorkflowDefinition(
  workflowId: string,
): Promise<ApiResult<WorkflowDefinitionSummary>> {
  return request<WorkflowDefinitionSummary>(`/api/v1/workflows/${workflowId}`);
}

export function listWorkflowVersions(workflowId: string): Promise<ApiResult<WorkflowVersionDto[]>> {
  return request<WorkflowVersionDto[]>(`/api/v1/workflows/${workflowId}/versions`);
}

/** DEVOS-135: a workflow definition's own real run-health summary — every
 * run across every one of its versions, powering the library page's
 * "N succeeded / M failed" count via `RUN_TERMINAL_STATUSES` client-side. */
export function listWorkflowRunsForDefinition(
  workflowId: string,
): Promise<ApiResult<WorkflowRun[]>> {
  return request<WorkflowRun[]>(`/api/v1/workflows/${workflowId}/runs`);
}

export function getWorkflowVersionByNumber(
  workflowId: string,
  version: number,
): Promise<ApiResult<WorkflowVersionDto>> {
  return request<WorkflowVersionDto>(`/api/v1/workflows/${workflowId}/versions/${version}`);
}

/** Creates the next draft version of an already-published workflow — the
 * new primitive this sprint added (`createNewWorkflowVersion`), mirroring
 * `Policy`'s own already-proven "revise by drafting a new version" pattern. */
export function createWorkflowVersionDraft(
  workflowId: string,
): Promise<ApiResult<WorkflowVersionDto>> {
  return request<WorkflowVersionDto>(`/api/v1/workflows/${workflowId}/versions`, {
    method: 'POST',
  });
}

export function updateDraftWorkflow(
  workflowId: string,
  graph: WorkflowGraph,
): Promise<ApiResult<WorkflowVersionDto>> {
  return request<WorkflowVersionDto>(`/api/v1/workflows/${workflowId}`, {
    method: 'PATCH',
    body: graph,
  });
}

export function validateDraftWorkflow(
  workflowId: string,
): Promise<ApiResult<{ valid: boolean; issues: { field: string; message: string }[] }>> {
  return request(`/api/v1/workflows/${workflowId}/validate`, { method: 'POST' });
}

export function publishWorkflowVersion(workflowId: string): Promise<ApiResult<WorkflowVersionDto>> {
  return request<WorkflowVersionDto>(`/api/v1/workflows/${workflowId}/publish`, {
    method: 'POST',
  });
}

/** A real project's own published `Agent` list (as opposed to
 * `listProjectTypeAgents`, which lists a *type's* templates) — populates a
 * real project's own `AGENT_TASK` nodes' `agentRef` from its real agents. */
export function listAgents(projectId: string): Promise<ApiResult<Agent[]>> {
  return request<Agent[]>(`/api/v1/projects/${projectId}/agents`);
}

/** DEVOS-172: mirrors `apps/api/src/dto/agent.ts`'s `toAgentVersionDto` —
 * a real agent's own draft/published version, as opposed to
 * `ProjectTypeAgent` (a template, no version concept at all). */
export interface AgentVersion {
  id: string;
  agentId: string;
  version: number;
  status: string;
  configuration: AgentConfiguration;
  promptReference?: string;
  createdBy: string;
  publishedAt?: string;
  createdAt: string;
}

/** DEVOS-173: the first real create path for a per-project (non-template) agent. */
export function createAgent(
  projectId: string,
  input: {
    key: string;
    name: string;
    description?: string;
    configuration: AgentConfiguration;
    promptReference?: string;
  },
): Promise<ApiResult<Agent & { version: AgentVersion }>> {
  return request<Agent & { version: AgentVersion }>(`/api/v1/projects/${projectId}/agents`, {
    method: 'POST',
    body: input,
  });
}

/** DEVOS-173: a real agent's real version history. */
export function listAgentVersions(agentId: string): Promise<ApiResult<AgentVersion[]>> {
  return request<AgentVersion[]>(`/api/v1/agents/${agentId}/versions`);
}

/** DEVOS-172: drafts a real new version, copying the latest published `configuration` verbatim. */
export function createNewAgentVersion(agentId: string): Promise<ApiResult<AgentVersion>> {
  return request<AgentVersion>(`/api/v1/agents/${agentId}/versions`, { method: 'POST' });
}

/** Publishes an agent's current draft version — real, single-step, OWNER-gated (unchanged). */
export function publishAgentVersion(agentId: string): Promise<ApiResult<AgentVersion>> {
  return request<AgentVersion>(`/api/v1/agents/${agentId}/publish`, { method: 'POST' });
}

/** DEVOS-174: a real per-agent-version review pass rate — labelled honestly, never a general "quality score." */
export interface AgentVersionQuality {
  agentVersionId: string;
  reviewCount: number;
  passCount: number;
  passRate: number;
}

export function getAgentQuality(agentId: string): Promise<ApiResult<AgentVersionQuality[]>> {
  return request<AgentVersionQuality[]>(`/api/v1/agents/${agentId}/quality`);
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

/** DEVOS-090: for the governance dashboard's "Policies" section. DEVOS-139:
 * `projectId` is now optional — absent for an organisation-scoped policy. */
export interface Policy {
  id: string;
  organisationId: string;
  projectId?: string;
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

export interface CreatePolicyInput {
  key: string;
  definition: Record<string, unknown>;
}

export function createPolicy(
  projectId: string,
  input: CreatePolicyInput,
): Promise<ApiResult<Policy>> {
  return request<Policy>(`/api/v1/projects/${projectId}/policies`, {
    method: 'POST',
    body: input,
  });
}

/** DEVOS-139: the organisation-scoped mirror of `listPoliciesForProject`/`createPolicy`. */
export function listPoliciesForOrganisation(organisationId: string): Promise<ApiResult<Policy[]>> {
  return request<Policy[]>(`/api/v1/organisations/${organisationId}/policies`);
}

export function createOrganisationPolicy(
  organisationId: string,
  input: CreatePolicyInput,
): Promise<ApiResult<Policy>> {
  return request<Policy>(`/api/v1/organisations/${organisationId}/policies`, {
    method: 'POST',
    body: input,
  });
}

export function publishPolicy(policyId: string): Promise<ApiResult<Policy>> {
  return request<Policy>(`/api/v1/policies/${policyId}/publish`, { method: 'POST' });
}

/** DEVOS-141: what a draft policy would have decided against real recent
 * historical activity, before it is published. */
export interface SimulatedPolicyDecision {
  auditRecordId: string;
  action: string;
  actualOutcome: string;
  decision: {
    decision: string;
    reason: string;
    matchedPolicyId?: string;
    matchedPolicyKey?: string;
  };
}

export function simulatePolicy(policyId: string): Promise<ApiResult<SimulatedPolicyDecision[]>> {
  return request<SimulatedPolicyDecision[]>(`/api/v1/policies/${policyId}/simulate`);
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

/** DEVOS-147: the organisation-scoped mirror — a real cross-project
 * aggregate, already correctly tenant-isolated server-side. */
export function listAuditRecordsForOrganisation(
  organisationId: string,
): Promise<ApiResult<AuditRecord[]>> {
  return request<AuditRecord[]>(`/api/v1/organisations/${organisationId}/audit`);
}

/** DEVOS-150/151: one grouping row from a cost-breakdown query — the group
 * key is an agent role today; Sprint 18's DEVOS-156 adds workflow/work-item
 * grouping dimensions to the same shape. */
export interface CostBreakdownRow {
  key: string;
  totalUsd: number;
}

export interface ProjectCostSummary {
  projectId: string;
  totalUsd: number;
  budgetUsd?: number;
  breakdownByRole: CostBreakdownRow[];
  /** DEVOS-156: attribution by which workflow definition caused the spend. */
  breakdownByWorkflow: CostBreakdownRow[];
  /** DEVOS-156: attribution by which work item caused the spend. */
  breakdownByWorkItem: CostBreakdownRow[];
}

export interface OrganisationCostReport {
  organisationId: string;
  totalUsd: number;
  budgetUsd?: number;
  projectCount: number;
  breakdownByRole: CostBreakdownRow[];
  breakdownByWorkflow: CostBreakdownRow[];
  breakdownByWorkItem: CostBreakdownRow[];
}

/** DEVOS-151: real cost data for one project — DEVOS-098's `budgetUsd` plus
 * DEVOS-150's new per-role breakdown, both previously unreachable from any
 * client. */
export function getProjectCostSummary(projectId: string): Promise<ApiResult<ProjectCostSummary>> {
  return request<ProjectCostSummary>(`/api/v1/projects/${projectId}/cost`);
}

/** DEVOS-151: the organisation-scoped mirror — a real cross-project cost
 * rollup, already correctly tenant-isolated server-side. */
export function getOrganisationCostReport(
  organisationId: string,
): Promise<ApiResult<OrganisationCostReport>> {
  return request<OrganisationCostReport>(`/api/v1/organisations/${organisationId}/cost-report`);
}

/** DEVOS-164: real, pre-aggregated review/test/security-scan/release pass
 * rates and counts, plus a real rework-cycle count — the same shape at
 * project and organisation scope (organisation scope always reports
 * `reworkCycleCount: 0`, a real, disclosed limitation, not a silently
 * wrong number — see `getOrganisationEngineeringReport`'s own doc comment). */
/** DEVOS-167: deployment frequency / change failure rate over the report's own period. */
export interface DoraReleaseMetrics {
  deploymentCount: number;
  deploymentsPerDay: number;
  changeFailureCount: number;
  changeFailureRate: number;
}

/** DEVOS-168: real lead-time-for-changes distribution (`0`s, not `NaN`, when no sample was matched). */
export interface LeadTimeSummary {
  sampleCount: number;
  leadTimeMsP50: number;
  leadTimeMsMean: number;
}

/** DEVOS-169: a disclosed time-to-restore proxy — never a true MTTR (no real incident-detection timestamp exists anywhere in this codebase); `label` is shown verbatim, never dropped. */
export interface RecoveryProxySummary {
  sampleCount: number;
  meanMs: number;
  label: string;
}

export interface QualityReport {
  reviewCount: number;
  reviewPassCount: number;
  reviewPassRate: number;
  testCount: number;
  testPassCount: number;
  testPassRate: number;
  securityScanCount: number;
  securityScanPassCount: number;
  securityScanPassRate: number;
  deployCount: number;
  rollbackCount: number;
  reworkCycleCount: number;
  dora: DoraReleaseMetrics;
  leadTime: LeadTimeSummary;
  releaseRecoveryProxy: RecoveryProxySummary;
}

export interface ProjectEngineeringReport extends QualityReport {
  projectId: string;
  /** DEVOS-169: present only for a project whose ProjectType is the seeded Incident Response type. */
  incidentRecoveryProxy?: RecoveryProxySummary;
}

export interface OrganisationEngineeringReport extends QualityReport {
  organisationId: string;
  projectCount: number;
}

/** DEVOS-170/171: one row of the worker's own live slowest-workflows ranking, proxied through `apps/api` (see `apps/api/src/routes/engineering-intelligence.ts`'s own doc comment for the real, disclosed cross-process/no-per-project-filtering limitation). */
export interface SlowestWorkflowRow {
  workflowVersionId: string;
  workflowDefinitionName: string;
  meanDurationMs: number;
  taskCount: number;
}

/** DEVOS-164: real engineering-intelligence data for one project —
 * previously unreachable from any client (the same "captured but no
 * reporting surface" gap DEVOS-151 closed for cost data). */
export function getProjectEngineeringReport(
  projectId: string,
): Promise<ApiResult<ProjectEngineeringReport>> {
  return request<ProjectEngineeringReport>(`/api/v1/projects/${projectId}/engineering-report`);
}

/** DEVOS-164: the organisation-scoped mirror — a real cross-project
 * evidence rollup, already correctly tenant-isolated server-side. */
export function getOrganisationEngineeringReport(
  organisationId: string,
): Promise<ApiResult<OrganisationEngineeringReport>> {
  return request<OrganisationEngineeringReport>(
    `/api/v1/organisations/${organisationId}/engineering-report`,
  );
}

/** DEVOS-171: the real, worker-sourced bottleneck ranking, proxied via `apps/api`. Returns an empty array (not an error) when the worker's metrics bridge isn't configured. */
export function getSlowestWorkflows(projectId: string): Promise<ApiResult<SlowestWorkflowRow[]>> {
  return request<SlowestWorkflowRow[]>(`/api/v1/projects/${projectId}/slowest-workflows`);
}
