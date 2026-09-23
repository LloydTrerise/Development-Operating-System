import {
  createNotificationEventSink,
  runApprovalTask,
  runConditionTask,
  runDiscoveryTask,
  runJoinTask,
  runParallelTask,
  runWaitTask,
  type ApprovalTaskHandlerDeps,
  type ClosureUseCaseDeps,
  type ConditionTaskHandlerDeps,
  type DevelopmentAgentTaskHandlerDeps,
  type ReviewAgentTaskHandlerDeps,
  type TaskHandlerDeps,
  type WaitTaskHandlerDeps,
} from '@devos/application';
import {
  createFilesystemFixtureRepository,
  createFilesystemPromptRepository,
  createFilesystemSchemaRepository,
  createFixtureModelAdapter,
  createGeminiModelAdapter,
  type AgentModelAdapter,
} from '@devos/agents';
import { loadConfig } from '@devos/config';
import {
  createAgentExecutionRepository,
  createAgentRepository,
  createAgentVersionRepository,
  createApprovalRepository,
  createArtifactPublisher,
  createArtifactRepository,
  createArtifactVersionRepository,
  createAuditRecordRepository,
  createContextManifestRecorder,
  createDatabaseClient,
  createIntegrationRepository,
  createKnowledgeReferenceRepository,
  createKnowledgeSourceRepository,
  createMembershipRepository,
  createNotificationRepository,
  createOrganisationRepository,
  createOutboxEventRepository,
  createPolicyRepository,
  createPostgresTaskQueue,
  createProjectRepository,
  createToolCapabilityRepository,
  createToolInvocationRepository,
  createWorkflowDefinitionRepository,
  createWorkflowDraftCreator,
  createWorkflowRunRepository,
  createWorkflowRunStarter,
  createWorkflowTaskRepository,
  createWorkflowVersionRepository,
  createWorkItemCloser,
  createWorkItemRepository,
  publishPendingEvents,
} from '@devos/database';
import {
  createEnvCredentialResolver,
  createLocalPullRequestProvider,
  createVaultCredentialResolver,
  type CredentialResolver,
} from '@devos/integrations';
import { createMetricsRegistry } from '@devos/observability';
import { createLocalFilesystemStorage } from '@devos/storage';
import { routeAgentTask } from './agent-task-router.js';
import { startMetricsServer } from './metrics-server.js';
import { createTaskDispatcher } from './task-dispatcher.js';
import { routeToolTask } from './tool-task-router.js';

const config = loadConfig();
const database = createDatabaseClient({ connectionString: config.database.url });
const taskQueue = createPostgresTaskQueue(database.db);
/** DEVOS-087: workflow/agent/tool/queue metrics, recorded per claimed task. */
export const metrics = createMetricsRegistry();
// DEVOS-170: constructed before the dispatcher (moved up from its own
// original construction site below) so `workflowVersionId` can be resolved
// and labelled on every metric this dispatcher emits.
const workflowRuns = createWorkflowRunRepository(database.db);
const dispatcher = createTaskDispatcher(taskQueue, {
  metrics,
  // DEVOS-145: expires past-due PENDING approvals on the same periodic
  // tick that already reclaims stale tasks and resumes ready WAITs.
  approvals: createApprovalRepository(database.db),
  workflowRuns,
});

const storage = createLocalFilesystemStorage(
  process.env.ARTIFACT_STORAGE_DIR ?? './data/artifacts',
);

/**
 * DEVOS-106: real Vault when configured (VAULT_ADDR/VAULT_TOKEN — see
 * infrastructure/docker/docker-compose.yml's `vault` service), else the
 * pre-existing env-var resolver — so a project's Git integration
 * `credentialReference` resolves to a real live secret only when a real
 * secret backend is actually configured, without forcing every DevOS
 * deployment to run Vault.
 */
const credentialResolver: CredentialResolver =
  config.secrets.vaultAddress !== undefined && config.secrets.vaultToken !== undefined
    ? createVaultCredentialResolver({
        address: config.secrets.vaultAddress,
        token: config.secrets.vaultToken,
      })
    : createEnvCredentialResolver();
const publishArtifact = createArtifactPublisher(database.db);
const workItems = createWorkItemRepository(database.db);

const taskHandlerDeps: TaskHandlerDeps = {
  workflowRuns,
  workItems,
  storage,
  publishArtifact,
};

// Deterministic, non-LLM stand-in for real agent execution (DEVOS-016).
// Left registered for the 'TASK' node type — untouched since Sprint 1, and
// still what Sprint 1's own e2e/hardening suites exercise — while the four
// real planning-path agents (DEVOS-031–034) are wired in below for the
// separate 'AGENT_TASK' node type (DEVOS-035). Same swappable-handler
// pattern either way; only which task type maps to which handler changes.
dispatcher.registerHandler('TASK', (task) => runDiscoveryTask(taskHandlerDeps, task));

