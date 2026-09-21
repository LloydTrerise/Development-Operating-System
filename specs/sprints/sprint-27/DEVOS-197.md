# DEVOS-197 — Validation, documentation, and gap disclosure

**Priority:** P1 | **Estimate:** 1d
**Depends on:** DEVOS-194, DEVOS-195, DEVOS-196.
**Depended on by:** none — closes Sprint 27.

## Scope

Full monorepo validation, plus explicit disclosure of any real gap DEVOS-194–196 surfaced.

## Implementation

- Run `pnpm turbo run typecheck lint test build --filter='!@devos/e2e-tests'`; fix any real failure.
- Run the full real `tests/e2e` suite; confirm every existing file remains green (no existing test configures `provider: 'gitlab'`, so this is a pure regression check on the generalized resolver).
- Record in this file's own Acceptance section any real gap found — expected candidates: the still-missing `PATCH`/`DELETE` `Integration` routes; whether `resolveReleaseTarget`'s own analogous static inference (§DEVOS-194's disclosed narrowing) should be revisited once a second real deployment provider is ever scoped.

## Out of scope

Any new feature.

## Acceptance

Full validation green: `pnpm turbo run typecheck lint test build --filter='!@devos/e2e-tests' --force` (uncached) **76/76 green**; the full real `tests/e2e` suite **26/26 files, 51/51 tests green**, confirming zero regression from the generalized `resolvePullRequestProviderContext` switch (no existing test configures `provider: 'gitlab'`, and every existing `provider: 'local'`/absent-provider case reproduces today's exact prior `undefined` result).

## Gaps disclosed (not silently patched)

- **`PATCH`/`DELETE` `Integration` routes still don't exist**, and neither does an `update`/`delete` method on `IntegrationRepository` — DEVOS-194 added only the `POST`/`GET` half its own pilot needed (backlog §9's own explicit deferral). A misconfigured integration must still be fixed by creating a replacement row, not editing or removing the original.
- **`resolveReleaseTarget`'s own analogous static inference (`run-release-task.ts`) is untouched and still infers Render purely from `integration.type === 'Deployment'`** — the same kind of implicit inference DEVOS-194 just replaced for pull requests. Deliberately not generalized this sprint, since no second `DeploymentProvider` implementation exists yet to serve as a real second case (backlog §9) — revisiting it now would be speculative. The real trigger for that work is a future sprint that actually adds a second deployment provider.
- **DEVOS-196's own live-external-account gap**: no genuinely live GitHub.com/GitLab.com pilot was run (no credential available in this environment); see `DEVOS-196.md`'s own "Real deviation" section for the full disclosure of what was substituted (two real local HTTP servers, real network round trips, real task-handler/Tool-Gateway/git code path) and what remains unverified (genuine GitHub/GitLab production API compatibility).
- **No web UI for `Integration`** — confirmed out of scope from the start (backlog §9), not a new finding, but worth restating since DEVOS-183's own `KnowledgeSourcesPage.tsx` precedent means every other real resource in this codebase now has one except this.
