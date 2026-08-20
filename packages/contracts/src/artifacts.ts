import type {
  ArtifactId,
  ArtifactVersionId,
  ProjectId,
  WorkItemId,
  WorkflowRunId,
  WorkflowTaskId,
} from "./ids.js";
import type { ArtifactStatus } from "./status.js";

export interface Artifact {
  id: ArtifactId;
  projectId: ProjectId;
  type: string;
  name: string;
  status: ArtifactStatus;
}

export interface ArtifactProvenance {
  origin: "HUMAN" | "AGENT" | "INTEGRATION" | "SYSTEM";
  workflow?: {
    workflowId?: string;
    workflowVersionId?: string;
    workflowRunId?: WorkflowRunId;
  };
  agent?: {
    agentId?: string;
    version?: string;
  };
  contextManifestId?: string;
  sourceRefs?: string[];
}

export interface ArtifactVersion {
  id: ArtifactVersionId;
  artifactId: ArtifactId;
  version: number;
  contentRef: string;
  hash: string;
  provenance: ArtifactProvenance;
  projectId?: ProjectId;
  workItemId?: WorkItemId;
  workflowRunId?: WorkflowRunId;
  workflowTaskId?: WorkflowTaskId;
}
