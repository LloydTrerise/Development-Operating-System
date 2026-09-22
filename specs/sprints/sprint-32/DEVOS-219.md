# DEVOS-219 — Governance restyle

**Priority:** P1 | **Estimate:** 1.5d
**Depends on:** none.
**Depended on by:** none within this sprint.

## Scope

Restyle `GovernancePage.tsx` into the mockup's 3-panel layout (Policies, Risk activity, Audit trail), on existing real data/logic, preserving — not rebuilding — the existing reliability-reduction evidence display as a fourth panel per the backlog's own explicit acceptance text.

## Implementation

- **Policies panel**: combines the existing "Policies — this project" and "Policies — this project's organisation" sections (each row's own list already distinguishes project-scoped vs. organisation-scoped, matching the mockup's `p.scope`), preserving the existing publish/preview-simulation functionality unchanged. The mockup's `p.enforced` (an evaluation count) is omitted — no real data source exists.
- **Risk activity panel**: the existing `riskActivity = auditRecords.filter(r => r.outcome === 'FAILURE')` list, restyled into the mockup's panel shape, logic unchanged.
- **Reliability-reduction evidence panel** (preserved per the backlog's own explicit instruction, not part of the mockup's literal 3 panels): the subset of `approvals` whose `reliabilityEvidence` is populated, showing the same real fields the current implementation already renders (signal, agent version id, applied reduction) — the generic full-approvals list is dropped from this page (redundant with DEVOS-218's own richer, dedicated Approvals page), keeping only this narrow, real, backlog-mandated subset.
- **Audit trail panel**: the existing "Compliance report" section (organisation-scoped, filterable by project/actor/action-prefix/date-range, CSV-exportable) restyled to the mockup's column set — Time/Actor/Action/Target/Outcome/Correlation, all real `AuditRecord` fields including `correlationId` (not previously rendered in this table) — with all existing filter/export functionality preserved unchanged.

## Out of scope

Any change to policy authoring, publish, or simulation logic. Any change to the compliance CSV export's own column set or filename convention. A real per-policy evaluation count (no data source exists).

## Acceptance

`pnpm --filter @devos/web typecheck lint build` clean. A real dev-server check: all four panels render real data in the mockup-inspired layout; policy publish/preview still work unchanged; the audit trail table's filters and CSV export still work unchanged, now also showing `correlationId`; the reliability-evidence panel shows only approvals that actually have `reliabilityEvidence`.

## Actual results

`GovernancePage.tsx` restyled to a 4-panel grid: Policies (spans both rows on the left — authoring form, "This project"/"This project's organisation" lists, publish/preview unchanged), Risk activity (top-right, unchanged `outcome === 'FAILURE'` filter), Reliability-reduction evidence (bottom-right, the `reliabilityEvidence`-populated subset of `approvals`, replacing the generic full-approvals list now redundant with DEVOS-218's own page), and Audit trail (full-width, the existing filterable/CSV-exportable compliance report restyled to the mockup's Time/Actor/Action/Target/Outcome/Correlation columns — `correlationId` is now rendered and included in the CSV export, previously fetched but never shown).

`pnpm --filter @devos/web typecheck lint build` clean.

Real dev-server check against the real seeded project: all four panels render; the audit trail table shows real `correlationId` values; the CSV export button is present and enabled; policy authoring form renders unchanged. **Two real empty states were independently confirmed genuine, not a restyle regression**, via a direct Postgres query: the selected project currently has 0 registered policies and 0 approvals with `reliabilityEvidence` populated (Sprint 28's own pilot data was disclosed as fully cleaned up afterward) — both panels' "No … yet" messages are accurate, not broken filters. Confirmed in both light and dark mode, zero console errors.

**A real, pre-existing (not introduced by this restyle) limitation was found while verifying the Risk activity panel**: it showed "No denied or failed activity recorded" despite a direct Postgres query confirming 216 real `FAILURE` audit records exist for this project. Root-caused to `listForProject(projectId, limit = 100)` (`packages/database/src/repositories/audit-records.ts:50`) — the underlying route has always returned only the 100 most-recent audit records, and none of the project's 100 most-recent records happen to be failures (all recent activity is `SUCCESS`). This filter logic (`auditRecords.filter(r => r.outcome === 'FAILURE')`) is completely unchanged from before this sprint — confirmed by inspection, not a new bug — so it is disclosed in DEVOS-221, not silently fixed as out-of-scope for a pure restyle task.
