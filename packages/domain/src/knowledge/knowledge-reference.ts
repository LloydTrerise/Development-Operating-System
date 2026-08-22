import type {
  AgentExecutionId,
  KnowledgeReferenceId,
  KnowledgeSourceId,
  ProjectId,
  WorkflowTaskId,
} from '@devos/contracts';

/**
 * The relationship between a workflow task/agent execution and a knowledge
 * source it intentionally used (specs/architecture/domain-model.md §8.3),
 * supporting traceability, reproducibility, context inspection, and access
 * control. Modeled now (DEVOS-039); actually recorded once the context
 * builder (DEVOS-041) selects sources for an execution — not fabricated
 * ahead of that real usage.
 */
export interface KnowledgeReference {
  id: KnowledgeReferenceId;
  projectId: ProjectId;
  knowledgeSourceId: KnowledgeSourceId;
  workflowTaskId: WorkflowTaskId;
  agentExecutionId?: AgentExecutionId;
  createdAt: string;
}

export interface KnowledgeReferenceRepository {
  listForTask: (workflowTaskId: WorkflowTaskId) => Promise<KnowledgeReference[]>;
  create: (reference: KnowledgeReference) => Promise<void>;
}
