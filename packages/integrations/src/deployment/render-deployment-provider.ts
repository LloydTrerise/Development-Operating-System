import type { DeployRequest, DeploymentProvider, DeploymentRecord } from './deployment-provider.js';

const DEFAULT_BASE_URL = 'https://api.render.com/v1';
const DEFAULT_POLL_INTERVAL_MS = 3000;
const DEFAULT_MAX_POLL_ATTEMPTS = 40; // ~2 minutes at the default interval

const TERMINAL_FAILURE_STATUSES = new Set([
  'build_failed',
  'update_failed',
  'canceled',
  'deactivated',
]);
const TERMINAL_SUCCESS_STATUS = 'live';

export interface RenderDeploymentProviderOptions {
  apiKey: string;
  serviceId: string;
  baseUrl?: string;
  /** Injectable for tests — defaults to the global fetch. */
  fetchImpl?: typeof fetch;
  /** Injectable for tests — real deploys are polled at this interval by default. */
  pollIntervalMs?: number;
  maxPollAttempts?: number;
}

interface RenderDeployResponse {
  id: string;
  status?: string;
}

interface RenderServiceResponse {
  id: string;
  serviceDetails?: { url?: string };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * DEVOS-105: a real `DeploymentProvider` for Render (this sprint's chosen
 * target platform — see the sprint decision log), alongside the existing
 * `createLocalStagingDeploymentProvider`. `serviceId`/`apiKey` are supplied
 * at construction time, mirroring `createGitHubPullRequestProvider`'s
 * `owner`/`repo` precedent (DEVOS-104): a release task is already scoped to
 * one project's one Deployment integration per call
 * (`run-release-task.ts` resolves it before constructing a provider), so
 * `DeployRequest` stays minimal rather than widened with a field every
 * other provider would have to ignore.
 *
 * Render's deploy-trigger endpoint returns immediately with a
 * still-in-progress deploy; this polls the deploy's own status until it
 * reaches a terminal state (`live`, or a failure state) before resolving,
 * so a successful `deploy()` call really means "the revision is live," not
 * merely "Render accepted the request" — matching
 * `createLocalStagingDeploymentProvider`'s own synchronous, verifiable
 * completion semantics as closely as a real, asynchronous provider can.
 *
 * Render's exact response field shapes (in particular
 * `serviceDetails.url`) are this task's own best-effort reading of Render's
 * public API, not independently confirmed against a real account before
 * this sprint's live-verification step — flagged per AGENTS.md §7 rather
 * than asserted with unearned confidence; live verification against a real
 * Render service is what actually confirms or corrects it.
 *
 * Never logs `apiKey` — only HTTP status and Render's own (secret-free)
 * JSON error body appear in a thrown error's message, per AGENTS.md §22.
 */
export function createRenderDeploymentProvider(
  options: RenderDeploymentProviderOptions,
): DeploymentProvider {
  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
  const fetchImpl = options.fetchImpl ?? fetch;
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const maxPollAttempts = options.maxPollAttempts ?? DEFAULT_MAX_POLL_ATTEMPTS;
  const servicePath = `services/${options.serviceId}`;
  const headers = {
    authorization: `Bearer ${options.apiKey}`,
    accept: 'application/json',
    'content-type': 'application/json',
  };

  async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
    let response: Response;
    try {
      response = await fetchImpl(`${baseUrl}/${path}`, { headers, ...init });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown network error.';
      throw new Error(`Render request to "${path}" failed: ${message}`, { cause: error });
    }
    if (!response.ok) {
      const bodyText = await response.text().catch(() => '');
      throw new Error(
        `Render request to "${path}" failed with status ${response.status}: ${bodyText}`,
      );
    }
    return (await response.json()) as T;
  }

  async function pollUntilTerminal(deployId: string): Promise<string> {
    for (let attempt = 0; attempt < maxPollAttempts; attempt++) {
      const deploy = await requestJson<RenderDeployResponse>(`${servicePath}/deploys/${deployId}`);
      const status = deploy.status ?? 'unknown';
      if (status === TERMINAL_SUCCESS_STATUS) return status;
      if (TERMINAL_FAILURE_STATUSES.has(status)) {
        throw new Error(`Render deploy ${deployId} ended in status "${status}".`);
      }
      await wait(pollIntervalMs);
    }
    throw new Error(
      `Render deploy ${deployId} did not reach a terminal state within ${maxPollAttempts} polls.`,
    );
  }

  return {
    async deploy(request: DeployRequest): Promise<DeploymentRecord> {
      const deploy = await requestJson<RenderDeployResponse>(`${servicePath}/deploys`, {
        method: 'POST',
        body: JSON.stringify({ commitId: request.revision }),
      });

      await pollUntilTerminal(deploy.id);

      const service = await requestJson<RenderServiceResponse>(servicePath);
      const url = service.serviceDetails?.url;

      return {
        id: deploy.id,
        environment: request.environment,
        revision: request.revision,
        ...(url !== undefined ? { url } : {}),
      };
    },
  };
}
