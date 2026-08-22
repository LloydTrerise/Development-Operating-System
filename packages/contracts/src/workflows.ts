import type {
  ProjectId,
  WorkflowId,
  WorkflowRunId,
  WorkflowTaskId,
  WorkflowVersionId,
  WorkItemId,
} from './ids.js';
import type {
  WorkflowNodeType,
  WorkflowRunStatus,
  WorkflowTaskStatus,
  WorkflowVersionStatus,
} from './status.js';

export interface WorkflowInputDefinition {
  name: string;
  type: string;
  required: boolean;
}

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  name?: string;
  config?: Record<string, unknown>;
  inputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  policyRefs?: string[];
  retryPolicy?: Record<string, unknown>;
  timeoutSeconds?: number;
  agentRef?: string;
  approvalType?: string;
}

export interface WorkflowEdge {
  from: string;
  to: string;
}

export interface WorkflowDefinition {
  name: string;
  description?: string;
  trigger: Record<string, unknown>;
  inputs: WorkflowInputDefinition[];
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  policies: string[];
  outputs: unknown[];
}

export interface Workflow {
  id: WorkflowId;
  projectId: ProjectId;
  name: string;
  description?: string;
  status: string;
}

export interface WorkflowVersion {
  id: WorkflowVersionId;
  workflowId: WorkflowId;
  version: number;
  definition: WorkflowDefinition;
  hash: string;
  publishedAt?: string;
  status: WorkflowVersionStatus;
}

export interface WorkflowRun {
  id: WorkflowRunId;
  projectId: ProjectId;
  workflowVersionId: WorkflowVersionId;
  workItemId: WorkItemId;
  status: WorkflowRunStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  updatedAt: string;
}

export interface WorkflowTask {
  id: WorkflowTaskId;
  runId: WorkflowRunId;
  nodeId: string;
  type: WorkflowNodeType;
  status: WorkflowTaskStatus;
  attempts: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  updatedAt: string;
}

export interface StartWorkflowRunRequest {
  workItemId: WorkItemId;
  inputs: Record<string, unknown>;
  idempotencyKey: string;
}
