# DEVOS-111 — Make approval-decide and run-transition one atomic transaction

**Priority:** P1 | **Estimate:** 1d
**Depends on:** None (Sprint 8 complete). Independent of `DEVOS-110`, though both touch `decide-approval.ts`.

## Scope

`decideApproval` and the resulting workflow-run status transition (`transitionAfterApprovalDecision`, `packages/database/src/repositories/approval-run-transition.ts`) currently execute as two sequential operations. Wrap them in a single database transaction so a crash between the two can no longer leave an approval decided but the run not transitioned (or vice versa).

## Grounding

`DEVOS-PRODUCTION-READINESS-ROADMAP.md` D4, Sprint 3 item 6 — "explicitly scoped out," described there as "a currently theoretical window," not an observed production incident.

## Flagged gap

None expected — `withTransaction` (`packages/database/src/repositories/base.ts`) is already this codebase's established pattern for exactly this shape of "two related writes, one transaction" (see `createProjectWithClonesCreator`, `createWorkflowDraftCreator`).

## Acceptance

A real test that kills the process (or otherwise forces a failure) between the decide-write and the transition-write confirms neither is left in a half-applied state — the transaction either fully commits or fully rolls back.
