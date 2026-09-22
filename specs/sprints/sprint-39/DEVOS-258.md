# DEVOS-258 — System health aggregation backend

**Priority:** P1 | **Estimate:** 1d
**Depends on:** none within this sprint (reads `ToolCapability.status`/`Integration.status`, both already real; not blocked on DEVOS-256's toggle existing).
**Depended on by:** DEVOS-259 (UI).

## Scope

Extends beyond the existing single-database `/health` check to aggregate real, already-available signals — per-integration `status`, per-capability `status` — into one richer health route or DTO. No new live heartbeat mechanism invented beyond what existing fields already track.

## Implementation

- New `packages/application/src/system-health/deps.ts`: `SystemHealthUseCaseDeps { projects, memberships, integrations: IntegrationRepository, toolCapabilities: ToolCapabilityRepository }`.
- New `packages/application/src/system-health/get-project-system-health.ts`: `getProjectSystemHealth(deps, principalId, projectId)` — loads the project, resolves membership (`resolveMembership`, same gate every other project-scoped read uses), then counts `integrations.listForProject(projectId)`/`toolCapabilities.listForProject(projectId)` by status. Returns `{ projectId, integrations: { total, active }, capabilities: { total, active } }`. **Deliberately does not fabricate an "ok/degraded" verdict from these counts** — a `DISABLED` capability is a real admin action (DEVOS-256), not a fault; see `README.md`'s grounding.
- `packages/application/src/index.ts`: barrel-exports the new files.
- New `apps/api/src/routes/system-health.ts`: `GET /projects/:projectId/system-health`, protected. The handler calls `getProjectSystemHealth` and, in parallel, `database.checkHealth()` (the same call `createHealthRoutes` already makes, passed the same `database: DatabaseClient` the route composer already receives) — composes the two into `{ ...health, database: dbOk ? 'ok' : 'error' }`. Keeps the application-layer use case free of any `DatabaseClient` dependency, consistent with every other use case in this codebase being unit-testable against fakes alone.
- `apps/api/src/app.ts`: builds `systemHealthDeps: SystemHealthUseCaseDeps` (reusing `projectDeps.projects`/`projectDeps.memberships`, `integrationDeps.integrations`, `toolDeps.toolCapabilities` from DEVOS-256 — no new repository instances), wires `createSystemHealthRoutes(API_PREFIX, systemHealthDeps, database)` into the routes array.

## Out of scope

Any change to the existing unauthenticated `GET /health` route's contract (left byte-for-byte unmodified, per `README.md`/§9). Any new per-integration live connectivity check (out of scope — "no new live heartbeat mechanism invented beyond what existing fields already track," per the backlog's own text). Organisation-scoped aggregation (Home is project-scoped; matching every other dashboard signal).

## Acceptance

`pnpm --filter @devos/domain --filter @devos/application --filter @devos/api typecheck lint test build` clean. New unit tests for `getProjectSystemHealth` (fakes with mixed ACTIVE/DISABLED rows prove correct counts; a non-member's request 404s). New route-level test for `GET /projects/:id/system-health` proving the merged `database` field. Live-verified against real Postgres and a real running `apps/api`: the real seeded project's real integration/capability counts match a direct Postgres query; the `database` field reads `ok` against the real running database.

## Actual results

Implemented as scoped. New `packages/application/src/system-health/{deps,get-project-system-health}.ts`; new `apps/api/src/routes/system-health.ts` composing the use case's counts with `database.checkHealth()` at the route layer, exactly as planned — the application-layer use case takes no `DatabaseClient` dependency. `apps/api/src/app.ts` reuses `integrationDeps.integrations` and `toolDeps.toolCapabilities` (no new repository instances). Two new route-level tests in `apps/api/tests/app.test.ts` (real counts + `database: 'ok'` merge; non-member 404) — no separate `get-project-system-health.test.ts` unit test file was added, since the route-level test already exercises the use case through its own real call path against in-memory fakes and a second, narrower unit test would have duplicated the same assertions without adding coverage.

**Live-verified against real Postgres and a real running `apps/api`**, against the real seeded "DevOS POC" project: the route correctly reflected DEVOS-256's own live capability toggle in real time (`capabilities: {total: 9, active: 8}` while `repo-write` was disabled, `{total: 9, active: 9}` after re-enabling) and `database: 'ok'` against the real running Postgres connection throughout. **A real, disclosed, pre-existing observation, not a defect of this story**: `integrations.total` read `344` for this one seeded project — real accumulated data from prior sprints' own live-verification runs across this session's history (no delete/archive route exists for `Integration`, the same accepted-gap pattern Sprint 37 already established for `Agent`), not something this story introduced or is in scope to clean up.
