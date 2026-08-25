/**
 * "Create pull request through gateway" (DEVOS-058's own task spec). No
 * concrete GitHub PR request/response schema, endpoint, or auth scope
 * exists anywhere in the spec corpus — this port exists so the
 * `pull-request-create` capability (DEVOS-051) can be wired to a real
 * GitHub implementation later without changing anything upstream of it.
 * Per this sprint's user-authorized scoping decision, only a fake/local
 * implementation (`createLocalPullRequestProvider`) is built and
 * live-verified this sprint — no real GitHub API call is made anywhere.
 */
export interface CreatePullRequestRequest {
  sourceBranch: string;
  targetBranch: string;
  title: string;
  description?: string;
  idempotencyKey: string;
}

export interface PullRequestRecord {
  id: string;
  title: string;
  sourceBranch: string;
  targetBranch: string;
  description?: string;
  url?: string;
}

export interface PullRequestProvider {
  createPullRequest: (request: CreatePullRequestRequest) => Promise<PullRequestRecord>;
}
