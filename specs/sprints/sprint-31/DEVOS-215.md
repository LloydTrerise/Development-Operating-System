# DEVOS-215 — Run-scoped approval visibility

**Priority:** P0 | **Estimate:** 0.5d
**Depends on:** DEVOS-214 (adds this to the restyled `RunCard`).
**Depended on by:** none within this sprint.

## Scope

Surface a run's own pending/resolved approval(s) directly on its `RunCard`, using the already-existing, already-route-implemented (but frontend-unwired and route-test-uncovered) `GET /runs/:runId/approvals` route. Per direct grounding (README), the backend gap the backlog names does not exist — the real gaps are the missing frontend client wrapper, the missing UI, and missing route-level test coverage (closed by DEVOS-216).

## Implementation

- `apps/web/src/api-client.ts`: add `listApprovalsForRun(runId): Promise<ApiResult<Approval[]>>` (`GET /api/v1/runs/:runId/approvals`), mirroring `listApprovalsForProject`'s existing style.
- `RunCard.tsx` (from DEVOS-214): fetch the run's own approvals (same poll cycle as the rest of the card's data) and render them — status (`StatusChip`), `approvalType`, requester, and a link to `/approvals?approvalId=<id>`.
- `ApprovalsPage.tsx`: read an optional `approvalId` query parameter (`useSearchParams`); when present and matching a loaded approval (in either the Pending or Decided list), scroll it into view and apply a visible highlight — a real, working "full Approval detail" destination given no per-approval detail route exists anywhere in this app yet (see README grounding on why a new `/approvals/:id` route is out of this sprint's scope).

## Out of scope

A new `/approvals/:id` detail route/component (deferred — see README). Any change to the approval decision flow itself (`approveApproval`/`rejectApproval`, already correct). Any change to `listApprovalsForRun`'s application-layer behavior (already correct and already unit-tested).

## Acceptance

`pnpm --filter @devos/web typecheck lint build` clean. A real dev-server check: a run with a real pending approval shows it on its own `RunCard`; clicking through to `/approvals?approvalId=<id>` lands on the Approvals page with that approval scrolled into view and highlighted.

## Actual results

`pnpm --filter @devos/web typecheck lint build` clean. `listApprovalsForRun` added to `api-client.ts`, covered by a new test in `apps/web/tests/api-client.test.ts` (DEVOS-216). Real dev-server check against a real, already-existing `AWAITING_APPROVAL` run (found via a direct Postgres query for a real `PENDING` approval in the seeded project): the run's own `RunCard` correctly showed "Approval — RELEASE, requested by devos-worker" with a `PENDING` status chip and a "View approval" link; clicking it navigated to `/approvals?approvalId=<realId>`, and the target approval card was confirmed genuinely scrolled into view and highlighted (verified both via a real `window.scrollY` assertion and a real screenshot showing the highlighted card, its real evidence, and Approve/Reject controls). Zero console errors.
