# DEVOS-167 — Deployment frequency and change failure rate

**Priority:** P0 | **Estimate:** 1.5d
**Depends on:** DEVOS-163 (`listForProjectByType`/`listForOrganisationByType` over `RELEASE_EVIDENCE`).
**Depended on by:** DEVOS-171 (dashboard renders this).

## Scope

A new, pure function computes deployment frequency and change failure rate from a project's or organisation's real `RELEASE_EVIDENCE` artifacts.

## Implementation

- `packages/domain/src/engineering-intelligence/compute-dora-release-metrics.ts` (new, mirroring `computeExecutionPaths`'s pure-function pattern): `computeDoraReleaseMetrics(releaseEvidence: { action: 'deploy' | 'rollback'; passed: boolean; completedAt: string }[], periodStart: string, periodEnd: string): { deploymentCount: number; deploymentsPerDay: number; changeFailureCount: number; changeFailureRate: number }`. `deploymentCount` = count of `action === 'deploy'` within the period; `changeFailureCount` = count of entries with `action === 'rollback'` or `passed === false` within the period; `changeFailureRate = changeFailureCount / deploymentCount` (0 when `deploymentCount` is 0, not `NaN`/`Infinity`).
- `packages/application/src/engineering-intelligence/get-project-engineering-report.ts`/`get-organisation-engineering-report.ts` (DEVOS-164): extend each report to call this function over the real `RELEASE_EVIDENCE` rows DEVOS-163 already fetches, adding `dora: { deploymentCount, deploymentsPerDay, changeFailureCount, changeFailureRate }` to the report shape.

## Out of scope

Lead time and time-to-restore (DEVOS-168/169's own jobs). Any period-selection UI beyond a simple, disclosed default (e.g. last 30 days) — record the default chosen.

## Acceptance

Unit tests: correct counts/rate for a real mixed deploy/rollback sequence; zero-division handled as `0`, not `NaN`; entries outside the period window excluded. `pnpm --filter @devos/domain --filter @devos/application typecheck test` green.