/**
 * DEVOS-119: CONDITION is real, deterministic, non-LLM node execution —
 * registered unconditionally, the same way TASK is above, independent of
 * whether a model adapter resolves below.
 */
const conditionTaskDeps: ConditionTaskHandlerDeps = {
  workflowRuns,
  workflowVersions: createWorkflowVersionRepository(database.db),
  workflowTasks: createWorkflowTaskRepository(database.db),
  artifacts: createArtifactRepository(database.db),
};
dispatcher.registerHandler('CONDITION', (task) => runConditionTask(conditionTaskDeps, task));

/**
 * DEVOS-120: PARALLEL/JOIN are also real, deterministic, non-LLM node
 * execution — registered unconditionally like CONDITION/TASK above. Their
 * real behavior lives in the shared queue/failure machinery
 * (`packages/database`), not in these handlers themselves.
 */
dispatcher.registerHandler('PARALLEL', () => runParallelTask());
dispatcher.registerHandler('JOIN', () => runJoinTask());

/**
 * DEVOS-121: WAIT is also real, deterministic, non-LLM node execution —
 * registered unconditionally like CONDITION/PARALLEL/JOIN/TASK above.
 */
const waitTaskDeps: WaitTaskHandlerDeps = {
  workflowRuns,
  workflowVersions: createWorkflowVersionRepository(database.db),
  workflowTasks: createWorkflowTaskRepository(database.db),
};
dispatcher.registerHandler('WAIT', (task) => runWaitTask(waitTaskDeps, task));

/**
 * DEVOS-122: APPROVAL is also real, deterministic, non-LLM node execution —
 * registered unconditionally like CONDITION/PARALLEL/JOIN/WAIT/TASK above.
 * Creates a real approval request at this node's own point in the graph,
 * decided through the existing, unchanged DEVOS-110/111 decision path.
 */
const approvalTaskDeps: ApprovalTaskHandlerDeps = {
  workflowRuns,
  workflowVersions: createWorkflowVersionRepository(database.db),
  workflowTasks: createWorkflowTaskRepository(database.db),
  artifactVersions: createArtifactVersionRepository(database.db),
  approvals: createApprovalRepository(database.db),
  // DEVOS-146: risk-tiered approval routing — resolves a real organisation
  // policy's requiredApprovers/enforceSeparationOfDuties when a node names
  // a riskClass.
  projects: createProjectRepository(database.db),
  policies: createPolicyRepository(database.db),
  // DEVOS-199: resolves a node's own reliabilityReduction against real
  // captured reliability evidence (DEVOS-198) when configured.
  artifacts: createArtifactRepository(database.db),
  // DEVOS-270 gap closure: real ApprovalRequested outbox events for this
  // node-scoped approval path too, closing the real gap found proving
  // Sprint 42's own notification feature end-to-end — the legacy whole-run
  // gates already wrote this event; this handler never did until now.
  outboxEvents: createOutboxEventRepository(database.db),
};
dispatcher.registerHandler('APPROVAL', (task) => runApprovalTask(approvalTaskDeps, task));

/**
 * GEMINI_API_KEY is optional in @devos/config's shared schema (apps/api has
 * no LLM dependency), and deliberately not required for the worker to
 * start at all — Sprint 1's e2e/hardening suites (DEVOS-021/024) spawn a
 * real worker process against only the deterministic 'TASK' handler above
 * and must keep working without any LLM credential configured.
 *
 * AGENT_MODEL_ADAPTER=fixture (DEVOS-038) swaps in DEVOS-037's recorded
 * golden fixtures instead of a real Gemini call — this is what lets
 * DEVOS-038's automated planning-path proof spawn this exact real worker
 * binary (per DEVOS-021's established "no reaching into internals"
 * pattern) and still pass repeatably in CI, with no live API call and no
 * GEMINI_API_KEY needed. Not set in normal/production use.
 */
