import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  ForbiddenError as UseCaseForbiddenError,
  NotFoundError as UseCaseNotFoundError,
  ValidationError as UseCaseValidationError,
} from '@devos/application';
import { loadConfig, type DevosConfig } from '@devos/config';
import type { ApiError, ApiErrorResponse, ApiResponse } from '@devos/contracts';
import type { ListWorkflowRunsForDefinition } from '@devos/domain';
import { Redis } from 'ioredis';
import {
  createAgentDraftCreator,
  createAgentExecutionRepository,
  createAgentRepository,
  createAgentVersionRepository,
  createApprovalRepository,
  createDecideApprovalAndTransition,
  createArtifactPublisher,
  createArtifactRepository,
  createArtifactVersionRepository,
  createAuditRecordRepository,
  createContextManifestRepository,
  createDatabaseClient,
  createIntegrationRepository,
  createKnowledgeReferenceRepository,
  createKnowledgeSourceRepository,
  createMembershipRepository,
  createOrganisationRepository,
  createPolicyRepository,
  createProjectRepository,
  createProjectTypeAgentRepository,
  createProjectTypeRepository,
  createProjectTypeWorkflowRepository,
  createProjectWithClonesCreator,
  createToolCapabilityRepository,
  createToolInvocationRepository,
  createWorkItemRepository,
  createWorkflowDefinitionRepository,
  createWorkflowDraftCreator,
  createWorkflowRunRepository,
  createWorkflowRunStarter,
  createWorkflowRunsForDefinitionLister,
  createWorkflowRunStatusCountsSummarizer,
  createWorkflowTaskRepository,
  createWorkflowVersionRepository,
  createWorkflowVersionSummarizer,
  type DatabaseClient,
} from '@devos/database';
import {
  createLocalAuthProvider,
  createOidcAuthProvider,
  type AuthProvider,
} from '@devos/identity';
import { createLocalFilesystemStorage } from '@devos/storage';
import type {
  AgentExecutionSummaryUseCaseDeps,
  AgentUseCaseDeps,
  ApprovalUseCaseDeps,
  ArtifactUseCaseDeps,
  AuditUseCaseDeps,
  CostUseCaseDeps,
  EngineeringIntelligenceUseCaseDeps,
  IntegrationUseCaseDeps,
  KnowledgeUseCaseDeps,
  OrganisationUseCaseDeps,
  PolicyUseCaseDeps,
  ProjectTypeUseCaseDeps,
  ProjectUseCaseDeps,
  ReleaseReadinessUseCaseDeps,
  SearchUseCaseDeps,
  SystemHealthUseCaseDeps,
  ToolInvocationSummaryUseCaseDeps,
  ToolUseCaseDeps,
  WorkflowLibraryUseCaseDeps,
  WorkItemUseCaseDeps,
  WorkflowUseCaseDeps,
} from '@devos/application';
import {
  AuthenticationError,
  BadRequestError,
  HttpError,
  NotFoundError,
  RateLimitError,
} from './http/errors.js';
import {
  createRateLimiter,
  createRedisRateLimiter,
  type RateLimiter,
} from './http/rate-limiter.js';
import { findRoute, type Route } from './http/router.js';
import { createAgentExecutionSummaryRoutes } from './routes/agent-execution-summaries.js';
import { createAgentRoutes } from './routes/agents.js';
import { createApprovalRoutes } from './routes/approvals.js';
import { createArtifactRoutes } from './routes/artifacts.js';
import { createAuditRoutes } from './routes/audit.js';
import { createCostRoutes } from './routes/cost.js';
import { createEngineeringIntelligenceRoutes } from './routes/engineering-intelligence.js';
import { createHealthRoutes } from './routes/health.js';
import { createIntegrationRoutes } from './routes/integrations.js';
import { createKnowledgeSourceRoutes } from './routes/knowledge-sources.js';
import { createMeRoutes } from './routes/me.js';
import { createOrganisationRoutes } from './routes/organisations.js';
import { createPolicyRoutes } from './routes/policies.js';
import { createProjectTypeRoutes } from './routes/project-types.js';
import { createProjectRoutes } from './routes/projects.js';
import { createReleaseReadinessRoutes } from './routes/release-readiness.js';
import { createSearchRoutes } from './routes/search.js';
import { createSystemHealthRoutes } from './routes/system-health.js';
import { createToolCapabilityRoutes } from './routes/tool-capabilities.js';
import { createToolInvocationSummaryRoutes } from './routes/tool-invocation-summaries.js';
import { createWorkItemRoutes } from './routes/work-items.js';
import { createWorkflowRoutes } from './routes/workflows.js';
import { createWorkflowLibraryRoutes } from './routes/workflow-library.js';
import { createWorkflowRunRoutes } from './routes/workflow-runs.js';

