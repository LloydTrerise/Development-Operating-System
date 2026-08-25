# DEVOS-094 — Reliability hardening

**Priority:** P0 | **Estimate:** 1.5d
**Depends on:** DEVOS-093 (metrics baseline established first).

## Scope

"Retries, leases, idempotency and recovery" (source, verbatim). Retries (`MAX_TASK_ATTEMPTS`), idempotency (workflow-run/tool-invocation idempotency keys), and basic recovery (`reclaimStale`) already exist and were exercised further by DEVOS-092. This task's real, concrete scope — found by inspection before writing this file — is the "lease" half: **`TaskQueue.complete()`/`fail()` have no fencing against a stale reclaim.**

## Grounding

`packages/database/src/repositories/task-queue.ts`'s `reclaimStale()` judges staleness purely from a task's `started_at`, which is never renewed while a handler is genuinely still executing. `complete()`/`fail()` update a row by `id` alone, with no check that it is still `RUNNING` under the attempt the caller believes it holds. A real handler that legitimately runs longer than `staleThresholdMs` (a slow build, a slow real model call) gets incorrectly reclaimed and reprocessed by a second worker while the first is still alive — and the first worker's eventual, genuine completion then silently overwrites whatever the second worker already recorded.

## Flagged gap

No spec names a fencing-token/lease-epoch mechanism explicitly, but `specs/workflows/software-change-workflow.md`'s own retry rules and this repository's own reliability risk ("test restart, duplicate delivery, and idempotency before adding autonomy") both directly imply exactly this class of correctness gap must not exist. Fixed at the `TaskQueue` interface level: `complete()`/`fail()` take the attempt the caller claims to be completing, and only apply if the row still matches both `RUNNING` status and that attempt — otherwise it is a safe no-op, not silent corruption.

## Acceptance

A test reproduces the race (worker A claims, worker B's reclaim fires while A is still "working," A completes late) and confirms A's late completion is now correctly ignored rather than corrupting B's own outcome, verified against real Postgres.
