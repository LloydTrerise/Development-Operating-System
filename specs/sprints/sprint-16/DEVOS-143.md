# DEVOS-143 — Multi-approver (N-of-M) approval support

**Priority:** P0 | **Estimate:** 3d
**Depends on:** None (Sprint 15 complete).
**Depended on by:** DEVOS-144 (separation-of-duties needs a per-decision record), DEVOS-146 (risk-tiered routing sets `requiredApprovers`), DEVOS-148 (the pilot's own two-distinct-approvers scenario).

## Scope

`Approval` gains a real requirement for more than one distinct decider before resolving; `decideApproval` records each real decision and only transitions the approval to its terminal state once the configured threshold of distinct approvers is met — reusing the existing atomic decision/run-transition transaction (DEVOS-111) unchanged, extended rather than replaced.

## Real design decision (see `README.md`'s grounding for the full reasoning)

A new child table `approval_decisions` (migration `0033_approval_decisions.ts`) records every individual decision; `approvals` gains `required_approvers integer NOT NULL DEFAULT 1`. A `REJECTED` decision from any single decider fails the approval immediately (fail-fast — a flagged assumption, no spec states an N-of-M rejection threshold). An `APPROVED` decision only finalizes the approval (calling the existing, unmodified `decideApprovalAndTransition`) once the count of distinct `APPROVED` deciders reaches `requiredApprovers`; before that, it only records the decision (a new `ApprovalRepository.recordDecision`) and the approval stays `PENDING`.

## Implementation

- `packages/domain/src/approval/approval.ts`: `Approval.requiredApprovers: number`; new `ApprovalDecisionRecord { id, approvalId, decidedBy, decision: 'APPROVED' | 'REJECTED', reason?, decidedAt }`; `ApprovalRepository` gains `recordDecision(record)` and `listDecisionsForApproval(approvalId)`.
- `packages/database/migrations/0033_approval_decisions.ts`: new `approval_decisions` table + `approvals.required_approvers` column (backfilled `1` for every existing row via the column default).
- `packages/database/src/repositories/approvals.ts`: implements the two new methods against the new table.
- `packages/application/src/approval/decide-approval.ts`: restructured — checks the decider hasn't already decided this approval (a distinct-approver rule; the same principal deciding twice can never fake reaching a threshold), records the decision, then either finalizes (REJECTED, or APPROVED at threshold) or returns the still-`PENDING` approval unchanged.
- `requestApproval`/`runApprovalTask` both default `requiredApprovers` to `1` — every existing PLANNING/RELEASE/node-scoped approval is unaffected until DEVOS-146 actually sets a higher value.
- Every fake `ApprovalRepository` test double across the repo gains the two new methods (mechanical, matching the DEVOS-139/141 interface-widening precedent).

## Out of scope

Wiring `requiredApprovers` to any real risk signal (DEVOS-146's own job). A UI for viewing multi-approver progress (deferred — `Approval`'s existing shape is still what `ApprovalsPage.tsx`/`GovernancePage.tsx` render; a "N of M approved" indicator is a real, disclosed gap left for a future task if the user wants it).

## Acceptance

A real approval created with `requiredApprovers: 2`; a first real `APPROVED` decision from one principal leaves it `PENDING` (run untouched); a second real `APPROVED` decision from a *different* principal finalizes it `APPROVED` (run transitions via the existing, unmodified `decideApprovalAndTransition`). A real `REJECTED` decision from any principal finalizes it `REJECTED` immediately regardless of `requiredApprovers`. The same principal attempting to decide twice is rejected. Every existing single-approver (`requiredApprovers: 1`, the default) approval test continues to pass unmodified.