const API_PREFIX = '/api/v1';
const CORRELATION_HEADER = 'x-correlation-id';
const CORS_ALLOWED_METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';
const CORS_ALLOWED_HEADERS = ['content-type', CORRELATION_HEADER, 'authorization'].join(', ');

function resolveCorrelationId(req: IncomingMessage): string {
  const header = req.headers[CORRELATION_HEADER];
  const value = Array.isArray(header) ? header[0] : header;
  return value !== undefined && value.trim().length > 0 ? value.trim() : randomUUID();
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function parseBody(raw: string, contentType: string | undefined): unknown {
  if (raw.length === 0 || contentType?.includes('application/json') !== true) return undefined;

  try {
    return JSON.parse(raw);
  } catch {
    throw new BadRequestError('Request body must be valid JSON.');
  }
}

/**
 * No specification defines an allowed-origin policy. The web app (DEVOS-007)
 * calls this API cross-origin in development (different ports), so the
 * request's Origin is reflected rather than left unset — the API does not
 * use cookies/credentials, so this is not a production security decision,
 * just what makes the browser allow the response to be read at all.
 */
function applyCorsHeaders(req: IncomingMessage, res: ServerResponse): void {
  const origin = req.headers.origin;
  res.setHeader('access-control-allow-origin', origin ?? '*');
  res.setHeader('access-control-allow-methods', CORS_ALLOWED_METHODS);
  res.setHeader('access-control-allow-headers', CORS_ALLOWED_HEADERS);
  if (origin !== undefined) res.setHeader('vary', 'origin');
}

function send(
  res: ServerResponse,
  status: number,
  requestId: string,
  payload: ApiResponse<unknown> | ApiErrorResponse,
): void {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.setHeader(CORRELATION_HEADER, requestId);
  res.end(JSON.stringify(payload));
}

function toErrorBody(error: unknown): { status: number; body: ApiError } {
  if (error instanceof HttpError) {
    return {
      status: error.status,
      body: {
        code: error.code,
        message: error.message,
        ...(error.details !== undefined ? { details: error.details } : {}),
      },
    };
  }

  if (error instanceof UseCaseNotFoundError) {
    return { status: 404, body: { code: 'DEVOS_NOT_FOUND', message: error.message } };
  }
  if (error instanceof UseCaseForbiddenError) {
    return { status: 403, body: { code: 'DEVOS_FORBIDDEN', message: error.message } };
  }
  if (error instanceof UseCaseValidationError) {
    return { status: 400, body: { code: 'DEVOS_VALIDATION_ERROR', message: error.message } };
  }

  return {
    status: 500,
    body: { code: 'DEVOS_INTERNAL_ERROR', message: 'An unexpected error occurred.' },
  };
}

export interface DevosApi {
  config: DevosConfig;
  handleRequest: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
  close: () => Promise<void>;
}

export interface CreateAppOptions {
  env?: NodeJS.ProcessEnv;
  database?: DatabaseClient;
  authProvider?: AuthProvider;
  projectDeps?: ProjectUseCaseDeps;
  workItemDeps?: WorkItemUseCaseDeps;
  workflowDeps?: WorkflowUseCaseDeps;
  artifactDeps?: ArtifactUseCaseDeps;
  auditDeps?: AuditUseCaseDeps;
  costDeps?: CostUseCaseDeps;
  engineeringIntelligenceDeps?: EngineeringIntelligenceUseCaseDeps;
  agentDeps?: AgentUseCaseDeps;
  agentExecutionSummaryDeps?: AgentExecutionSummaryUseCaseDeps;
  toolInvocationSummaryDeps?: ToolInvocationSummaryUseCaseDeps;
  releaseReadinessDeps?: ReleaseReadinessUseCaseDeps;
  knowledgeDeps?: KnowledgeUseCaseDeps;
  integrationDeps?: IntegrationUseCaseDeps;
  organisationDeps?: OrganisationUseCaseDeps;
  projectTypeDeps?: ProjectTypeUseCaseDeps;
  policyDeps?: PolicyUseCaseDeps;
  approvalDeps?: ApprovalUseCaseDeps;
  toolDeps?: ToolUseCaseDeps;
  systemHealthDeps?: SystemHealthUseCaseDeps;
  searchDeps?: SearchUseCaseDeps;
  workflowLibraryDeps?: WorkflowLibraryUseCaseDeps;
  /** DEVOS-091: overridable so tests can exercise a real 429 without firing 60+ requests. */
  mutationRateLimiter?: RateLimiter;
  /** DEVOS-135: overridable the same way `database` itself is — a real
   * join against `workflow_versions`/`workflow_runs` by default, but tests
   * exercising an in-memory `workflowDeps` need an in-memory equivalent
   * instead of hitting a real (here, fake/null) database connection. */
  listRunsForDefinition?: ListWorkflowRunsForDefinition;
}

export function createApp(options: CreateAppOptions = {}): DevosApi {
  const config = loadConfig(options.env ?? process.env);
  const database =
    options.database ?? createDatabaseClient({ connectionString: config.database.url });
  // DEVOS-107: a real OIDC provider is used by default whenever both
  // AUTH_ISSUER_URL/AUTH_AUDIENCE are configured; `createLocalAuthProvider`
  // remains the default otherwise (local dev, and every existing test that
  // never sets those two variables), per this task's own scope.
  const authProvider =
    options.authProvider ??
    (config.auth.issuerUrl !== undefined && config.auth.audience !== undefined
      ? createOidcAuthProvider({ issuerUrl: config.auth.issuerUrl, audience: config.auth.audience })
      : createLocalAuthProvider());
  // DEVOS-091: only mutating requests count as "expensive" for rate-limiting
  // purposes — a read has no write/agent/tool-invocation cost behind it.
  // 60 requests per 10s per principal is generous enough not to interfere
  // with real usage or this app's own test suites while still being real.
  //
  // DEVOS-118: a real shared-store (Redis) limiter is used by default
  // whenever REDIS_URL is configured — the same "real backend when
  // configured, else the pre-existing single-process behaviour" selection
  // DEVOS-106/107 already established for Vault/OIDC. `redisClient` stays
  // `undefined` (and is never connected) unless this path is actually
  // taken, so every existing test/local-dev run that never sets REDIS_URL
  // is completely unaffected.
  const redisClient =
    options.mutationRateLimiter === undefined && config.rateLimit.redisUrl !== undefined
      ? new Redis(config.rateLimit.redisUrl)
      : undefined;
  const mutationRateLimiter =
    options.mutationRateLimiter ??
    (redisClient !== undefined
      ? createRedisRateLimiter(redisClient, 60, 10_000)
      : createRateLimiter(60, 10_000));
  const auditRecordRepository = createAuditRecordRepository(database.db);
  const projectTypeRepository = createProjectTypeRepository(database.db);
  const projectTypeWorkflowRepository = createProjectTypeWorkflowRepository(database.db);
  const projectTypeAgentRepository = createProjectTypeAgentRepository(database.db);
  const projectDeps: ProjectUseCaseDeps = options.projectDeps ?? {
    projects: createProjectRepository(database.db),
    memberships: createMembershipRepository(database.db),
    auditRecords: auditRecordRepository,
    projectTypes: projectTypeRepository,
    projectTypeWorkflows: projectTypeWorkflowRepository,
    projectTypeAgents: projectTypeAgentRepository,
    createProjectWithClones: createProjectWithClonesCreator(database.db),
  };
  const workItemDeps: WorkItemUseCaseDeps = options.workItemDeps ?? {
    projects: projectDeps.projects,
    memberships: projectDeps.memberships,
    workItems: createWorkItemRepository(database.db),
    auditRecords: auditRecordRepository,
  };
  const workflowDeps: WorkflowUseCaseDeps = options.workflowDeps ?? {
    projects: projectDeps.projects,
    memberships: projectDeps.memberships,
    workItems: workItemDeps.workItems,
    workflowDefinitions: createWorkflowDefinitionRepository(database.db),
    workflowVersions: createWorkflowVersionRepository(database.db),
    workflowRuns: createWorkflowRunRepository(database.db),
    workflowTasks: createWorkflowTaskRepository(database.db),
    createDraft: createWorkflowDraftCreator(database.db),
    startRun: createWorkflowRunStarter(database.db),
  };
  const artifactDeps: ArtifactUseCaseDeps = options.artifactDeps ?? {
    projects: projectDeps.projects,
    memberships: projectDeps.memberships,
    artifacts: createArtifactRepository(database.db),
    artifactVersions: createArtifactVersionRepository(database.db),
    storage: createLocalFilesystemStorage(process.env.ARTIFACT_STORAGE_DIR ?? './data/artifacts'),
    publishArtifact: createArtifactPublisher(database.db),
  };
  const auditDeps: AuditUseCaseDeps = options.auditDeps ?? {
    projects: projectDeps.projects,
    memberships: projectDeps.memberships,
    auditRecords: auditRecordRepository,
    // DEVOS-147: a separate instance from `organisationDeps.organisations`
    // below (construction order) — both are stateless wrappers over the
    // same real `database.db`, so this is safe.
    organisations: createOrganisationRepository(database.db),
  };
  const agentDeps: AgentUseCaseDeps = options.agentDeps ?? {
    projects: projectDeps.projects,
    memberships: projectDeps.memberships,
    agents: createAgentRepository(database.db),
    agentVersions: createAgentVersionRepository(database.db),
    createDraft: createAgentDraftCreator(database.db),
    auditRecords: auditRecordRepository,
    // DEVOS-174: a separate instance from `artifactDeps.artifacts` above
    // (construction order) — both are stateless wrappers over the same
    // real `database.db`, mirroring `costDeps.organisations`'s own
    // established precedent exactly.
    artifacts: createArtifactRepository(database.db),
  };
  const costDeps: CostUseCaseDeps = options.costDeps ?? {
    projects: projectDeps.projects,
    memberships: projectDeps.memberships,
    // DEVOS-151: a separate instance from `organisationDeps.organisations`
    // below (construction order) — both are stateless wrappers over the
    // same real `database.db`, mirroring `auditDeps.organisations`' own
    // established precedent exactly.
    organisations: createOrganisationRepository(database.db),
    agentExecutions: createAgentExecutionRepository(database.db),
  };
  const engineeringIntelligenceDeps: EngineeringIntelligenceUseCaseDeps =
    options.engineeringIntelligenceDeps ?? {
      projects: projectDeps.projects,
      memberships: projectDeps.memberships,
      // DEVOS-164: separate instances from `auditDeps.organisations`/
      // `costDeps.organisations`/`workItemDeps.workItems` above (construction
      // order) — all stateless wrappers over the same real `database.db`,
      // mirroring `costDeps.organisations`'s own established precedent.
      organisations: createOrganisationRepository(database.db),
      artifacts: createArtifactRepository(database.db),
      workItems: createWorkItemRepository(database.db),
      projectTypes: projectTypeRepository,
    };
  const agentExecutionSummaryDeps: AgentExecutionSummaryUseCaseDeps =
    options.agentExecutionSummaryDeps ?? {
      projects: projectDeps.projects,
      memberships: projectDeps.memberships,
      workflowRuns: workflowDeps.workflowRuns,
      workflowTasks: workflowDeps.workflowTasks,
      agentExecutions: createAgentExecutionRepository(database.db),
      agentVersions: agentDeps.agentVersions,
      contextManifests: createContextManifestRepository(database.db),
    };
  const toolInvocationSummaryDeps: ToolInvocationSummaryUseCaseDeps =
    options.toolInvocationSummaryDeps ?? {
      projects: projectDeps.projects,
      memberships: projectDeps.memberships,
      workflowRuns: workflowDeps.workflowRuns,
      workflowTasks: workflowDeps.workflowTasks,
      toolInvocations: createToolInvocationRepository(database.db),
      toolCapabilities: createToolCapabilityRepository(database.db),
    };
  const releaseReadinessDeps: ReleaseReadinessUseCaseDeps = options.releaseReadinessDeps ?? {
    projects: projectDeps.projects,
    memberships: projectDeps.memberships,
    artifacts: artifactDeps.artifacts,
    artifactVersions: artifactDeps.artifactVersions,
  };
  const knowledgeDeps: KnowledgeUseCaseDeps = options.knowledgeDeps ?? {
    projects: projectDeps.projects,
    memberships: projectDeps.memberships,
    knowledgeSources: createKnowledgeSourceRepository(database.db),
    auditRecords: auditRecordRepository,
    knowledgeReferences: createKnowledgeReferenceRepository(database.db),
  };
  const integrationDeps: IntegrationUseCaseDeps = options.integrationDeps ?? {
    projects: projectDeps.projects,
    memberships: projectDeps.memberships,
    integrations: createIntegrationRepository(database.db),
    auditRecords: auditRecordRepository,
  };
  const organisationDeps: OrganisationUseCaseDeps = options.organisationDeps ?? {
    organisations: createOrganisationRepository(database.db),
    memberships: projectDeps.memberships,
    auditRecords: auditRecordRepository,
  };
  const projectTypeDeps: ProjectTypeUseCaseDeps = options.projectTypeDeps ?? {
    projectTypes: projectTypeRepository,
    projectTypeWorkflows: projectTypeWorkflowRepository,
    projectTypeAgents: projectTypeAgentRepository,
  };
  const policyDeps: PolicyUseCaseDeps = options.policyDeps ?? {
    projects: projectDeps.projects,
    organisations: organisationDeps.organisations,
    memberships: projectDeps.memberships,
    policies: createPolicyRepository(database.db),
    auditRecords: auditRecordRepository,
  };
  const approvalDeps: ApprovalUseCaseDeps = options.approvalDeps ?? {
    projects: projectDeps.projects,
    memberships: projectDeps.memberships,
    workflowRuns: workflowDeps.workflowRuns,
    artifactVersions: artifactDeps.artifactVersions,
    approvals: createApprovalRepository(database.db),
    policies: policyDeps.policies,
    decideApprovalAndTransition: createDecideApprovalAndTransition(database.db),
    // DEVOS-112: the re-planning loop's own `startRunForVersion` call needs
    // the full workflow use-case surface — reusing workflowDeps's own
    // already-constructed repositories rather than duplicating them.
    workItems: workflowDeps.workItems,
    workflowDefinitions: workflowDeps.workflowDefinitions,
    workflowVersions: workflowDeps.workflowVersions,
    workflowTasks: workflowDeps.workflowTasks,
    createDraft: workflowDeps.createDraft,
    startRun: workflowDeps.startRun,
  };
  const toolDeps: ToolUseCaseDeps = options.toolDeps ?? {
    projects: projectDeps.projects,
    memberships: projectDeps.memberships,
    // DEVOS-256: the same `ToolCapabilityRepository` instance
    // `toolInvocationSummaryDeps` already constructs.
    toolCapabilities: toolInvocationSummaryDeps.toolCapabilities,
    auditRecords: auditRecordRepository,
  };
  const systemHealthDeps: SystemHealthUseCaseDeps = options.systemHealthDeps ?? {
    projects: projectDeps.projects,
    memberships: projectDeps.memberships,
    integrations: integrationDeps.integrations,
    toolCapabilities: toolDeps.toolCapabilities,
  };
  const searchDeps: SearchUseCaseDeps = options.searchDeps ?? {
    projects: projectDeps.projects,
    memberships: projectDeps.memberships,
    workItems: workItemDeps.workItems,
    artifacts: artifactDeps.artifacts,
    workflowDefinitions: workflowDeps.workflowDefinitions,
    agents: agentDeps.agents,
  };
  const workflowLibraryDeps: WorkflowLibraryUseCaseDeps = options.workflowLibraryDeps ?? {
    organisations: organisationDeps.organisations,
    memberships: projectDeps.memberships,
    workflowDefinitions: workflowDeps.workflowDefinitions,
    summarizeVersionsForDefinitions: createWorkflowVersionSummarizer(database.db),
    summarizeRunStatusCountsForOrganisation: createWorkflowRunStatusCountsSummarizer(database.db),
  };

  const routes: Route[] = [
    ...createHealthRoutes(API_PREFIX, database),
    ...createMeRoutes(API_PREFIX),
    ...createOrganisationRoutes(API_PREFIX, organisationDeps),
    ...createProjectTypeRoutes(API_PREFIX, projectTypeDeps),
    ...createProjectRoutes(API_PREFIX, projectDeps),
    ...createWorkItemRoutes(API_PREFIX, {
      ...workItemDeps,
      workflowRuns: workflowDeps.workflowRuns,
    }),
    ...createWorkflowRoutes(API_PREFIX, {
      ...workflowDeps,
      auditRecords: projectDeps.auditRecords,
      listRunsForDefinition:
        options.listRunsForDefinition ?? createWorkflowRunsForDefinitionLister(database.db),
    }),
    ...createWorkflowRunRoutes(API_PREFIX, workflowDeps),
    ...createArtifactRoutes(API_PREFIX, artifactDeps),
    ...createAuditRoutes(API_PREFIX, auditDeps),
    ...createCostRoutes(API_PREFIX, costDeps),
    ...createEngineeringIntelligenceRoutes(
      API_PREFIX,
      engineeringIntelligenceDeps,
      options.env ?? process.env,
    ),
    ...createAgentRoutes(API_PREFIX, agentDeps),
    ...createAgentExecutionSummaryRoutes(API_PREFIX, agentExecutionSummaryDeps),
    ...createToolInvocationSummaryRoutes(API_PREFIX, toolInvocationSummaryDeps),
    ...createReleaseReadinessRoutes(API_PREFIX, releaseReadinessDeps),
    ...createKnowledgeSourceRoutes(API_PREFIX, knowledgeDeps),
    ...createIntegrationRoutes(API_PREFIX, integrationDeps),
    ...createPolicyRoutes(API_PREFIX, policyDeps),
    ...createApprovalRoutes(API_PREFIX, approvalDeps),
    ...createToolCapabilityRoutes(API_PREFIX, toolDeps),
    ...createSystemHealthRoutes(API_PREFIX, systemHealthDeps, database),
    ...createSearchRoutes(API_PREFIX, searchDeps),
    ...createWorkflowLibraryRoutes(API_PREFIX, workflowLibraryDeps),
  ];

  async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    applyCorsHeaders(req, res);

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    const requestId = resolveCorrelationId(req);
    const url = new URL(req.url ?? '/', 'http://localhost');
    const pathname = url.pathname;

    try {
      const raw = await readBody(req);
      const body = parseBody(raw, req.headers['content-type']);

      const match = findRoute(routes, req.method, pathname);
      if (!match) throw new NotFoundError(pathname);

      const principal = await authProvider.authenticate(req.headers.authorization);
      if (match.route.protected && principal === null) throw new AuthenticationError();

      const isMutatingMethod =
        req.method === 'POST' || req.method === 'PATCH' || req.method === 'DELETE';
      if (isMutatingMethod && principal !== null) {
        if (!(await mutationRateLimiter.tryAcquire(principal.id))) throw new RateLimitError();
      }

      const data = await match.route.handler({
        principal,
        params: match.params,
        query: Object.fromEntries(url.searchParams),
        body,
        correlationId: requestId,
      });
      send(res, 200, requestId, { data, meta: { requestId } });
    } catch (error) {
      const { status, body } = toErrorBody(error);
      send(res, status, requestId, { error: body, meta: { requestId } });
    }
  }

  async function close(): Promise<void> {
    if (redisClient !== undefined) redisClient.disconnect();
    await database.close();
  }

  return { config, handleRequest, close };
}
