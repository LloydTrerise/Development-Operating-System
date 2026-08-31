# DEVOS-114 — Wire a real rollback trigger

**Priority:** P1 | **Estimate:** 1d
**Depends on:** None (Sprint 8 complete).

## Scope

`runReleaseRollbackTask` (`packages/application/src/tasks/run-release-task.ts`, DEVOS-077) is a callable, tested function not wired into any seeded workflow node or UI action. Wire a real trigger — either a UI action on a failed/completed release (the more immediately useful option, given `apps/web` already has a Runs page) or a workflow node reachable from a failed release stage.

## Grounding

`DEVOS-PRODUCTION-READINESS-ROADMAP.md` E3, Sprint 6 item 8 — "never exercised beyond one manual call."

## Flagged gap

None expected — the function itself is already real and tested; this task is purely about giving it a real caller.

## Acceptance

A real, failed (or intentionally superseded) release can be rolled back by an authorized user through a real UI action, without any direct function call or test-only invocation — the rollback's own real evidence (per `DEVOS-077`'s existing `action: "rollback"` `RELEASE_EVIDENCE` record) is produced through this new real path.
