# DEVOS-151 — Real cost API surface

**Priority:** P0 | **Estimate:** 2d
**Depends on:** DEVOS-150 (the queries this exposes).
**Depended on by:** DEVOS-152 (dashboard UI).

## Scope

New `GET /projects/:projectId/cost` and `GET /organisations/:organisationId/cost-report` routes expose DEVOS-150's totals/breakdown plus the pre-existing `sumEstimatedCostUsdForProject` — today unreachable from any client — with the same membership/tenant checks every other project/organisation-scoped route already enforces.

## Implementation

- New application functions `getProjectCostSummary(deps, principalId, projectId)` and `getOrganisationCostReport(deps, principalId, organisationId)` (`packages/application/src/cost/`), mirroring `listAuditRecordsForProject`/`listAuditRecordsForOrganisation`'s existing authorization shape (project membership check / `resolveOrganisationMembership`).
- New route file `apps/api/src/routes/cost.ts` (mirroring `audit.ts`'s file-per-concern convention), registered in `apps/api/src/app.ts` alongside the existing audit/policy routes.
- Response DTO: `{ totalUsd: number, budgetUsd?: number, breakdownByRole: { role: string; totalUsd: number }[] }` for the project route; the organisation route additionally includes `projectCount` (number of projects included in the rollup).

## Out of scope

Any new export-file-generation endpoint (not required — the dashboard renders the JSON directly).

## Acceptance

A real running `apps/api` returns correct totals/breakdown for a real project and a real organisation with real cost data, matching DEVOS-150's own verified query results exactly. A non-member's request to either new route correctly 404s (mirroring every other project/organisation-scoped route's own established convention).
