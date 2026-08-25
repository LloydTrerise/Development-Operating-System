import type {
  AgentExecutionRepository,
  AgentRepository,
  AgentVersionRepository,
  Artifact,
  ArtifactRepository,
  ArtifactVersion,
  ArtifactVersionRepository,
  AuditRecordRepository,
  ContextManifest,
  IntegrationRepository,
  KnowledgeSourceRepository,
  MembershipRepository,
  PolicyRepository,
  ProjectRepository,
  ToolCapabilityRepository,
  ToolInvocationRepository,
  WorkflowDefinitionRepository,
  WorkflowRunRepository,
  WorkflowTaskRepository,
  WorkflowVersionRepository,
  WorkItemRepository,
} from '@devos/domain';
import type { AgentModelAdapter, PromptRepository, SchemaRepository } from '@devos/agents';
import type { PullRequestProvider } from '@devos/integrations';
import type { ArtifactStorage } from '@devos/storage';
import type { CreateWorkflowDraft, StartWorkflowRun } from '../workflows/deps.js';

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
  /**
   * DEVOS-098: cost-budget checking is optional cross-cutting behavior, the
   * same optional-and-additive pattern DEVOS-087's `metrics?: MetricsRegistry`
   * already established — every existing test fake for this interface stays
   * valid unchanged; only the real worker composition (`apps/worker/src/main.ts`)
   * supplies both, since it already has both repositories available.
   */
  projects?: ProjectRepository;
  auditRecords?: AuditRecordRepository;
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

/**
 * `AgentArtifactConsumerTaskHandlerDeps` plus what DEVOS-057's development
 * agent needs to actually apply its proposed change through the Tool
 * Gateway (DEVOS-052): `projects`/`memberships`/`policies`/
 * `toolCapabilities`/`toolInvocations` are exactly `@devos/tools`'s
 * `ToolGatewayDeps` shape (structurally satisfied without importing that
 * type here, keeping this file's own dependency footprint unchanged), and
 * `integrations` resolves the project's configured Git integration
 * (DEVOS-053).
 */
export interface DevelopmentAgentTaskHandlerDeps extends AgentArtifactConsumerTaskHandlerDeps {
  projects: ProjectRepository;
  memberships: MembershipRepository;
  policies: PolicyRepository;
  toolCapabilities: ToolCapabilityRepository;
  toolInvocations: ToolInvocationRepository;
  /** DEVOS-059: required by `@devos/tools`'s `ToolGatewayDeps`. */
  auditRecords: AuditRecordRepository;
  integrations: IntegrationRepository;
  /** DEVOS-061: closes the last capability this stage's own spec lists
   * ("create a pull request where authorised") — always the fake/local
   * provider in this sprint, per the user-authorized scoping decision. */
  pullRequestProvider: PullRequestProvider;
}

/**
 * DEVOS-064: Stage 8 — Automated Validation has no agent (§18 names no
 * "Validation Agent" — build/test are purely mechanical), so this does not
 * extend any `AgentTaskHandlerDeps` shape. Otherwise identical to
 * `DevelopmentAgentTaskHandlerDeps` minus the agent-runtime and
 * PR-provider fields it doesn't need: `TaskHandlerDeps`'s
 * storage/publishArtifact pair, artifact lookup (to find the `CODE_CHANGE`
 * this validates), and exactly `@devos/tools`'s `ToolGatewayDeps` shape to
 * invoke `build-run`/`test-run`.
 */
export interface ToolTaskHandlerDeps extends TaskHandlerDeps {
  artifacts: ArtifactRepository;
  artifactVersions: ArtifactVersionRepository;
  projects: ProjectRepository;
  memberships: MembershipRepository;
  policies: PolicyRepository;
  toolCapabilities: ToolCapabilityRepository;
  toolInvocations: ToolInvocationRepository;
  auditRecords: AuditRecordRepository;
  integrations: IntegrationRepository;
}

/**
 * DEVOS-065/066: `AgentArtifactConsumerTaskHandlerDeps` (the review agent
 * is a normal agent, exactly like DEVOS-031–034/057) plus `projects` and
 * `knowledgeSources` — together these structurally satisfy
 * `@devos/knowledge`'s `RetrievalDeps`, so `retrieveActiveKnowledgeSources`
 * (DEVOS-040) can be called directly with this same `deps` object to
 * resolve "engineering standards" (§19's input the spec corpus otherwise
 * gives no concrete source for — see this sprint's decision log).
 */
export interface ReviewAgentTaskHandlerDeps extends AgentArtifactConsumerTaskHandlerDeps {
  projects: ProjectRepository;
  knowledgeSources: KnowledgeSourceRepository;
  /** DEVOS-067: a `CHANGES_REQUIRED` decision starts a new development-path
   * run for the same work item (§20's "a new task execution is created") —
   * exactly `@devos/application`'s own `WorkflowUseCaseDeps` shape, so
   * `startRunForVersion` can be called directly with this same `deps`
   * object, the same structural-satisfaction approach `ToolTaskHandlerDeps`
   * already uses for `@devos/tools`'s `ToolGatewayDeps`. */
  memberships: MembershipRepository;
  workflowDefinitions: WorkflowDefinitionRepository;
  workflowVersions: WorkflowVersionRepository;
  workflowTasks: WorkflowTaskRepository;
  createDraft: CreateWorkflowDraft;
  startRun: StartWorkflowRun;
}
