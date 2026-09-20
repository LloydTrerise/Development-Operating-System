# DEVOS-171 — DORA/bottleneck dashboard UI, real end-to-end pilot, and validation

**Priority:** P0 | **Estimate:** 2.5d
**Depends on:** DEVOS-167, DEVOS-168, DEVOS-169, DEVOS-170.
**Depended on by:** none — closes E24.

## Scope

`EngineeringIntelligencePage.tsx` (DEVOS-165) gains a DORA section and a bottleneck section. A real pilot proves the whole epic end to end. Full validation closes the sprint and the epic.

## Implementation

- `apps/web/src/api-client.ts`: extend the DEVOS-165 report wrapper types to include the new `dora`/bottleneck fields; add `getSlowestWorkflows(projectId | organisationId)` wrapper.
- `apps/web/src/pages/EngineeringIntelligencePage.tsx`: render deployment frequency, change failure rate, lead time (p50/mean), and both time-to-restore proxy figures with their disclosed label strings shown verbatim in the UI (per DEVOS-169's own requirement — never silently presented as a single unqualified "MTTR"); render a slowest-workflows table/list from DEVOS-170's ranking.
- Real pilot: a real project with more than one real deploy (including at least one rollback) and more than one real workflow run, driven through the real API/worker (matching this codebase's own established pilot convention — DEVOS-100/108/126/137/148/157/161). Confirm deployment-frequency/change-failure-rate/lead-time/bottleneck figures in the dashboard match a direct Postgres query of the same underlying artifacts/metrics. Clean up all pilot test data afterward, confirmed via direct SQL (0 remaining rows), matching every prior pilot's own convention.
- Full monorepo `pnpm turbo run typecheck lint test build --filter='!@devos/e2e-tests'`; full real `tests/e2e` suite re-confirmed unaffected.
- Update `DEVOS-BUILD-STATE.md` recording Sprint 21's (and the whole E24 epic's) completion with real evidence, per `AGENTS.md` §18/§19.

## Out of scope

Any capability named in the backlog document's §9 "What NOT to build."

## Acceptance

The pilot's real figures are independently confirmed correct against direct Postgres queries, not just the dashboard's own rendering. Full validation green. `DEVOS-BUILD-STATE.md` updated. Per the user's own explicit instruction, work stops here and waits for explicit authorization before any further epic/sprint begins.
