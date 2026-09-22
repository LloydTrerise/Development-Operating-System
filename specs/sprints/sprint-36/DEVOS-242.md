# DEVOS-242 — Home dashboard integration-health tile

**Priority:** P2
**Source:** `specs/DEVOS-UI-UX-REDESIGN-BACKLOG.md` §6.8

## Acceptance summary

Now that Integrations exists, Sprint 30's deliberately-omitted health tile (DEVOS-208) is added for real.

## Scope

- `apps/web/src/features/home/use-home-dashboard-data.ts`: add `listIntegrations(projectId)` as a 6th `Promise.all` fetch alongside the existing 5; add `activeIntegrationCount: number` to `HomeDashboardData`, computed as `integrations.filter((i) => i.status === 'ACTIVE').length` when the fetch succeeds, tolerant of failure (matching the existing `if (result.ok) { ... }` pattern for artifacts/audit/workflows — a failed integrations fetch degrades the tile to 0, it does not block the rest of the dashboard).
- `apps/web/src/features/home/HomePage.tsx`: widen the KPI grid from `repeat(4, 1fr)` to `repeat(5, 1fr)`; add a 5th `KpiTile label="Integrations" value={activeIntegrationCount} to="/integrations"`. This is the one real "health" signal that exists — a count of `ACTIVE`-status rows, not a live connectivity check (no such capability exists anywhere in this codebase — see `README.md`'s own grounding).

## Out of scope

Any deeper health breakdown (per-integration status, last-checked time, connectivity validation) — none of it is backed by real data.

## Addendum — the adjacent stale Artifacts tile was fixed too

DEVOS-243's own completion report disclosed a real, adjacent gap found while implementing this story: the Home dashboard's Artifacts KPI tile had been non-clickable since Sprint 30, with its own inline comment explaining that no Artifact Library page existed yet — but Sprint 35 built one. Not named in this story's original scope, so not fixed in the first pass. Per explicit user instruction after the sprint's first completion report ("fix both remaining issues"), it was fixed: `HomePage.tsx`'s Artifacts `KpiTile` gained `to="/artifacts"`, one line, matching every other tile's own convention exactly. Live-reverified: real `cursor: pointer` computed style, real navigation to `/artifacts` on click, zero console errors.

## Validation

`pnpm --filter @devos/web typecheck lint build`; live dev-server verification: the tile's count matches a direct check of the real project's integrations (`ACTIVE` rows only), and clicking it navigates to `/integrations`. Re-verified after the Artifacts-tile addendum: full monorepo `pnpm turbo run typecheck lint test build --filter='!@devos/e2e-tests'` 76/76 green; full real `tests/e2e` suite 27/27 files, 52/52 tests green — both re-run clean after the addendum.
