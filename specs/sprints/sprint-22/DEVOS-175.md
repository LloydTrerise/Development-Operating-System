# DEVOS-175 — Real end-to-end pilot: two real published versions, two real outcomes

**Priority:** P0 | **Estimate:** 1.5d
**Depends on:** DEVOS-172, DEVOS-173, DEVOS-174.
**Depended on by:** DEVOS-176 (validation closes the sprint after this).

## Scope

A real agent's `DRAFT` v2 is published; real workflow runs against both v1 and v2 produce real, distinct outcomes; DEVOS-174's own view shows the correct, distinct real pass rate per version.

## Implementation

- A real pilot (new `tests/e2e/agent-platform-versioning-pilot.test.ts`, mirroring this codebase's own established pilot convention — DEVOS-100/108/126/137/148/157/161/171): a real project, a real agent (`v1`, `PUBLISHED`), a real `CODE_CHANGE`+`REVIEW_EVIDENCE` (`decision: 'PASS'`) attributed to `v1`; then a real `createNewAgentVersion` → `v2` (`DRAFT`) → published; a second real `CODE_CHANGE`+`REVIEW_EVIDENCE` (`decision: 'CHANGES_REQUIRED'`) attributed to `v2`.
- Real Postgres + real running `apps/api`: `GET /agents/:agentId/quality` returns `v1` at 100% pass rate and `v2` at 0%, confirmed independently via a direct Postgres query. Test data fully cleaned up afterward, confirmed via a follow-up query (0 remaining rows).

## Out of scope

Anything beyond confirming DEVOS-172/173/174 work together for real; no new functionality.

## Acceptance

The pilot's real figures are independently confirmed correct against direct Postgres queries, not just the API's own response. `pnpm --filter @devos/e2e-tests typecheck` green; the pilot test passes against real Postgres.
