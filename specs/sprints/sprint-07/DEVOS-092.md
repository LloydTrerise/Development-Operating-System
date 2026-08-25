# DEVOS-092 — Operational recovery tests

**Priority:** P0 | **Estimate:** 1d
**Depends on:** DEVOS-091 (last implementation task of the sprint).

## Scope

"DB/queue/worker failure scenarios" (source, verbatim). `tests/e2e/hardening.test.ts` (DEVOS-024) already covers concurrent-claim safety, stale-task reclaim, and max-attempts exhaustion. This task adds genuinely new scenarios not yet covered: a worker process killed mid-task (simulating a hard crash, not a graceful stop) and its task correctly reclaimed by a second worker; and a transient database connection failure during task processing not permanently wedging the queue.

## Grounding

`specs/architecture/repository-code-structure.md`'s task-queue/outbox design; `AGENTS.md`/constitution's reliability risk ("test restart, duplicate delivery, and idempotency before adding autonomy").

## Flagged gap

The exact scenario set is not enumerated in the specs beyond "DB/queue/worker failure scenarios" — the two scenarios above are chosen because they are the two realistic failure modes not already exercised by DEVOS-024, and both are testable against real infrastructure (a real spawned worker subprocess, a real Postgres instance) without fabricating a scenario no real infrastructure here can produce.

## Acceptance

Both new scenarios pass against real Postgres and a real spawned worker process (not mocks): a hard-killed worker's claimed task is reclaimed and completed by a surviving worker; a transient DB error during processing does not leave the task queue permanently stuck.
