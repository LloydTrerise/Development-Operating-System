# DEVOS-209 — Home dashboard layout

**Priority:** P0 | **Estimate:** 1d
**Depends on:** DEVOS-208 (renders its data).
**Depended on by:** DEVOS-210 (adds navigation to this layout's rendered items).

## Scope

A real `features/home/HomePage.tsx`, replacing `DashboardPage.tsx` at the `/` route, matching the mockup's section shape (`Design/DevOS.dc.html` lines 157-271): 4 KPI tiles, Needs Attention, Active Work, Recent Activity — Nocturne-themed (Sprint 29's theme). System Health is omitted, per this sprint's own grounding.

## Implementation

- New `apps/web/src/features/home/HomePage.tsx`, using `useHomeDashboardData()` (DEVOS-208).
- KPI tile row (4 `Card`/`Box` tiles in a `grid`, matching the mockup's `repeat(4, 1fr)` layout): Work Items (total), Runs In Progress, Pending Approvals, Artifacts — each a label + large numeric value, no fabricated delta/trend indicator (the mockup's `k.delta`/`k.deltaColor` have no real historical-comparison data source anywhere in this codebase — omitted rather than fabricated).
- Needs Attention section (left column, matching the mockup's `attention` list): renders `pendingApprovals`, each row showing the approval's `approvalType`/`status`/`requestedAt`, using `StatusChip` for status (reusing the existing component, not inventing new tint logic).
- Active Work section (left column, below Needs Attention): renders `activeRuns`, each row showing the run's source workflow name, `StatusChip` for status, and `createdAt` (no fabricated stage-by-stage progress bar — the mockup's `r.stages` has no real per-run stage-breakdown data source available client-side without a new endpoint, out of scope per the README's grounding; disclosed, not built).
- Recent Activity section (right column, matching the mockup's `activity` timeline): renders `recentActivity` (audit records), each row showing `action`/`targetType`/`outcome`/`createdAt`, capped to a reasonable count (e.g. 10 most recent) to avoid an unbounded render.
- No System Health section — confirmed omission, not a forgotten one (README grounding: no real signal exists until Sprint 39).
- `apps/web/src/App.tsx`: `/` route now renders `HomePage` instead of `DashboardPage`; `features/dashboard/DashboardPage.tsx` is deleted (fully superseded, not left as dead code, per AGENTS.md's "delete completely if certain something is unused"). The Sprint 29 nav label for `/` ("Dashboard") is renamed to "Home", matching the page's own real identity and the mockup's "Overview > Home" naming — the smallest possible adjustment directly tied to this sprint's own content, not a separate unscoped rename.

## Out of scope

A "delta"/trend indicator on any KPI tile (no historical-comparison data source exists). A per-run stage-progress bar in Active Work (no per-run stage-breakdown data available without a new endpoint). System Health (Sprint 39).

## Acceptance

Real dev-server visual check: all 4 KPI tiles show real counts matching the seeded project's actual data; Needs Attention shows real pending approvals (or a real empty state if none); Active Work shows real non-terminal runs (or a real empty state); Recent Activity shows real audit records in reverse-chronological order. Nocturne-themed (Sprint 29's `theme.ts`/tokens), correct in both light and dark mode. `pnpm --filter @devos/web typecheck lint build` clean.
