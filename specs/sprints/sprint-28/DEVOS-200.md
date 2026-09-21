# DEVOS-200 — Governance visibility for applied reductions

**Priority:** P1 | **Estimate:** 1.5d
**Depends on:** DEVOS-199.
**Depended on by:** DEVOS-201 (the pilot confirms this view, not just the underlying data).

## Scope

Surfaces DEVOS-199's new `reliabilityEvidence` in the existing compliance-reporting surface, so a human reviewer can see which approvals had a reliability-based reduction applied and against which real evidence — an extension of an existing, real reporting mechanism, not a new one.

## Implementation

- `apps/api/src/routes/approvals.ts` (or wherever the existing approval-listing DTO is shaped): `toApprovalDto` gains an additive `reliabilityEvidence` field, mirroring how `evidenceReference` is already exposed today.
- `apps/web/src/pages/GovernancePage.tsx`: the existing compliance-reporting view (DEVOS-147/148) gains a column/section showing, per approval, whether a reliability-based reduction was checked, its outcome, and (when applied) the resulting `requiredApprovers` versus what the static/policy-tiered resolution would otherwise have required — reusing the page's existing data-fetching and table-rendering conventions, not a new page.

## Out of scope

Any new dashboard, chart, or aggregate statistic (e.g. "reductions applied this month") — this is per-approval visibility only, mirroring the granularity `GovernancePage.tsx` already provides for every other approval field.

## Acceptance

A real approval with `reliabilityEvidence` populated (from a unit/integration-test fixture) renders its outcome and evidence correctly in `GovernancePage.tsx`; an approval without `reliabilityEvidence` (every existing approval, and any new one from a node with no `reliabilityReduction` configured) renders exactly as it does today, with no new empty section. `pnpm --filter @devos/web --filter @devos/api typecheck test` green.
