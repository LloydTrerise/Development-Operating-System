# DEVOS-164 — Real project and organisation engineering-report API

**Priority:** P0 | **Estimate:** 2d
**Depends on:** DEVOS-163 (query layer).
**Depended on by:** DEVOS-165 (dashboard reads this), DEVOS-171 (Sprint 21 extends this report's shape with DORA/bottleneck fields).

## Scope

New `GET /projects/:projectId/engineering-report` and `GET /organisations/:organisationId/engineering-report` routes, mirroring `createCostRoutes`'s/`createAuditRoutes`'s file-per-concern convention and membership-check shape exactly. Each returns a pre-aggregated report: review pass/fail counts and rate, rework-cycle distribution, test/security pass rates, and deploy/rollback counts.

## Implementation

- `packages/application/src/engineering-intelligence/deps.ts` (new, mirroring `CostUseCaseDeps`/`AuditUseCaseDeps`): `EngineeringIntelligenceUseCaseDeps` composing `artifacts`, `workItems`, `projects`, `organisations`, and the existing membership-resolution helpers (`resolveMembership`/`resolveOrganisationMembership`, reused unchanged).
- `packages/application/src/engineering-intelligence/get-project-engineering-report.ts` (new): resolves membership (`NotFoundError` on failure, matching every existing project-scoped use case), calls DEVOS-163's `listForProjectByType` for each of the four evidence types plus `countReworkCyclesForProject`, and computes: `reviewPassRate`, `reviewCount`, `testPassRate`, `securityScanPassRate`, `deployCount`, `rollbackCount`, `reworkCycleCount` (sum across work items). Pure aggregation over DEVOS-163's real rows — no new I/O beyond what DEVOS-163 already added.
- `packages/application/src/engineering-intelligence/get-organisation-engineering-report.ts` (new): the organisation-scoped mirror, reusing `listForOrganisationByType`, gated by `resolveOrganisationMembership` (DEVOS-147's own precedent), returning the same shape plus `projectCount`.
- `apps/api/src/routes/engineering-intelligence.ts` (new): the two routes, wired into `apps/api/src/app.ts`'s existing route-composition list alongside `createCostRoutes`/`createAuditRoutes`.
- `apps/api/src/dto/engineering-intelligence.ts` (new, if any DTO shaping beyond a direct pass-through is needed, matching `dto/artifact.ts`'s own convention).

## Out of scope

Any UI (DEVOS-165's job). Any DORA/bottleneck field (Sprint 21's job — this report's shape is deliberately extended there, not duplicated).

## Acceptance

Unit tests for both use cases: correct aggregation over a real fake/in-memory repository fixture; `NotFoundError` for a non-member principal, matching every existing project/organisation-scoped use case's own test convention. A real Postgres + real running `apps/api` integration check (or an `app.test.ts`-style in-memory route test, matching `apps/api/tests/app.test.ts`'s existing convention) proves both routes return correct data for a real project/organisation with real evidence artifacts. `pnpm --filter @devos/application --filter @devos/api typecheck test` green. Every existing route/app test passes unmodified.
