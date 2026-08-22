import type {
  AgentExecutionRepository,
  AgentRepository,
  AgentVersionRepository,
  Artifact,
  ArtifactRepository,
  ArtifactVersion,
  ArtifactVersionRepository,
  ContextManifest,
  WorkflowRunRepository,
  WorkItemRepository,
} from '@devos/domain';
import type { AgentModelAdapter, PromptRepository, SchemaRepository } from '@devos/agents';
import type { ArtifactStorage } from '@devos/storage';

export type PublishArtifact = (artifact: Artifact, version: ArtifactVersion) => Promise<void>;
export type RecordContextManifest = (manifest: ContextManifest) => Promise<void>;

export interface TaskHandlerDeps {
  workflowRuns: WorkflowRunRepository;
  workItems: WorkItemRepository;
  storage: ArtifactStorage;
  publishArtifact: PublishArtifact;
}

export interface AgentTaskHandlerDeps {
  workflowRuns: WorkflowRunRepository;
  workItems: WorkItemRepository;
  agents: AgentRepository;
  agentVersions: AgentVersionRepository;
  agentExecutions: AgentExecutionRepository;
  modelAdapter: AgentModelAdapter;
  prompts: PromptRepository;
  schemas: SchemaRepository;
  recordContextManifest: RecordContextManifest;
}

/**
 * runAgentTask's generic dependencies plus what's needed to publish the
 * agent's structured output as an artifact — the shape every concrete agent
 * task handler (DEVOS-031's discovery agent, and DEVOS-032–034's later
 * stages) needs, mirroring TaskHandlerDeps's storage/publishArtifact pair.
 */
export interface AgentArtifactTaskHandlerDeps extends AgentTaskHandlerDeps {
  storage: ArtifactStorage;
  publishArtifact: PublishArtifact;
}

/**
 * AgentArtifactTaskHandlerDeps plus what's needed to look up a prior stage's
 * artifact — the shape an agent that consumes another agent's output needs
 * (DEVOS-032's requirements agent reading DEVOS-031's discovery report, and
 * DEVOS-033/034's later stages, each reading the one before it).
 */
export interface AgentArtifactConsumerTaskHandlerDeps extends AgentArtifactTaskHandlerDeps {
  artifacts: ArtifactRepository;
  artifactVersions: ArtifactVersionRepository;
}
