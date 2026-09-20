# DEVOS-165 — Quality trends dashboard UI

**Priority:** P1 | **Estimate:** 3d
**Depends on:** DEVOS-164 (API routes).
**Depended on by:** DEVOS-171 (Sprint 21 extends this same page with DORA/bottleneck sections).

## Scope

A new `EngineeringIntelligencePage.tsx`, reusing `CostPage.tsx`/`GovernancePage.tsx`'s established page pattern (project/organisation selector, a real API call on mount, a real loading/error state), rendering DEVOS-164's project and organisation engineering reports: review pass-rate, rework-cycle count, test/security pass rates, deploy/rollback counts.

## Implementation

- `apps/web/src/api-client.ts`: add `getProjectEngineeringReport(projectId)`/`getOrganisationEngineeringReport(organisationId)` wrapper functions, matching `getProjectCostSummary`/`getOrganisationCostReport`'s existing wrapper shape exactly.
- `apps/web/src/pages/EngineeringIntelligencePage.tsx` (new): a project-scoped view and an organisation-scoped view (matching `CostPage.tsx`'s own dual-scope layout), rendering the report's real numbers — pass-rate bars/figures, a rework-cycle count, deploy/rollback counts. No charting library dependency beyond whatever `CostPage.tsx`/`GovernancePage.tsx` already use, if any (confirm during implementation and record the choice; this task does not add a new dependency unless the existing pages already have one to reuse).
- Route wiring into `apps/web/src/App.tsx`'s existing route table and navigation, matching the existing page-registration pattern.

## Out of scope

Any DORA/bottleneck chart (Sprint 21's job — this page is extended there, not duplicated). Any new charting dependency not already present in this codebase.

## Acceptance

`pnpm --filter @devos/web typecheck build` green. A real running dev server (`apps/api` + `apps/web`) shows real project and organisation engineering-report data for a real project/organisation with real evidence artifacts, confirmed either via a real browser check or, if this session's own environment repeats the DEVOS-160-disclosed canvas-rendering limitation, via the same "typecheck/build clean, mirrors an already-proven pattern" fallback verification DEVOS-160 itself used, disclosed identically if invoked.
