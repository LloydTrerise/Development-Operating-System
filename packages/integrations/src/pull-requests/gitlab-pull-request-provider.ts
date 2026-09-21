import type {
  CreatePullRequestRequest,
  PullRequestProvider,
  PullRequestRecord,
} from './pull-request-provider.js';

const DEFAULT_HOST = 'gitlab.com';

export interface GitLabPullRequestProviderOptions {
  /** A personal/project access token with API scope for `projectId`. */
  token: string;
  /** GitLab's own numeric or URL-encoded-path project id. */
  projectId: string;
  /** Defaults to `gitlab.com` — a self-managed GitLab instance may configure a different one. */
  host?: string;
  /** Injectable for tests — defaults to the global fetch. */
  fetchImpl?: typeof fetch;
}

interface GitLabMergeRequestResponse {
  iid: number;
  title: string;
  description: string | null;
  web_url: string;
  source_branch: string;
  target_branch: string;
}

function toRecord(
  request: CreatePullRequestRequest,
  body: GitLabMergeRequestResponse,
): PullRequestRecord {
  return {
    id: String(body.iid),
    title: body.title,
    sourceBranch: request.sourceBranch,
    targetBranch: request.targetBranch,
    ...(request.description !== undefined ? { description: request.description } : {}),
    url: body.web_url,
  };
}

/**
 * DEVOS-195 (Sprint 27, E27 Integration Adapter Expansion): a second real
 * `PullRequestProvider`, backed by the real GitLab REST API v4, behind the
 * same unchanged port `createGitHubPullRequestProvider` (DEVOS-104)
 * implements — mirrors that provider's own structure as closely as GitLab's
 * real API shape allows.
 *
 * GitLab's own real auth convention is a `PRIVATE-TOKEN` header (not
 * `Authorization: Bearer`, GitHub's convention). Idempotency mirrors the
 * GitHub provider's own approach: check for an already-open merge request
 * with the same source/target branch first, since GitLab's REST API has no
 * native idempotency-key concept for merge-request creation either.
 *
 * Never logs `token` — only HTTP status and GitLab's own (secret-free) JSON
 * error body appear in a thrown error's message, per AGENTS.md §22.
 */
export function createGitLabPullRequestProvider(
  options: GitLabPullRequestProviderOptions,
): PullRequestProvider {
  const host = options.host ?? DEFAULT_HOST;
  const baseUrl = `https://${host}/api/v4`;
  const fetchImpl = options.fetchImpl ?? fetch;
  const projectPath = `projects/${encodeURIComponent(options.projectId)}`;
  const headers = {
    'private-token': options.token,
    'content-type': 'application/json',
  };

  async function findOpenMergeRequest(
    request: CreatePullRequestRequest,
  ): Promise<GitLabMergeRequestResponse | undefined> {
    const url =
      `${baseUrl}/${projectPath}/merge_requests?state=opened` +
      `&source_branch=${encodeURIComponent(request.sourceBranch)}` +
      `&target_branch=${encodeURIComponent(request.targetBranch)}`;
    const response = await fetchImpl(url, { headers });
    if (!response.ok) return undefined;
    const results = (await response.json()) as GitLabMergeRequestResponse[];
    return results[0];
  }

  return {
    async createPullRequest(request: CreatePullRequestRequest): Promise<PullRequestRecord> {
      const existing = await findOpenMergeRequest(request);
      if (existing) return toRecord(request, existing);

      let response: Response;
      try {
        response = await fetchImpl(`${baseUrl}/${projectPath}/merge_requests`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            title: request.title,
            source_branch: request.sourceBranch,
            target_branch: request.targetBranch,
            ...(request.description !== undefined ? { description: request.description } : {}),
          }),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown network error.';
        throw new Error(`GitLab merge request creation failed: ${message}`, { cause: error });
      }

      if (!response.ok) {
        const bodyText = await response.text().catch(() => '');
        throw new Error(
          `GitLab merge request creation failed with status ${response.status}: ${bodyText}`,
        );
      }

      const body = (await response.json()) as GitLabMergeRequestResponse;
      return toRecord(request, body);
    },
  };
}
