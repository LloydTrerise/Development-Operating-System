import type {
  CreatePullRequestRequest,
  PullRequestProvider,
  PullRequestRecord,
} from './pull-request-provider.js';

const DEFAULT_BASE_URL = 'https://api.github.com';

export interface GitHubPullRequestProviderOptions {
  /** A fine-grained Personal Access Token with Contents + Pull requests write access to `owner/repo`. */
  token: string;
  owner: string;
  repo: string;
  baseUrl?: string;
  /** Injectable for tests — defaults to the global fetch. */
  fetchImpl?: typeof fetch;
}

interface GitHubPullRequestResponse {
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  head: { ref: string };
  base: { ref: string };
}

function toRecord(
  request: CreatePullRequestRequest,
  body: GitHubPullRequestResponse,
): PullRequestRecord {
  return {
    id: String(body.number),
    title: body.title,
    sourceBranch: request.sourceBranch,
    targetBranch: request.targetBranch,
    ...(request.description !== undefined ? { description: request.description } : {}),
    url: body.html_url,
  };
}

/**
 * DEVOS-104: a real `PullRequestProvider` backed by the GitHub REST API,
 * alongside the existing `createLocalPullRequestProvider`. `owner`/`repo`
 * (the flagged gap in DEVOS-104's own task spec — `CreatePullRequestRequest`
 * has no field identifying which repository) are supplied here at
 * construction time instead of widened onto the request/target shape: a
 * development task is already scoped to one project's one Git integration
 * per call (`run-development-agent-task.ts` resolves it before constructing
 * a provider), so closing over the resolved `Integration.configuration`
 * value keeps `CreatePullRequestRequest`, the Tool Gateway `target` shape,
 * and every existing caller unchanged, exactly as this task's own Scope
 * section intends.
 *
 * GitHub's REST API has no native idempotency-key concept for PR creation,
 * unlike `createLocalPullRequestProvider`'s in-memory map — a repeated call
 * for the same head/base is instead made idempotent by checking for an
 * already-open PR with that exact head/base first, matching the local
 * provider's own "repeat returns the original record" behaviour without
 * relying on parsing GitHub's error-response text.
 *
 * Never logs `token` — only HTTP status and GitHub's own (secret-free) JSON
 * error body appear in a thrown error's message, per AGENTS.md §22.
 */
export function createGitHubPullRequestProvider(
  options: GitHubPullRequestProviderOptions,
): PullRequestProvider {
  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
  const fetchImpl = options.fetchImpl ?? fetch;
  const repoPath = `repos/${options.owner}/${options.repo}`;
  const headers = {
    authorization: `Bearer ${options.token}`,
    accept: 'application/vnd.github+json',
    'content-type': 'application/json',
    'x-github-api-version': '2022-11-28',
  };

  async function findOpenPullRequest(
    request: CreatePullRequestRequest,
  ): Promise<GitHubPullRequestResponse | undefined> {
    const url =
      `${baseUrl}/${repoPath}/pulls?state=open` +
      `&head=${encodeURIComponent(`${options.owner}:${request.sourceBranch}`)}` +
      `&base=${encodeURIComponent(request.targetBranch)}`;
    const response = await fetchImpl(url, { headers });
    if (!response.ok) return undefined;
    const results = (await response.json()) as GitHubPullRequestResponse[];
    return results[0];
  }

  return {
    async createPullRequest(request: CreatePullRequestRequest): Promise<PullRequestRecord> {
      const existing = await findOpenPullRequest(request);
      if (existing) return toRecord(request, existing);

      let response: Response;
      try {
        response = await fetchImpl(`${baseUrl}/${repoPath}/pulls`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            title: request.title,
            head: request.sourceBranch,
            base: request.targetBranch,
            ...(request.description !== undefined ? { body: request.description } : {}),
          }),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown network error.';
        throw new Error(`GitHub pull request creation failed: ${message}`, { cause: error });
      }

      if (!response.ok) {
        const bodyText = await response.text().catch(() => '');
        throw new Error(
          `GitHub pull request creation failed with status ${response.status}: ${bodyText}`,
        );
      }

      const body = (await response.json()) as GitHubPullRequestResponse;
      return toRecord(request, body);
    },
  };
}
