# DEVOS-195 — Real GitLab `PullRequestProvider` implementation

**Priority:** P0 | **Estimate:** 2.5d
**Depends on:** DEVOS-194 (`resolveGitLabProjectTarget`, the generalized `resolvePullRequestProviderContext` switch).
**Depended on by:** DEVOS-196.

## Scope

A second real `PullRequestProvider` implementation, backed by the real GitLab REST API v4, behind the existing, completely unchanged port (`packages/integrations/src/pull-requests/pull-request-provider.ts:28-30`).

## Implementation

- `packages/integrations/src/pull-requests/gitlab-pull-request-provider.ts` (new): `createGitLabPullRequestProvider(options: { token, projectId, host?, fetchImpl? })` implementing `PullRequestProvider`, mirroring `createGitHubPullRequestProvider`'s own structure (`github-pull-request-provider.ts`) as closely as the two APIs' real differences allow:
  - Real `fetch` calls to `https://{host}/api/v4/projects/{projectId}/merge_requests` (`host` defaults to `gitlab.com`), `PRIVATE-TOKEN: {token}` header (GitLab's own real auth convention, distinct from GitHub's `Authorization: Bearer`).
  - Idempotency mirrors the GitHub provider's own approach: check for an already-open merge request with the same `source_branch`/`target_branch` first (`GET .../merge_requests?state=opened&source_branch=...&target_branch=...`), return its record if found, else `POST` a new one.
  - Maps GitLab's response shape (`iid`, `title`, `description`, `web_url`, `source_branch`, `target_branch`) to the existing, unchanged `PullRequestRecord` shape — `id` is the merge request's `iid` as a string, consistent with the GitHub provider's own `id: String(body.number)` convention.
  - Never logs `token`; thrown errors include only HTTP status and GitLab's own JSON error body, per `AGENTS.md` §22, mirroring the GitHub provider's own error-handling convention exactly.
- `packages/integrations/src/pull-requests/index.ts`: export the new function/options type.
- `packages/integrations/src/index.ts`: re-export from the barrel, mirroring every other provider's own existing barrel entry.
- `packages/application/src/tasks/run-development-agent-task.ts`: `resolvePullRequestProviderContext`'s (DEVOS-194) `'gitlab'` branch resolves the credential via the existing, unchanged `deps.credentialResolver` (same pattern as the GitHub branch) and constructs `createGitLabPullRequestProvider({ token, projectId: target.projectId, host: target.host })`.

## Out of scope

Any change to `createGitHubPullRequestProvider`, `createLocalPullRequestProvider`, or `createPullRequestProviderAdapter` (the Tool Gateway wrapper) — all reused completely unchanged, exactly as the port's own provider-agnostic design intends. Any GitLab CI, GitLab-hosted runner, or other GitLab product surface beyond merge-request creation.

## Acceptance

New unit tests (`packages/integrations/tests/gitlab-pull-request-provider.test.ts`, mirroring `github-pull-request-provider.test.ts`'s own structure exactly — an injected `fetchImpl` stub, never a real network call in unit tests): a fresh merge request is created and mapped correctly; a repeat call for the same source/target branch returns the existing record without a second `POST` (idempotency); a non-2xx response throws an `Error` whose message never contains the token. `pnpm --filter @devos/integrations --filter @devos/application typecheck test` green.
