import type {
  ArtifactId,
  ArtifactStatus,
  ProjectId,
  WorkflowRunId,
  WorkflowTaskId,
} from '@devos/contracts';

export interface Artifact {
  id: ArtifactId;
  projectId: ProjectId;
  artifactType: string;
  name: string;
  status: ArtifactStatus;
  workflowRunId?: WorkflowRunId;
  workflowTaskId?: WorkflowTaskId;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ArtifactRepository {
  getById: (id: ArtifactId) => Promise<Artifact | null>;
  listForProject: (projectId: ProjectId) => Promise<Artifact[]>;
  create: (artifact: Artifact) => Promise<void>;
}