async function resolveAgentModelAdapter(): Promise<AgentModelAdapter | undefined> {
  if (process.env.AGENT_MODEL_ADAPTER === 'fixture') {
    const fixtures = createFilesystemFixtureRepository();
    // DEVOS-071: the development/review agents' real outputs are entirely
    // determined by their fixtures (not reactive to input), so a rework
    // loop can't be exercised end-to-end with single static fixtures — a
    // real review must return CHANGES_REQUIRED once then PASS on the
    // reworked attempt, and development must actually address the
    // findings on that reworked attempt (a repeated, byte-identical
    // proposal has nothing new to commit). DEVELOPMENT_FIXTURE_SEQUENCE/
    // REVIEW_FIXTURE_SEQUENCE (comma-separated fixture references) let a
    // test drive that; unset in every other case, where each agent always
    // uses its own single default fixture.
    const developmentFixtureReferences = process.env.DEVELOPMENT_FIXTURE_SEQUENCE?.split(',') ?? [
      'developer-v1',
    ];
    const reviewFixtureReferences = process.env.REVIEW_FIXTURE_SEQUENCE?.split(',') ?? [
      'review-v1',
    ];
    const [discovery, requirements, technicalDesign, planning, ...rest] = await Promise.all([
      fixtures.resolve('discovery-v1'),
      fixtures.resolve('requirements-v1'),
      fixtures.resolve('technical-design-v1'),
      fixtures.resolve('planning-v1'),
      ...developmentFixtureReferences.map((reference) => fixtures.resolve(reference)),
      ...reviewFixtureReferences.map((reference) => fixtures.resolve(reference)),
    ]);
    const development = rest.slice(0, developmentFixtureReferences.length);
    const review = rest.slice(developmentFixtureReferences.length);
    return createFixtureModelAdapter({
      DISCOVERY: discovery,
      REQUIREMENTS: requirements,
      TECHNICAL_DESIGN: technicalDesign,
      PLANNING: planning,
      DEVELOPMENT: development.length === 1 ? development[0]! : development,
      REVIEW: review.length === 1 ? review[0]! : review,
    });
  }

  const geminiApiKey = config.agents.geminiApiKey;
  return geminiApiKey === undefined
    ? undefined
    : createGeminiModelAdapter({ apiKey: geminiApiKey });
}

const modelAdapter = await resolveAgentModelAdapter();

// Without a resolved adapter, AGENT_TASK is simply left unregistered: the
// dispatcher's existing no-handler failure path (task-dispatcher.ts) fails
// such a task clearly, rather than the whole process refusing to start.
if (modelAdapter === undefined) {
  console.warn(
    'GEMINI_API_KEY not configured (and AGENT_MODEL_ADAPTER is not "fixture") — AGENT_TASK (the planning-path agents) will not be handled.',
  );
} else {
  const agentTaskDeps: DevelopmentAgentTaskHandlerDeps &
    ReviewAgentTaskHandlerDeps &
    ClosureUseCaseDeps = {
    workflowRuns,
    workItems,
    agents: createAgentRepository(database.db),
    agentVersions: createAgentVersionRepository(database.db),
    agentExecutions: createAgentExecutionRepository(database.db),
    modelAdapter,
    prompts: createFilesystemPromptRepository(),
    schemas: createFilesystemSchemaRepository(),
    recordContextManifest: createContextManifestRecorder(database.db),
    storage,
    publishArtifact,
    artifacts: createArtifactRepository(database.db),
    artifactVersions: createArtifactVersionRepository(database.db),
    projects: createProjectRepository(database.db),
    memberships: createMembershipRepository(database.db),
    // DEVOS-155: organisation-level budget alerting, alongside the
    // pre-existing project-level check above.
    organisations: createOrganisationRepository(database.db),
    policies: createPolicyRepository(database.db),
    toolCapabilities: createToolCapabilityRepository(database.db),
    toolInvocations: createToolInvocationRepository(database.db),
    auditRecords: createAuditRecordRepository(database.db),
    integrations: createIntegrationRepository(database.db),
    // DEVOS-104: the real GitHub provider is selected per task instead,
    // when the project's Git integration configures a real GitHub target
    // (resolveGitHubRepositoryTarget) — this stays the fallback for every
    // project that doesn't.
    pullRequestProvider: createLocalPullRequestProvider(),
    credentialResolver,
    // DEVOS-065/067: the review agent's own extra needs — engineering
    // standards retrieval, and starting a rework run on CHANGES_REQUIRED.
    knowledgeSources: createKnowledgeSourceRepository(database.db),
    // DEVOS-184: real usage traceability for `buildContext()`'s
    // knowledge-source selections.
    knowledgeReferences: createKnowledgeReferenceRepository(database.db),
    workflowDefinitions: createWorkflowDefinitionRepository(database.db),
    workflowVersions: createWorkflowVersionRepository(database.db),
    workflowTasks: createWorkflowTaskRepository(database.db),
    createDraft: createWorkflowDraftCreator(database.db),
    startRun: createWorkflowRunStarter(database.db),
    // DEVOS-079: the closure task's own extra needs — release approvals
    // and the transactional work-item closer.
    approvals: createApprovalRepository(database.db),
    closeWorkItem: createWorkItemCloser(database.db),
  };

  dispatcher.registerHandler('AGENT_TASK', (task) => routeAgentTask(agentTaskDeps, task));
  // DEVOS-064/073: Stage 8 (Automated Validation) and Stage 11's release-
  // readiness re-check have no agent, so they're registered for the
  // separate 'TOOL_TASK' node type instead of going through
  // routeAgentTask's agentRef-keyed dispatch — routed internally by
  // `routeToolTask`, mirroring `routeAgentTask`'s own pattern now that two
  // different deterministic handlers share this one node type.
  // `agentTaskDeps` is a structural superset of `ToolTaskHandlerDeps`
  // (every field either handler needs is already present above), so the
  // same object is reused rather than constructing a second one.
  dispatcher.registerHandler('TOOL_TASK', (task) => routeToolTask(agentTaskDeps, task));
}

