import type {
  AgentExecutionId,
  AgentId,
  AgentVersionId,
  ProjectId,
  WorkflowTaskId,
} from './ids.js';
import type { AgentExecutionStatus, AgentVersionStatus } from './status.js';

/**
 * The versioned behavioural content of an agent — role, provider, model,
 * schemas, and permitted capabilities. Mirrors WorkflowDefinition's role in
 * workflows.ts (the graph shape carried by a WorkflowVersion): this is the
 * shape carried by an AgentVersion's `configuration` column.
 *
 * Source of truth: specs/api/poc-api-contracts.md §21 "Agent Definition
 * Contract". `role`/`provider`/`modelRef` are left as opaque strings, not
 * enums — no spec enumerates a closed set of values for any of them.
 */
export interface AgentConfiguration {
  role: string;
  provider: string;
  modelRef: string;
  inputSchemaRef?: string;
  outputSchemaRef?: string;
  allowedCapabilities: string[];
}

export interface Agent {
  id: AgentId;
  projectId: ProjectId;
  key: string;
  name: string;
  description?: string;
  status: string;
}

export interface AgentVersion {
  id: AgentVersionId;
  agentId: AgentId;
  version: number;
  status: AgentVersionStatus;
  configuration: AgentConfiguration;
  promptReference?: string;
  publishedAt?: string;
}

/**
 * Source of truth: specs/api/poc-api-contracts.md §23 "Agent Result
 * Contract" — an agent must be able to state that required information is
 * unavailable rather than inventing a value; uncertainty is how.
 */
export interface AgentUncertainty {
  statement: string;
  severity: string;
}

export interface AgentExecution {
  id: AgentExecutionId;
  workflowTaskId: WorkflowTaskId;
  agentVersionId: AgentVersionId;
  status: AgentExecutionStatus;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  uncertainty?: AgentUncertainty[];
  modelReference?: string;
  startedAt?: string;
  completedAt?: string;
  errorCode?: string;
  errorMessage?: string;
  createdAt: string;
}
