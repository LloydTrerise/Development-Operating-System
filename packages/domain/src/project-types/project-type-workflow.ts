import type { ProjectTypeId, ProjectTypeWorkflowId } from '@devos/contracts';
import type { WorkflowDefinition as WorkflowGraph } from '@devos/contracts';

export interface ProjectTypeWorkflow {
  id: ProjectTypeWorkflowId;
  projectTypeId: ProjectTypeId;
  key: string;
  name: string;
  definition: WorkflowGraph;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectTypeWorkflowInput {
  key: string;
  name: string;
  definition: WorkflowGraph;
}

export interface UpdateProjectTypeWorkflowInput {
  name?: string;
  definition?: WorkflowGraph;
}

export interface ProjectTypeWorkflowRepository {
  getById: (id: ProjectTypeWorkflowId) => Promise<ProjectTypeWorkflow | null>;
  getByProjectTypeAndKey: (
    projectTypeId: ProjectTypeId,
    key: string,
  ) => Promise<ProjectTypeWorkflow | null>;
  listForProjectType: (projectTypeId: ProjectTypeId) => Promise<ProjectTypeWorkflow[]>;
  create: (workflow: ProjectTypeWorkflow) => Promise<void>;
  update: (
    id: ProjectTypeWorkflowId,
    changes: UpdateProjectTypeWorkflowInput,
    updatedAt: string,
  ) => Promise<void>;
}
