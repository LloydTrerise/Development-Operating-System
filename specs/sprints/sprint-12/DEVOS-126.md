# DEVOS-126 — Real end-to-end pilot run

**Priority:** P0 | **Estimate:** 2d
**Depends on:** DEVOS-125 (seeded `ProjectType`/templates).

## Scope

A real project of the new `incident-response` type is created (proving the clone pipeline for real, not just at the template level — DEVOS-125 only proves the templates exist), and its cloned `incident-response` workflow is run to completion end to end, exercising every Sprint 11 primitive together — live-verified against real Postgres, mirroring this codebase's own DEVOS-100/108/E19 pilot-verification convention.

## Real precondition found during DEVOS-125's implementation

`remediation`'s `rollback` handler (`runReleaseRollbackTask` → `performRelease` → `resolveReleaseTarget`) requires the project to have either a real `Deployment` integration or a real `Git` integration (`repositoryPath`/`releaseEnvironment`/`stagingRoot`) registered, or it fails with a clear error. This pilot's new `incident-response`-typed project must register a local Git integration (the same local-staging pattern every prior sprint's release/rollback test already sets up) before the high-severity scenario's `remediation` step can succeed — not a new precondition this sprint introduces, just one this task's own real run must satisfy.

## Grounding

Follows the exact harness pattern the five Sprint 11 e2e files already established (`tests/e2e/condition-node.test.ts` and its four siblings, per the handoff's own documented convention): `spawnSync` migrate+seed in `beforeAll`, `createProjectRepository`, a local `startRunFixture` that computes `dependsOn`/`dependsOnTerminalOnly` manually (these tests bypass the application-layer use case), a real `createTaskDispatcher` with a short `pollIntervalMs`. This task additionally needs to create a real project of the new type (not just start a run against the pre-existing seeded project), exercising `create-project.ts`'s clone pipeline for the first time against a non-`software-development` type.

## Required real scenarios

1. **High-severity run** (`severity: 'high'`, a real `rollbackToRevision` supplied): `severity-check` takes the `high` branch; `diagnose`/`notify` both run concurrently under `diagnose-and-notify`; `diagnosis-join` (tolerant) proceeds once both reach a terminal state; `await-confirmation` genuinely elapses real wall-clock time (an assertion in the same style as DEVOS-121's own `>=900ms` proof); `remediation-approval` creates a real, policy-gated approval request mid-branch, is decided through the existing unchanged approval-decision API, and `remediation` (`rollback`) then runs and succeeds; `log-only` (the untaken branch) reaches `SKIPPED`; the run completes.
2. **Low-severity run** (`severity: 'low'`): `severity-check` takes the `low` branch; `log-only` runs and succeeds; `diagnose-and-notify`/`diagnose`/`notify` reach `SKIPPED` (DEVOS-119/123's one-hop-then-cascade mechanism). **Real finding from live-verifying this scenario, corrected from an earlier draft of this task's own acceptance summary:** `diagnosis-join`, `await-confirmation`, `remediation-approval`, and `remediation` do **not** cascade to `SKIPPED` — a tolerant `JOIN`'s handler (`runJoinTask()`) unconditionally returns `SUCCEEDED` once its dependencies reach any terminal state (including `SKIPPED`), so everything downstream of it genuinely executes for real regardless of why its upstream branches were terminal. This run therefore also creates a real approval request and requires the same decision as the high-severity run before it completes. See `README.md`'s updated design notes and the corrected `tests/e2e/incident-response-workflow.test.ts` assertions.
3. **Tolerant-`JOIN`-under-real-failure run**: a variant of scenario 1 where `notify` is made to fail (a deliberate, controlled failure — not a flaky/incidental one) — `diagnosis-join`'s `tolerant` policy still lets the run proceed past it to `await-confirmation`/`remediation-approval`/`remediation`, mirroring DEVOS-120's own exit-criterion style ("including one deliberately-failing branch") for this new graph shape specifically.

## Real bug found and fixed during this task's own implementation

`log-only`'s taskKey (the node's own `id` in `SEED_INCIDENT_RESPONSE_WORKFLOW_GRAPH`) is `log-only`, but `apps/worker/src/tool-task-router.ts`'s `routeToolTask` switch (added in DEVOS-125) originally routed a different string, `incident-log` — a real mismatch that a plain typecheck/lint/unit-test pass could not catch (nothing in those checks exercises a live dispatch by taskKey), only surfaced by actually running the workflow end to end. Fixed by matching the switch case to the real node id (`log-only`); `DEVOS-124.md`/`DEVOS-125.md` corrected to match. This is exactly the class of gap DEVOS-108/Sprint-9's own "no reaching into internals" real-dispatch testing convention exists to catch.

## Out of scope

A UI walkthrough (E21). Any new real external provider.

## Acceptance

All three scenarios above pass for real against Postgres, each as its own `tests/e2e/incident-response-workflow.test.ts` test case, run via `pnpm --filter @devos/e2e-tests test` per this codebase's own established e2e-suite invocation convention (never `vitest run --config ../../vitest.config.ts` directly, per the fileParallelism caveat already documented for every prior e2e file). **Confirmed: all 4 tests in the new file pass for real against Postgres** (the fourth being the workflow-shape assertion in scenario/test 0, confirming the clone pipeline cloned the graph verbatim).
