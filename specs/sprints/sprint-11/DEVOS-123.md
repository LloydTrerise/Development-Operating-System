# DEVOS-123 — Generalize dependency-aware task readiness for branches

**Priority:** P1 | **Estimate:** 2d
**Depends on:** DEVOS-119 (`SKIPPED` status), DEVOS-120 (`JOIN`'s multi-branch dependency shape).

## Scope

`claimNext()`'s existing `dependsOn` barrier (Sprint 9 loose ends) correctly accounts for a `SKIPPED` upstream task — a task depending on the untaken branch of a `CONDITION` (DEVOS-119) must itself become `SKIPPED`, not wait forever — and for a `JOIN`'s multi-branch dependency shape from DEVOS-120 (a branch-failure-tolerant join's own downstream must not wait forever on a `SKIPPED`/`FAILED` branch it was configured to tolerate).

## Grounding

`claimNext()`'s SQL barrier (`packages/database/src/repositories/task-queue.ts`) currently requires every named `dependsOn` task to have reached exactly `SUCCEEDED`. This is DEVOS-119's own explicitly disclosed limitation carried forward: "such a downstream task would currently wait forever until DEVOS-123 lands." This task closes that gap, generalizing (not replacing) the existing barrier and `resolveTaskFailure`'s sibling-cancellation logic (`task-queue.ts`) so a chain of `CONDITION`/`JOIN` nodes propagates `SKIPPED`/terminal status correctly however many hops deep.

## Out of scope

Anything not already introduced by DEVOS-119/120 (no new node types).

## Acceptance

A real graph with a task two hops downstream of an untaken `CONDITION` branch reaches `SKIPPED` (not left `PENDING` forever) and the run still completes, proven against real Postgres. A real graph with a branch-tolerant `JOIN` whose downstream task depends on that join's own output does not wait forever when the tolerated branch is `SKIPPED`/`FAILED`.
