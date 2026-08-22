import type { ProjectId, WorkflowId } from '@devos/contracts';

export interface WorkflowDefinition {
  id: WorkflowId;
  projectId: ProjectId;
  key: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowDefinitionRepository {
  getById: (id: WorkflowId) => Promise<WorkflowDefinition | null>;
  getByProjectAndKey: (projectId: ProjectId, key: string) => Promise<WorkflowDefinition | null>;
  listForProject: (projectId: ProjectId) => Promise<WorkflowDefinition[]>;
  create: (definition: WorkflowDefinition) => Promise<void>;
}