dispatcher.start();
console.log('DevOS worker ready, dispatching workflow tasks');

/**
 * DEVOS-093: the real metrics registry (DEVOS-087) had no way to be read
 * from outside the process it lives in — establishing a real performance
 * baseline needs real numbers to actually be observable. A periodic log
 * line is the minimal mechanism that makes that possible without a real
 * metrics backend/export endpoint, which stays out of scope for this POC.
 * Interval is configurable for tests/local tuning; disabled entirely when
 * set to 0.
 */
const metricsSnapshotIntervalMs = Number(process.env.METRICS_SNAPSHOT_INTERVAL_MS ?? 30_000);
let metricsSnapshotTimer: NodeJS.Timeout | undefined;
if (metricsSnapshotIntervalMs > 0) {
  metricsSnapshotTimer = setInterval(() => {
    console.log('DevOS worker metrics snapshot', JSON.stringify(metrics.snapshot()));
  }, metricsSnapshotIntervalMs);
  metricsSnapshotTimer.unref();
}

/**
 * DEVOS-268: the outbox's own drain function (`publishPendingEvents()`,
 * Sprint 1) has never had a real caller until now — this is its first real
 * periodic consumer, mirroring `metricsSnapshotTimer`'s exact shape just
 * above (unconditional `setInterval`, configurable/disable-at-0, `.unref()`,
 * cleared in `shutdown()`). The sink materializes each drained event into
 * one `Notification` row per real project member (see
 * `createNotificationEventSink`'s own doc comment for the recipient rule).
 */
const notificationDrainIntervalMs = Number(process.env.NOTIFICATION_DRAIN_INTERVAL_MS ?? 5_000);
let notificationDrainTimer: NodeJS.Timeout | undefined;
if (notificationDrainIntervalMs > 0) {
  const outboxEvents = createOutboxEventRepository(database.db);
  const notificationSink = createNotificationEventSink({
    notifications: createNotificationRepository(database.db),
    memberships: createMembershipRepository(database.db),
  });
  notificationDrainTimer = setInterval(() => {
    void publishPendingEvents(outboxEvents, notificationSink).catch((error: unknown) => {
      console.error('DevOS worker notification drain failed', error);
    });
  }, notificationDrainIntervalMs);
  notificationDrainTimer.unref();
}

/**
 * DEVOS-117: the real external side of the same seam — a real, self-hosted
 * Prometheus (`infrastructure/docker/docker-compose.yml`) scrapes this real
 * `GET /metrics` endpoint on its own schedule, additive alongside (not
 * replacing) the periodic log-line snapshot above. `9464` is the OpenTelemetry
 * Prometheus exporter's own conventional default port when `METRICS_PORT` is
 * set — reused here for the same real numbers, even though this exports via
 * a hand-written Prometheus text formatter rather than the OTel SDK itself
 * (see `prometheus-format.ts`'s own doc comment for why).
 *
 * Opt-in (unset/`0` disables it), unlike `METRICS_SNAPSHOT_INTERVAL_MS`'s own
 * enabled-by-default convention: this is a real network listener, and
 * `tests/e2e` spawns multiple independent `apps/worker` processes, often
 * concurrently — a shared fixed default port would collide across them.
 */
const metricsPort = Number(process.env.METRICS_PORT ?? 0);
const metricsServer =
  metricsPort > 0
    ? startMetricsServer(metrics, metricsPort, {
        workflowVersions: createWorkflowVersionRepository(database.db),
        workflowDefinitions: createWorkflowDefinitionRepository(database.db),
      })
    : undefined;
if (metricsServer) {
  console.log(`DevOS worker metrics available at http://localhost:${metricsPort}/metrics`);
}

async function shutdown(signal: string): Promise<void> {
  console.log(`DevOS worker received ${signal}, shutting down gracefully`);
  if (metricsSnapshotTimer) clearInterval(metricsSnapshotTimer);
  if (notificationDrainTimer) clearInterval(notificationDrainTimer);
  console.log('DevOS worker final metrics snapshot', JSON.stringify(metrics.snapshot()));
  if (metricsServer) await new Promise<void>((resolve) => metricsServer.close(() => resolve()));
  await dispatcher.stop();
  await database.close();
  console.log('DevOS worker stopped');
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
