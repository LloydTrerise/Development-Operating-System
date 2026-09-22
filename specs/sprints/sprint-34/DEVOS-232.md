# DEVOS-232 — Cost + Engineering Intelligence restyle

**Priority:** P2
**Source:** `specs/DEVOS-UI-UX-REDESIGN-BACKLOG.md` §6.6

## Acceptance summary

New theme's table/card patterns applied to both already-`Paper`-based pages.

## Scope

- `apps/web/src/features/cost/CostPage.tsx`: replace each section's plain `Typography variant="h6"` heading-above-`Paper` with this epic's own `PanelHeader` bordered title-bar convention (title rendered inside the `Paper`, with a bottom border, matching `GovernancePage.tsx`/`ProjectDetailPage.tsx`). Zero change to the budget-indicator, breakdown-dimension toggle, or breakdown-table logic.
- `apps/web/src/features/engineering-intelligence/EngineeringIntelligencePage.tsx`: same `PanelHeader` treatment for its four sections (This project, DORA metrics, Slowest workflows, This project's organisation). Zero change to quality/DORA/bottleneck computation or rendering logic.

## Out of scope

Any change to `getProjectCostSummary`/`getOrganisationCostReport`/`getProjectEngineeringReport`/`getOrganisationEngineeringReport`/`getSlowestWorkflows` call sites' logic. A shared `PanelHeader` component (each page keeps its own local copy, per this epic's established per-file convention).

## Validation

`pnpm --filter @devos/web typecheck lint build`. Manual verification against a real running dev server (Playwright) with real seeded cost/engineering-intelligence data: both pages render with the new panel styling, zero console errors, breakdown-dimension toggle still works.
