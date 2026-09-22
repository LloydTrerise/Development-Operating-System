# Sprint 32 — Approvals & Governance Restyle

**Source:** `specs/DEVOS-UI-UX-REDESIGN-BACKLOG.md` §6.4 (E28 UI/UX Redesign & Full Functional Coverage, fourth sprint).
**Conversion date:** 2026-09-22
**Status:** Converted per explicit user authorization ("start sprint 32", 2026-09-22). Depends on Sprint 29's theme/nav/`features/`/routing foundation (COMPLETE). Has no dependency on Sprint 31, though it does organically resolve a gap Sprint 31 disclosed — see below.

## Goal

Restyle the Approvals and Governance pages to the Nocturne mockup's own layout language. Unlike Sprint 31, this sprint closes **no** named backend/UI gap — per the backlog's own §2.3 coverage audit, "Approvals list/approve/reject" is fully covered and "DEVOS-199/200's approval reliability-reduction evidence is genuinely rendered in `GovernancePage.tsx`" already, confirmed not a gap. This is a pure restyle sprint on existing real data/logic, with one additive DTO field exposure (see DEVOS-218).

## Grounding (confirmed by direct code inspection before scoping)

- **The mockup's "Approval centre" screen** (`Design/DevOS.dc.html` lines 461-564) is a split-pane layout: a left list pane (filter tabs, each row showing a risk badge/type/age/subject/requester) and a right detail pane for the selected approval (title, risk + status badges, requester/run/time metadata, a "what will happen"/"target"/"why required"/"traceability" set of boxes, an evidence list, and a comment+Defer/Reject/Approve action bar).
- **Real data available per approval, per direct inspection of `apps/api/src/dto/approval.ts`'s `toApprovalDto`**: `id`, `projectId`, `workflowRunId`, `approvalType`, `status`, `requestedBy`, `decidedBy?`, `decisionReason?`, `evidenceReference`, `requestedAt`, `decidedAt?`, `requiredApprovers`, `reliabilityEvidence?`. The domain `Approval` type (`packages/domain/src/approval/approval.ts`) additionally carries `riskClass?`, `enforceSeparationOfDuties`, `expiresAt?`, `requiredRejections`, `agentId?`, `agentVersion?`, `workflowId?`, `workflowVersion?` — none of these are exposed via the DTO today. This sprint additively widens `toApprovalDto` with **`riskClass`** only (the one field the mockup's own risk badge needs), mirroring DEVOS-200's own precedent of additively widening this exact DTO for `requiredApprovers`/`reliabilityEvidence` — not a new route, not a new use case. `enforceSeparationOfDuties`/`expiresAt`/`requiredRejections`/agent/workflow attribution are not exposed, since the mockup's own restyled layout (below) doesn't need them and exposing unused fields would be scope creep.
- **No real data exists anywhere in this codebase for the mockup's "What will happen if you approve", "Approval target" grid, "Why approval is required" policy citation, or "Traceability" breadcrumb chain** — there is no per-approval stored consequence description, no per-approval policy-citation record (policies are evaluated dynamically, never persisted as "this approval exists because of policy X clause Y"), and no lineage/breadcrumb entity. These are omitted from the restyle, disclosed here rather than fabricated, the same discipline every prior sprint in this epic has applied. The **evidence list** (`evidenceReference.artifactVersionIds` resolved via the already-existing `getArtifactVersionById`) is real and is preserved from the current implementation.
- **"Defer" (mockup) has no real backend capability** — only `approveApproval`/`rejectApproval` exist; the restyled action bar keeps Approve/Reject/comment only, unchanged from today.
- **`ApprovalStatus` is a genuine closed enum** (`packages/contracts/src/status.ts:112`, `['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED']`) — unlike `WorkItemStatus`, the restyled filter tabs can safely be a fixed set (`All`/`Pending`/`Decided`), not data-derived chips.
- **This restyle organically resolves the real, disclosed-but-not-fixed gap from Sprint 31's own `DEVOS-217.md`**: `ApprovalsPage.tsx`'s unbounded Pending list (101 real approvals → a 42,442px page). A split-pane master/detail layout renders the list inside a fixed-height, internally-scrolling panel (the mockup's own `flex:1; overflow:auto` pattern, the same convention `RunCard`'s master task list already established in Sprint 31) instead of a page that grows without bound — the page itself no longer grows with the approval count. This is a natural side effect of the restyle, not a separately-scoped fix.
- **Sprint 31's `?approvalId=` scroll-to-highlight (`RunCard`'s "View approval" link) is preserved, not removed** — in the new split-pane layout it selects that approval into the detail pane directly (a strictly better outcome than scrolling a flat list, since the target is no longer buried in an unbounded page).
- **The mockup's "Governance" screen** (`Design/DevOS.dc.html` lines 650-713) is a 3-panel layout: Policies (top-left), Risk activity (top-right), Audit trail (full-width, bottom, columns Time/Actor/Action/Target/Outcome/Correlation).
- **Every Governance mockup field has a real backing source, confirmed by direct inspection**: `AuditRecord` (`api-client.ts:839-852`) already carries `actorId`/`actorType`, `action`, `targetType`/`targetId`, `outcome`, `createdAt`, and — matching the mockup's "Correlation" column exactly — `correlationId?`. `GovernancePage.tsx`'s own existing "Risk activity" section (`riskActivity = auditRecords.filter(r => r.outcome === 'FAILURE')`) already matches the mockup's Risk activity panel precisely — real, not fabricated, since DEVOS-090 originally built it. The existing "Compliance report" section (filterable, CSV-exportable, organisation-scoped audit table) is richer than the mockup's plain Audit trail table and is preserved, restyled to the mockup's column set (all real fields) rather than rebuilt.
- **`Policy` has no `scope`/`enforced` field** (`api-client.ts:764-775`) — the mockup's `p.scope` (e.g. "Project-wide") is derivable from which of the two already-separate policy lists (project vs. organisation) a row comes from; `p.enforced` (implying an evaluation count) has no real data source anywhere in this codebase and is omitted, disclosed, not fabricated.
- **The backlog's own DEVOS-219 acceptance text explicitly requires preserving the existing reliability-reduction evidence display** ("already real, per §2.3... preserved and restyled, not rebuilt") even though the mockup's own Governance screen has no Approvals section at all. Per that explicit instruction, this sprint keeps a compact "Reliability-reduction evidence" panel on the restyled Governance page (filtered to only the approvals that actually have `reliabilityEvidence` populated — a real, narrow, valuable subset, not a duplicate of DEVOS-218's own full Approvals page) as a fourth panel beyond the mockup's literal three, rather than dropping real, backlog-mandated functionality to match the mockup exactly.

## In scope

- **DEVOS-218** — Approvals restyle: split-pane layout on `ApprovalsPage.tsx`, additively widening `toApprovalDto`/the frontend `Approval` type with `riskClass`.
- **DEVOS-219** — Governance restyle: 3-panel mockup layout (Policies, Risk activity, Audit trail) plus a preserved fourth Reliability-reduction-evidence panel, on `GovernancePage.tsx`.
- **DEVOS-220** — Cross-check existing e2e/UI coverage, same discipline as Sprint 31's DEVOS-216, scoped to Approvals/Governance.
- **DEVOS-221** — Validation, documentation, and gap disclosure.

## Out of scope

Any new backend route or use case. The mockup's "What will happen"/"Approval target"/"Why required"/"Traceability" boxes (no real data source). A "Defer" action (no real capability). `Policy`'s missing evaluation-count field. Any change to the policy-authoring form, publish/preview-simulation, or compliance CSV-export functionality beyond visual restyle.

## Task index

| ID        | Story                                    | File           |
| --------- | ----------------------------------------- | -------------- |
| DEVOS-218 | Approvals restyle                          | `DEVOS-218.md` |
| DEVOS-219 | Governance restyle                         | `DEVOS-219.md` |
| DEVOS-220 | Cross-check existing e2e/UI coverage       | `DEVOS-220.md` |
| DEVOS-221 | Validation, documentation, and gap disclosure | `DEVOS-221.md` |
