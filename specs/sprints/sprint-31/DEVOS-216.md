# DEVOS-216 — Cross-check existing e2e/UI coverage

**Priority:** P1 | **Estimate:** 0.5d
**Depends on:** DEVOS-212–215 (the markup/route changes this task cross-checks).
**Depended on by:** DEVOS-217 (full validation assumes this is done).

## Scope

Re-run every existing test touching Work Items/Runs/Approvals; update any assertion this sprint's changes break; close the one real route-level test gap found during this sprint's own conversion grounding.

## Implementation

- Add a route-level HTTP test for `GET /runs/:runId/approvals` to `apps/api/tests/app.test.ts` (in the existing `DEVOS-084: tenant isolation` describe block, alongside the other approval route tests at lines 2522+, reusing its own `approvalDeps`/`authed` fixtures) — proves the route returns only approvals for that run, and returns 404 for a non-member, mirroring the existing project-scoped approval isolation test's own shape. This closes the real gap the README's grounding found: the route exists and is application-layer-tested but had no HTTP-level test.
- Re-run the full real `tests/e2e` suite (grounded list from this sprint's own conversion: `full-workflow.test.ts`, `development-path.test.ts`, `approval-*.test.ts`, `vertical-slice.test.ts`, and every other file touching work items/runs) — none of these are markup/DOM-dependent (they hit the API directly), so no assertion changes are expected there; confirm this by a clean run rather than assuming it.
- Re-run `apps/web/tests/api-client.test.ts`; add test cases for the three new client wrappers (`getWorkItem`, `updateWorkItem`, `listApprovalsForRun`) added by DEVOS-213/DEVOS-215, mirroring the file's own existing request-shape-assertion style (e.g. the `startRun` test at lines 101-123).
- Re-run `apps/api/tests/app.test.ts` in full; confirm the pre-existing work-item GET/PATCH test (lines 1132-1161) still passes unchanged (no backend change this sprint touches it).

## Out of scope

Any new browser/DOM UI test harness (none exists in this codebase, per Sprint 28's own already-disclosed finding — this task works within that existing constraint, does not introduce one).

## Acceptance

The full real `tests/e2e` suite green, file-by-file, with the actual file/test count recorded. `apps/api` and `apps/web` package test suites green, including the new route-level and client-wrapper tests.

## Actual results

Added `DEVOS-216: lists only the given run's own approvals at the route level, and denies a non-member` to `apps/api/tests/app.test.ts`'s existing `DEVOS-084: tenant isolation` describe block — creates a real `WorkflowRun`, two approvals (one for that run, one for a different run), confirms `GET /runs/:runId/approvals` returns only the matching one and 404s for a non-member. Added three new tests to `apps/web/tests/api-client.test.ts` for `getWorkItem`, `updateWorkItem`, and `listApprovalsForRun`, mirroring the file's own existing request-shape-assertion style. `apps/api` test suite: **81/81 green** (was 78 + the new test = 81 — no regression). `apps/web` test suite: **26/26 green** (was 23 + 3 new = 26). The full real `tests/e2e` suite: **27/27 files, 52/52 tests green**, exactly matching Sprint 30's own last-reported baseline — confirmed by a real run, not assumed, since none of these files are markup/DOM-dependent.
