# DEVOS-144 — Separation-of-duties enforcement

**Priority:** P0 | **Estimate:** 1d
**Depends on:** DEVOS-143 (the per-decision record this check runs against).
**Depended on by:** DEVOS-146 (sets the flag from risk-tiered policy configuration), DEVOS-148 (the pilot's own scenario may exercise it).

## Scope

`decideApproval` rejects a decision where the deciding identity is the same identity that requested the approval (Security spec §5: "the requester and approver should be distinct identities where organisational policy requires separation of duties") — configurable per approval, off by default to preserve every existing Sprint 1–15 test's own single-approver behaviour.

## Implementation

- `packages/database/migrations/0034_approvals_separation_of_duties.ts`: `approvals.enforce_separation_of_duties boolean NOT NULL DEFAULT false`.
- `packages/domain/src/approval/approval.ts`: `Approval.enforceSeparationOfDuties: boolean`.
- `decide-approval.ts`: when `approval.enforceSeparationOfDuties` is true and `principalId === approval.requestedBy`, throws `ForbiddenError` before recording any decision.
- `requestApproval`/`runApprovalTask` both default the flag to `false`.

## Out of scope

Configuring the flag from a real organisation policy (DEVOS-146's own job — this task only proves the enforcement mechanism works once the flag is set true, by whatever means).

## Acceptance

A real approval created with `enforceSeparationOfDuties: true`: the same principal who requested it is rejected (`ForbiddenError`) when attempting to decide it; a different principal succeeds normally. A real approval with the default `false` flag is decidable by its own requester, exactly as every existing test already assumes (no regression).
