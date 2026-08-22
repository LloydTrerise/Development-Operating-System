import {
  runDiscoveryTask,
  type AgentArtifactConsumerTaskHandlerDeps,
  type TaskHandlerDeps,
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
  createArtifactPublisher,
  createArtifactRepository,
  createArtifactVersionRepository,
  createContextManifestRecorder,
  createDatabaseClient,
  createPostgresTaskQueue,
  createWorkflowRunRepository,
  createWorkItemRepository,
} from '@devos/database';
import { createLocalFilesystemStorage } from '@devos/storage';
import { routeAgentTask } from './agent-task-router.js';
import { createTaskDispatcher } from './task-dispatcher.js';

const config = loadConfig();
const database = createDatabaseClient({ connectionString: config.database.url });
const taskQueue = createPostgresTaskQueue(database.db);
const dispatcher = createTaskDispatcher(taskQueue);

const storage = createLocalFilesystemStorage(
  process.env.ARTIFACT_STORAGE_DIR ?? './data/artifacts',
);
const publishArtifact = createArtifactPublisher(database.db);
const workflowRuns = createWorkflowRunRepository(database.db);
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
    const [discovery, requirements, technicalDesign, planning] = await Promise.all([
      fixtures.resolve('discovery-v1'),
      fixtures.resolve('requirements-v1'),
      fixtures.resolve('technical-design-v1'),
      fixtures.resolve('planning-v1'),
    ]);
    return createFixtureModelAdapter({
      DISCOVERY: discovery,
      REQUIREMENTS: requirements,
      TECHNICAL_DESIGN: technicalDesign,
      PLANNING: planning,
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
  const agentTaskDeps: AgentArtifactConsumerTaskHandlerDeps = {
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
  };

  dispatcher.registerHandler('AGENT_TASK', (task) => routeAgentTask(agentTaskDeps, task));
}

dispatcher.start();
console.log('DevOS worker ready, dispatching workflow tasks');

async function shutdown(signal: string): Promise<void> {
  console.log(`DevOS worker received ${signal}, shutting down gracefully`);
  await dispatcher.stop();
  await database.close();
  console.log('DevOS worker stopped');
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
