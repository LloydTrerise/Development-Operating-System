# DEVOS-194 — Explicit provider discriminator + first-ever `Integration` API route

**Priority:** P0 | **Estimate:** 2d
**Depends on:** none.
**Depended on by:** DEVOS-195, DEVOS-196.

## Scope

Real, provider-aware selection of a `PullRequestProvider` implementation, and a real `POST`/`GET` API surface for `Integration`, where none exists today.

## Correction to the backlog document's own proposed design

`specs/DEVOS-AUTONOMY-INTEGRATION-BACKLOG.md` §6.1/DEVOS-194 proposed adding a new `configuration.provider` tag. Direct inspection while starting this task found that is unnecessary: `Integration` (`packages/domain/src/integrations/integration.ts:22`) **already has a top-level `provider: string` field** — required and validated non-empty by `createIntegration` (`packages/application/src/integrations/create-integration.ts:68`), and already recorded in every integration's own audit record (`create-integration.ts:105`). It is simply never read by either resolver today: `resolveGitHubRepositoryTarget` (`github-context.ts:24-34`) infers GitHub purely from `configuration.github`'s presence, and `resolveReleaseTarget` (`run-release-task.ts:56-111`) infers Render purely from `integration.type === 'Deployment'`. `tests/e2e/*.test.ts` already set `provider: 'local'` on every Git integration they create, consistent with the field's documented intent, confirming this is a real "the field exists, nothing reads it" gap — not a new concept to invent. This task wires the already-existing field into the PR-provider resolution path instead of adding a new one.

**Also narrows the backlog's proposed scope:** `run-release-task.ts`'s `resolveReleaseTarget` is left untouched. Sprint 27 adds no second `DeploymentProvider` implementation (backlog §9), so generalizing that resolver has no real second case to serve yet and would be speculative — deferred until a real second deployment provider is actually scoped.

## Implementation

- `packages/application/src/tasks/github-context.ts`: add a new `resolveGitLabProjectTarget(configuration)` sibling to the existing, unchanged `resolveGitHubRepositoryTarget` — reads `configuration.gitlab.{projectId, host?}` (host defaults to `gitlab.com`), mirroring the existing function's own validation shape (non-empty string checks, `undefined` on absence, never an error).
- `packages/application/src/tasks/run-development-agent-task.ts`: `resolveGitHubContext` is renamed `resolvePullRequestProviderContext` and now switches on the Git integration's own `provider` field: `'github'` → today's exact existing path (`resolveGitHubRepositoryTarget` + `createGitHubPullRequestProvider`), `'gitlab'` → the new path (DEVOS-195), anything else (including `'local'`, today's exact existing value in every test) → `undefined`, falling back to `deps.pullRequestProvider` exactly as today. Zero change to the function's return shape or its two existing call sites' handling of `undefined`.
- `packages/application/src/integrations/deps.ts`: confirm/export `IntegrationUseCaseDeps` is already importable by the new route file (it is, per DEVOS-183/173's own established per-resource `deps.ts` pattern).
- `apps/api/src/routes/integrations.ts` (new): `createIntegrationRoutes(prefix, deps)` mirroring `createAgentRoutes`'s exact `Route[]` factory shape (`apps/api/src/routes/agents.ts`) — `POST ${prefix}/projects/:projectId/integrations` (wires the existing, untouched `createIntegration` use case) and `GET ${prefix}/projects/:projectId/integrations` (wires the existing, untouched `listIntegrationsForProject`). `OWNER`-gated exactly as `createIntegration` already enforces internally (`canRegisterIntegration`) — no new authorization logic.
- `apps/api/src/dto/integration.ts` (new): `parseCreateIntegrationBody`/`toIntegrationDto`, mirroring `dto/agent.ts`'s established shape. `toIntegrationDto` never includes `credentialReference`'s resolved value (it never has one to include — the field itself is only ever a reference name) but does include the reference name and `configuration`, consistent with `create-integration.ts`'s own audit-record precedent of treating both as non-secret.
- `apps/api/src/app.ts`: register `createIntegrationRoutes(API_PREFIX, integrationDeps)` alongside the existing `createAgentRoutes`/`createKnowledgeSourceRoutes` registrations.

## Out of scope

`PATCH`/`DELETE` routes for `Integration` (no update/delete method exists on `IntegrationRepository` either — adding one is a separate, disclosed, not-yet-scoped gap, backlog §9). Any web UI for integrations. Any change to `resolveReleaseTarget`/`DeploymentProvider` selection (no second deployment provider this sprint).

## Acceptance

`packages/application/tests/integrations.test.ts` continues to pass unmodified (no change to the use cases themselves). New unit tests for `resolveGitLabProjectTarget` (present/absent/partially-configured cases, mirroring `resolveGitHubRepositoryTarget`'s own existing test shape) and for `resolvePullRequestProviderContext`'s new provider switch (proving `provider: 'local'`/absent `provider` reproduces today's exact `undefined` result — zero regression for every existing `run-development-agent-task.test.ts` case, re-run unmodified). New route tests for `POST`/`GET /projects/:projectId/integrations` (a real `apps/api` integration test, mirroring `apps/api/tests/agents.test.ts`'s own pattern) proving a real `Integration` row is created and listed through the real HTTP surface, `OWNER`-gated. `pnpm --filter @devos/application --filter @devos/api typecheck test` green.
