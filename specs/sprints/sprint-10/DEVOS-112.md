# DEVOS-112 — Implement the planning re-planning loop

**Priority:** P1 | **Estimate:** 2d
**Depends on:** None (Sprint 8 complete).

## Scope

Today, a rejected planning approval fails the run outright. Implement a real re-planning loop: a rejected planning approval starts a new planning-path run scoped to the same work item, mirroring `runReviewAgentTask`'s own already-working CHANGES_REQUIRED rework-run pattern (`packages/application/src/tasks/run-review-agent-task.ts`) — that function already demonstrates "a decision starts a new run for the same work item" using this codebase's own `WorkflowUseCaseDeps` shape.

## Grounding

`DEVOS-PRODUCTION-READINESS-ROADMAP.md` D5, Sprint 3 item 6 — "the spec's own 'Changes Requested' re-planning loop is not implemented," referencing `specs/workflows/software-change-workflow.md`'s own documented lifecycle.

## Flagged gap

`MAX_AUTOMATIC_REWORK_CYCLES` (`packages/application/src/tasks/run-review-agent-task.ts`) bounds the existing development rework loop at a flagged, spec-unstated constant (`DEVOS-PRODUCTION-READINESS-ROADMAP.md` E1). Apply the same bounding discipline to this new re-planning loop — do not ship an unbounded retry path where a bounded one already exists as a working precedent.

## Acceptance

A rejected planning approval, on a real workflow run, starts a genuinely new planning-path run for the same work item rather than failing the original run; a bound exists and is tested (the loop terminates with a clear failure state after the configured maximum, exactly like the development rework loop already does).
