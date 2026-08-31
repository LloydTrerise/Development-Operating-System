# DEVOS-104 — Real GitHub `PullRequestProvider` adapter

**Priority:** P0 | **Estimate:** 2d
**Depends on:** None (Sprint 8 complete).

## Scope

Build a real `PullRequestProvider` (`packages/integrations/src/pull-requests/pull-request-provider.ts`) implementation backed by the GitHub REST API (or a GitHub App, if `DEVOS-106`'s credential work makes that the simpler path) — `createGitHubPullRequestProvider`, mirroring `createLocalPullRequestProvider`'s existing shape exactly (`createPullRequest(request): Promise<PullRequestRecord>`), so `packages/application/src/tasks/pull-request-provider-adapter.ts` and everything upstream of it (the Tool Gateway, `runDevelopmentAgentTask`) requires zero changes.

## Grounding

`Analysis/DevOS_POC_Architecture_and_Implementation_Plan_v1.0.docx` §15 names "Git: create branch; commit; create PR" as an initial adapter capability the POC deliberately deferred to local-only (§16's own "one provider initially" guidance for the eventual real target). `DEVOS-PRODUCTION-READINESS-ROADMAP.md` A1.

## Flagged gap

`CreatePullRequestRequest` has no field identifying _which_ GitHub repository to open the PR against — today's local provider doesn't need one. A real adapter needs the target repository (owner/name), which must come from the project's `Integration.configuration` (the existing untyped JSONB bag) — add a typed shape for it (e.g. `{ owner: string; repo: string }`) as part of this task, not a new column, matching this codebase's existing `credentialReference`-via-`Integration` precedent.

## Acceptance

A real work item's development-path run, executed against a project with a real GitHub integration configured, opens a real, inspectable pull request on a real GitHub repository — the PR's URL is recorded in this task's decision-log entry.
