# DEVOS-259 — System health UI

**Priority:** P1 | **Estimate:** 0.5d
**Depends on:** DEVOS-258 (the route/wrapper this tile calls).
**Depended on by:** none within this sprint.

## Scope

Home dashboard's system-health tile is wired to DEVOS-258's real aggregated data. **Confirmed net-new, not "wiring an existing tile"** (backlog's phrasing is loose here — see `README.md`'s grounding and Sprint 30's own build-state record, which explicitly deferred this): `apps/web/src/features/home/` has zero health-related UI today.

## Implementation

- `apps/web/src/api-client.ts`: new `SystemHealth` interface (`projectId`, `database: 'ok' | 'error'`, `integrations: { total: number; active: number }`, `capabilities: { total: number; active: number }`) and `getProjectSystemHealth(projectId): Promise<ApiResult<SystemHealth>>` → `GET /projects/:id/system-health`.
- `use-home-dashboard-data.ts`: fetches `getProjectSystemHealth(projectId)` alongside the existing `Promise.all` fan-out (tolerant of a failed fetch, matching every other tile source's own convention); exposes `systemHealth: SystemHealth | null` on the returned `HomeDashboardData`.
- `HomePage.tsx`: a new, dedicated `SystemHealthTile` component (not a reuse of the numeric-only `KpiTile` — health is a status plus a breakdown, not a single count): a `StatusChip`-style indicator driven by `database` (`ok`/`error` — the one field with genuine binary fault semantics), plus supporting text ("3/4 integrations active", "12/12 capabilities active"). The KPI grid widens from `repeat(5, 1fr)` to `repeat(6, 1fr)`, adding this as the sixth tile — the same "widen the grid, add a tile" shape DEVOS-242 already established for the existing Integrations tile (kept unmodified, alongside the new one).

## Out of scope

A dedicated `/system-health` page (no route exists or is added; the tile is the whole of this story). Removing or changing the existing "Integrations" KPI tile.

## Acceptance

`pnpm --filter @devos/web typecheck lint build` clean; new `apps/web/tests/api-client.test.ts` case for `getProjectSystemHealth`. Live-verified against a real dev server and the real seeded "DevOS POC" project via a throwaway Playwright script: the tile renders real counts matching a direct API call to the same route, and the database status chip reads "ok" against the real running database.

## Actual results

Implemented as scoped. `use-home-dashboard-data.ts` fetches `getProjectSystemHealth` alongside its existing `Promise.all` fan-out, tolerant of a failed fetch like every other tile source. `HomePage.tsx` gained a new `SystemHealthTile` (not a `KpiTile` reuse — a `Chip` driven by `database`'s own genuine ok/error signal, plus supporting integration/capability breakdown text); the KPI grid widened from `repeat(5, 1fr)` to `repeat(6, 1fr)`, with the existing "Integrations" tile left unmodified alongside it.

**Live-verified against a real dev server and the real seeded "DevOS POC" project** via the same throwaway Playwright script covering DEVOS-255/257/259 together: the tile rendered "System Health" with a real `\d+/\d+ integrations · \d+/\d+ capabilities` breakdown, confirmed present via a text-content assertion before any other verification step in the same script ran (so the assertion reflects the tile's real initial state, not a state altered by this script's own later capability toggle). Zero console/page errors throughout.
