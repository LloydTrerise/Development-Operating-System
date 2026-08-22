import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  ForbiddenError as UseCaseForbiddenError,
  NotFoundError as UseCaseNotFoundError,
  ValidationError as UseCaseValidationError,
} from '@devos/application';
import { loadConfig, type DevosConfig } from '@devos/config';
import type { ApiError, ApiErrorResponse, ApiResponse } from '@devos/contracts';
import {
  createAgentDraftCreator,
  createAgentExecutionRepository,
  createAgentRepository,
  createAgentVersionRepository,
  createApprovalRepository,
  createApprovalRunTransition,
  createArtifactPublisher,
  createArtifactRepository,
  createArtifactVersionRepository,
  createAuditRecordRepository,
  createContextManifestRepository,
  createDatabaseClient,
  createKnowledgeSourceRepository,
  createMembershipRepository,
  createPolicyRepository,
  createProjectRepository,
  createWorkItemRepository,
  createWorkflowDefinitionRepository,
  createWorkflowDraftCreator,
  createWorkflowRunRepository,
  createWorkflowRunStarter,
  createWorkflowTaskRepository,
  createWorkflowVersionRepository,
  type DatabaseClient,
} from '@devos/database';
import { createLocalAuthProvider, type AuthProvider } from '@devos/identity';
import { createLocalFilesystemStorage } from '@devos/storage';
import type {
  AgentExecutionSummaryUseCaseDeps,
  AgentUseCaseDeps,
  ApprovalUseCaseDeps,
  ArtifactUseCaseDeps,
  AuditUseCaseDeps,
  KnowledgeUseCaseDeps,
  PolicyUseCaseDeps,
  ProjectUseCaseDeps,
  WorkItemUseCaseDeps,
  WorkflowUseCaseDeps,
} from '@devos/application';
import { AuthenticationError, BadRequestError, HttpError, NotFoundError } from './http/errors.js';
import { findRoute, type Route } from './http/router.js';
import { createAgentExecutionSummaryRoutes } from './routes/agent-execution-summaries.js';
import { createAgentRoutes } from './routes/agents.js';
import { createApprovalRoutes } from './routes/approvals.js';
import { createArtifactRoutes } from './routes/artifacts.js';
import { createAuditRoutes } from './routes/audit.js';
import { createHealthRoutes } from './routes/health.js';
import { createKnowledgeSourceRoutes } from './routes/knowledge-sources.js';
import { createMeRoutes } from './routes/me.js';
import { createPolicyRoutes } from './routes/policies.js';
import { createProjectRoutes } from './routes/projects.js';
import { createWorkItemRoutes } from './routes/work-items.js';
import { createWorkflowRoutes } from './routes/workflows.js';
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
  agentDeps?: AgentUseCaseDeps;
  agentExecutionSummaryDeps?: AgentExecutionSummaryUseCaseDeps;
  knowledgeDeps?: KnowledgeUseCaseDeps;
  policyDeps?: PolicyUseCaseDeps;
  approvalDeps?: ApprovalUseCaseDeps;
}

export function createApp(options: CreateAppOptions = {}): DevosApi {
  const config = loadConfig(options.env ?? process.env);
  const database =
    options.database ?? createDatabaseClient({ connectionString: config.database.url });
  const authProvider = options.authProvider ?? createLocalAuthProvider();
  const projectDeps: ProjectUseCaseDeps = options.projectDeps ?? {
    projects: createProjectRepository(database.db),
    memberships: createMembershipRepository(database.db),
  };
  const workItemDeps: WorkItemUseCaseDeps = options.workItemDeps ?? {
    projects: projectDeps.projects,
    memberships: projectDeps.memberships,
    workItems: createWorkItemRepository(database.db),
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
    auditRecords: createAuditRecordRepository(database.db),
  };
  const agentDeps: AgentUseCaseDeps = options.agentDeps ?? {
    projects: projectDeps.projects,
    memberships: projectDeps.memberships,
    agents: createAgentRepository(database.db),
    agentVersions: createAgentVersionRepository(database.db),
    createDraft: createAgentDraftCreator(database.db),
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
  const knowledgeDeps: KnowledgeUseCaseDeps = options.knowledgeDeps ?? {
    projects: projectDeps.projects,
    memberships: projectDeps.memberships,
    knowledgeSources: createKnowledgeSourceRepository(database.db),
  };
  const policyDeps: PolicyUseCaseDeps = options.policyDeps ?? {
    projects: projectDeps.projects,
    memberships: projectDeps.memberships,
    policies: createPolicyRepository(database.db),
  };
  const approvalDeps: ApprovalUseCaseDeps = options.approvalDeps ?? {
    projects: projectDeps.projects,
    memberships: projectDeps.memberships,
    workflowRuns: workflowDeps.workflowRuns,
    artifactVersions: artifactDeps.artifactVersions,
    approvals: createApprovalRepository(database.db),
    transitionAfterApprovalDecision: createApprovalRunTransition(database.db)
      .transitionAfterApprovalDecision,
  };

  const routes: Route[] = [
    ...createHealthRoutes(API_PREFIX, database),
    ...createMeRoutes(API_PREFIX),
    ...createProjectRoutes(API_PREFIX, projectDeps),
    ...createWorkItemRoutes(API_PREFIX, workItemDeps),
    ...createWorkflowRoutes(API_PREFIX, workflowDeps),
    ...createWorkflowRunRoutes(API_PREFIX, workflowDeps),
    ...createArtifactRoutes(API_PREFIX, artifactDeps),
    ...createAuditRoutes(API_PREFIX, auditDeps),
    ...createAgentRoutes(API_PREFIX, agentDeps),
    ...createAgentExecutionSummaryRoutes(API_PREFIX, agentExecutionSummaryDeps),
    ...createKnowledgeSourceRoutes(API_PREFIX, knowledgeDeps),
    ...createPolicyRoutes(API_PREFIX, policyDeps),
    ...createApprovalRoutes(API_PREFIX, approvalDeps),
  ];

  async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    applyCorsHeaders(req, res);

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    const requestId = resolveCorrelationId(req);
    const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;

    try {
      const raw = await readBody(req);
      const body = parseBody(raw, req.headers['content-type']);

      const match = findRoute(routes, req.method, pathname);
      if (!match) throw new NotFoundError(pathname);

      const principal = authProvider.authenticate(req.headers.authorization);
      if (match.route.protected && principal === null) throw new AuthenticationError();

      const data = await match.route.handler({ principal, params: match.params, body });
      send(res, 200, requestId, { data, meta: { requestId } });
    } catch (error) {
      const { status, body } = toErrorBody(error);
      send(res, status, requestId, { error: body, meta: { requestId } });
    }
  }

  async function close(): Promise<void> {
    await database.close();
  }

  return { config, handleRequest, close };
}
