/**
 * "Create pull request through gateway" (DEVOS-058's own task spec) — this
 * port exists so the `pull-request-create` capability (DEVOS-051) can be
 * wired to different implementations without changing anything upstream of
 * it. Sprints 4-8 built and live-verified only a fake/local implementation
 * (`createLocalPullRequestProvider`), per that period's own user-authorized
 * scoping decision. DEVOS-104 (Sprint 9) added a real one
 * (`createGitHubPullRequestProvider`, backed by the GitHub REST API) behind
 * this same, unchanged port.
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
