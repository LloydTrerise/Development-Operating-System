# DEVOS-218 — Approvals restyle

**Priority:** P1 | **Estimate:** 1.5d
**Depends on:** none (Sprint 29's `features/` structure and Nocturne theme already exist).
**Depended on by:** none within this sprint.

## Scope

Restyle `ApprovalsPage.tsx` into the mockup's split-pane "Approval centre" layout, on existing real data/logic, additively exposing one new real field (`riskClass`) the mockup's risk badge needs.

## Implementation

- `apps/api/src/dto/approval.ts`: `toApprovalDto` additively gains `riskClass: approval.riskClass` (undefined when unset — every approval created before this field existed, or by a path that never sets it, is unaffected). No route or use-case change.
- `apps/web/src/api-client.ts`: the `Approval` interface gains `riskClass?: string`.
- `ApprovalsPage.tsx` restyled to a two-pane layout:
  - **Left pane**: a fixed-height, internally-scrolling list (real filter tabs — `All`/`Pending`/`Decided`, a safe closed-set filter since `ApprovalStatus` is a genuine enum), each row showing `approvalType`, a relative "age" derived from `requestedAt`, `requestedBy`, and a risk badge when `riskClass` is present. Selecting a row sets the selected approval.
  - **Right pane**: the selected approval's detail — `approvalType`, status chip, `requestedBy`/`requestedAt`, `workflowRunId` (linking to `/runs`, mirroring `RunCard`'s own reverse link from Sprint 31), the real evidence list (unchanged from today: `evidenceReference.artifactVersionIds` resolved via `getArtifactVersionById`), `requiredApprovers`/`reliabilityEvidence` when present, and the existing comment + Approve/Reject action bar (unchanged behavior).
- `?approvalId=` query-parameter handling (Sprint 31's DEVOS-215) is preserved: when present and matching a loaded approval, that approval is selected into the detail pane directly (replacing the prior scroll-to-highlight, which is no longer needed once only one approval renders in detail at a time).

## Out of scope

The mockup's "What will happen if you approve", "Approval target" grid, "Why approval is required" policy citation, and "Traceability" chain (no real data source anywhere in this codebase — see README grounding). A "Defer" action. Any change to `approveApproval`/`rejectApproval` themselves.

## Acceptance

`pnpm --filter @devos/api typecheck lint test build` and `pnpm --filter @devos/web typecheck lint build` clean. A real dev-server check: the left pane lists real approvals with working filter tabs inside a bounded, internally-scrolling panel (confirmed the page itself no longer grows with the real approval count); selecting a row shows its real detail, including real evidence; a real Approve/Reject decision persists as before; navigating to `/approvals?approvalId=<id>` selects that approval directly.

## Actual results

`toApprovalDto` additively gained `riskClass`; the frontend `Approval` interface mirrors it. `ApprovalsPage.tsx` rewritten to the split-pane layout: a bounded, internally-scrolling list pane (`Approval centre`, filter chips All/Pending/Decided, each row's relative age/requester/risk-badge-when-present) and a detail pane for the selected approval (status/risk chips, requester/decider/reason, `workflowRunId` with a `view runs` link, `requiredApprovers`/`reliabilityEvidence` when present, the real evidence list unchanged, and the existing comment + Approve/Reject action bar for `PENDING` approvals). `?approvalId=` now selects the linked approval directly into the detail pane (replacing Sprint 31's scroll-to-highlight).

`pnpm --filter @devos/api typecheck lint build` and `pnpm --filter @devos/web typecheck lint build` all clean. `apps/api` test suite 81/81 green, `apps/web` test suite 26/26 green — no regression (both suites unchanged by this task; DEVOS-220 adds new coverage).

Real dev-server check against the real seeded project (477 real approvals, 101 pending): the list pane renders and scrolls internally; filter chips correctly narrow to 101 rows on "Pending"; the detail pane shows real evidence (artifact name/type resolved via the unchanged `getArtifactVersionById`) and, for a pending approval, working Comment/Approve/Reject controls. **Confirmed the Sprint 31 gap is genuinely resolved, not just theoretically**: the page's own `document.body.scrollHeight` is **720px** in both light and dark mode (down from Sprint 31's disclosed 42,442px), since only the list panel scrolls now, not the page. The `?approvalId=<id>` deep link was verified to select and display the correct approval's detail. Zero console errors throughout.
