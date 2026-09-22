# DEVOS-223 — Workflows + Workflow Library restyle

**Priority:** P1 | **Estimate:** 1d
**Depends on:** none.
**Depended on by:** DEVOS-224 (adds a "Run this version" action to the Library's restyled version-history section).

## Scope

Restyle `WorkflowsPage.tsx`'s definition-picker list and `WorkflowLibraryPage.tsx`'s table to the Nocturne table/list visual language already established by `WorkItemsPage.tsx`/`ApprovalsPage.tsx`'s own restyles (Sprint 31/32) — no named mockup layout exists for either (see README grounding).

## Implementation

- `WorkflowsPage.tsx`: the definition-picker `List` (currently a bare `ListItemButton` list, `maxWidth: 360`) restyled to the established list-panel convention (surfaced panel, consistent row spacing/typography, status indication via the existing `StatusChip` where a definition's `latestVersionStatus`-equivalent is available).
- `WorkflowLibraryPage.tsx`: the existing dense `Table` (name/project/type/status/versions/run-health/actions, with an expandable version-history row) restyled for typography/spacing/color consistency with the Nocturne theme tokens; no change to its filtering, search, run-health summarization, clone, or version-history-expansion logic.
- Both pages' existing loading/error states (`LoadingState`/`ErrorAlert`) unchanged in behavior, restyled only where the shared components themselves already carry theme tokens (no page-specific override needed).

## Out of scope

Any change to `WorkflowsPage.tsx`'s draft/version-loading logic, `WorkflowLibraryPage.tsx`'s filtering/search/clone logic, or the run-health summarization algorithm. DEVOS-222's own Designer 3-column layout (separate task). DEVOS-224's own new "Run this version" action (separate task, added here structurally but implemented there).

## Acceptance

`pnpm --filter @devos/web typecheck lint build` clean. A real dev-server check: both pages render with the restyled visual language, all existing functionality (definition selection, search/filter, clone, version-history expansion) still works unchanged. Zero console errors, both light and dark mode.

## Actual results

`WorkflowsPage.tsx`'s definition-picker list wrapped in a bordered `Paper`, each row now showing the workflow key as a monospace secondary line via `ListItemText`'s `secondary` slot instead of inline in the primary text. `WorkflowLibraryPage.tsx`'s table wrapped in a bordered `Paper` with a new local `PanelHeader` (title + "N of M shown" meta caption), mirroring `GovernancePage.tsx`'s own DEVOS-219 panel-header convention exactly (duplicated locally, not extracted to a shared component, matching that same precedent of per-page local `PanelHeader` functions rather than a premature shared abstraction). No change to either page's filtering, search, clone, or version-history logic.

`pnpm --filter @devos/web typecheck lint build` clean. A real dev-server check confirmed both pages render correctly with all existing functionality intact (definition selection, search/filter, clone, version-history expansion), zero console errors.

**A real, pre-existing bug was found and fixed while verifying this task's own expanded version-history rows** (surfaced only once DEVOS-224's new "Run this version" interaction was exercised, but present in the unmodified original markup too): `<Typography variant="body2">` (renders as `<p>`) wrapped a `<StatusChip>` (renders a `<div>` via MUI's `Chip`), which is invalid HTML nesting (a `<div>` cannot be a descendant of `<p>`) and produced a real React/DOM console warning once the row actually mounted. Confirmed via direct inspection that this exact `Typography`-wraps-`StatusChip` structure already existed, unchanged, in the pre-Sprint-33 code — not introduced by this restyle, only relocated. Fixed in place (one-line change: `component="div"` on that `Typography`) since this sprint's own DEVOS-224 work was already directly editing this exact block for the "Run this version" action.
