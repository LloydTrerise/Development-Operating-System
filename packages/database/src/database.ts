export interface OrganisationsTable {
  id: string;
  name: string;
  slug: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectsTable {
  id: string;
  organisation_id: string;
  project_type_id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  repository_id: string | null;
  budget_usd: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectTypesTable {
  id: string;
  key: string;
  name: string;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectTypeWorkflowsTable {
  id: string;
  project_type_id: string;
  key: string;
  name: string;
  definition: unknown;
  created_at: string;
  updated_at: string;
}

export interface ProjectTypeAgentsTable {
  id: string;
  project_type_id: string;
  key: string;
  name: string;
  configuration: unknown;
  prompt_reference: string | null;
  created_at: string;
  updated_at: string;
}

export interface MembershipsTable {
  id: string;
  organisation_id: string;
  project_id: string | null;
  principal_id: string;
  role: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface WorkItemsTable {
  id: string;
  project_id: string;
  external_key: string | null;
  title: string;
  description: string;
  type: string;
  status: string;
  priority: string;
  source_system: string | null;
  source_url: string | null;
  metadata: unknown | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface AgentsTable {
  id: string;
  project_id: string;
  key: string;
  name: string;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface AgentVersionsTable {
  id: string;
  agent_id: string;
  version: number;
  status: string;
  configuration: unknown;
  prompt_reference: string | null;
  created_by: string;
  published_at: string | null;
  created_at: string;
}

export interface AgentExecutionsTable {
  id: string;
  workflow_task_id: string;
  agent_version_id: string;
  status: string;
  input: unknown;
  output: unknown | null;
  uncertainty: unknown | null;
  model_reference: string | null;
  usage_metadata: unknown | null;
  estimated_cost_usd: string | null;
  started_at: string | null;
  completed_at: string | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
}

export interface ContextManifestsTable {
  id: string;
  project_id: string;
  workflow_task_id: string;
  agent_execution_id: string;
  version: number;
  manifest: unknown;
  created_at: string;
}

export interface WorkflowDefinitionsTable {
  id: string;
  project_id: string;
  key: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkflowVersionsTable {
  id: string;
  workflow_definition_id: string;
  version: number;
  status: string;
  definition: unknown;
  published_at: string | null;
  created_by: string;
  created_at: string;
}

export interface WorkflowRunsTable {
  id: string;
  project_id: string;
  workflow_version_id: string;
  work_item_id: string;
  status: string;
  input: unknown;
  started_at: string | null;
  completed_at: string | null;
  error_code: string | null;
  error_message: string | null;
  idempotency_key: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkflowTasksTable {
  id: string;
  workflow_run_id: string;
  task_key: string;
  task_type: string;
  status: string;
  attempt: number;
  input: unknown;
  output: unknown | null;
  error_code: string | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ArtifactsTable {
  id: string;
  project_id: string;
  artifact_type: string;
  name: string;
  status: string;
  workflow_run_id: string | null;
  workflow_task_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ArtifactVersionsTable {
  id: string;
  artifact_id: string;
  version: number;
  content_type: string;
  content_uri: string;
  content_hash: string;
  metadata: unknown | null;
  created_by: string;
  created_at: string;
}

export interface OutboxEventsTable {
  id: string;
  organisation_id: string;
  project_id: string | null;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  payload: unknown;
  created_at: string;
  published_at: string | null;
  attempts: number;
  last_error: string | null;
}

export interface AuditRecordsTable {
  id: string;
  organisation_id: string;
  project_id: string | null;
  actor_type: string;
  actor_id: string;
  action: string;
  target_type: string;
  target_id: string;
  outcome: string;
  metadata: unknown | null;
  correlation_id: string | null;
  created_at: string;
}

export interface KnowledgeSourcesTable {
  id: string;
  project_id: string;
  key: string;
  name: string;
  source_type: string;
  content: string;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeReferencesTable {
  id: string;
  project_id: string;
  knowledge_source_id: string;
  workflow_task_id: string;
  agent_execution_id: string | null;
  created_at: string;
}

export interface PoliciesTable {
  id: string;
  organisation_id: string;
  project_id: string | null;
  key: string;
  version: number;
  status: string;
  definition: unknown;
  created_by: string;
  published_at: string | null;
  created_at: string;
}

export interface ApprovalsTable {
  id: string;
  project_id: string;
  workflow_run_id: string;
  approval_type: string;
  status: string;
  requested_by: string;
  decided_by: string | null;
  decision_reason: string | null;
  evidence_reference: unknown;
  requested_at: string;
  decided_at: string | null;
}

export interface ToolCapabilitiesTable {
  id: string;
  project_id: string;
  key: string;
  name: string;
  risk_class: string;
  input_schema: unknown;
  output_schema: unknown;
  status: string;
  created_at: string;
}

export interface ToolInvocationsTable {
  id: string;
  workflow_task_id: string;
  tool_capability_id: string;
  status: string;
  input_metadata: unknown;
  output_metadata: unknown | null;
  provider_reference: string | null;
  idempotency_key: string | null;
  started_at: string | null;
  completed_at: string | null;
  error_code: string | null;
  created_at: string;
}

export interface IntegrationsTable {
  id: string;
  project_id: string;
  type: string;
  provider: string;
  name: string;
  status: string;
  configuration: unknown;
  created_at: string;
  updated_at: string;
}

export interface Database {
  organisations: OrganisationsTable;
  projects: ProjectsTable;
  project_types: ProjectTypesTable;
  project_type_workflows: ProjectTypeWorkflowsTable;
  project_type_agents: ProjectTypeAgentsTable;
  memberships: MembershipsTable;
  work_items: WorkItemsTable;
  agents: AgentsTable;
  agent_versions: AgentVersionsTable;
  agent_executions: AgentExecutionsTable;
  context_manifests: ContextManifestsTable;
  workflow_definitions: WorkflowDefinitionsTable;
  workflow_versions: WorkflowVersionsTable;
  workflow_runs: WorkflowRunsTable;
  workflow_tasks: WorkflowTasksTable;
  artifacts: ArtifactsTable;
  artifact_versions: ArtifactVersionsTable;
  outbox_events: OutboxEventsTable;
  audit_records: AuditRecordsTable;
  knowledge_sources: KnowledgeSourcesTable;
  knowledge_references: KnowledgeReferencesTable;
  policies: PoliciesTable;
  approvals: ApprovalsTable;
  tool_capabilities: ToolCapabilitiesTable;
  tool_invocations: ToolInvocationsTable;
  integrations: IntegrationsTable;
}
