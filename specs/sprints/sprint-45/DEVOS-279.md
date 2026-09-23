# DEVOS-279 — Theme-level `MuiButton` override

**Priority:** P1 | **Estimate:** 0.5d
**Depends on:** none.
**Depended on by:** none within this sprint.
**Implementation choice (resolved by explicit user instruction, 2026-09-23):** a single theme-level `MuiButton` style override, not per-call-site edits to the 16 real `variant="contained"` sites (see README grounding for the real count).

## Scope

Every `variant="contained"` button renders as the design system's outlined-accent style — transparent background, 1px solid border in the resolved color, tinted hover/active backgrounds — regardless of which MUI `color` it uses (`.btn` in the source design system has no solid-filled variant for any color, confirmed in README grounding).

## Implementation

- `theme.ts` gains a `MuiButton.styleOverrides.root` function override that, only when `ownerState.variant === 'contained'`, replaces the fill with an outline:
  - `backgroundColor: 'transparent'`, `boxShadow: 'none'`, `color: <resolved palette color>.main`, `border: '1px solid ' + <resolved palette color>.main`.
  - `&:hover`: `backgroundColor: alpha(<resolved color>.main, 0.12)`, `boxShadow: 'none'` (matching `Design/_ds/.../styles.css:150`'s `.btn-primary:hover` 12% tint).
  - `&:active`: `backgroundColor: alpha(<resolved color>.main, 0.22)` (matching `styles.css:151`'s 22% tint).
  - Disabled state left to MUI's own default disabled styling (already opacity-reduced), not overridden.
- The resolved color is looked up from `theme.palette` using `ownerState.color`, falling back to `primary` for `'inherit'`/undefined — a small typed helper avoids `any` and handles every real `ButtonProps['color']` value (`primary`/`secondary`/`success`/`error`/`info`/`warning`).
- `alpha` imported from `@mui/material/styles`.
- `variant="text"`/`variant="outlined"` buttons are untouched — the override only fires for `contained`.

## Out of scope

Editing any of the 16 real call sites directly. Adding a new `variant`/`color` combination. Changing disabled-state styling.

## Acceptance

`pnpm --filter @devos/web typecheck lint build` clean. A real dev-server check across every page listed in the README's grounding (at minimum Work Items, Runs, Approvals, Agents, Projects) confirms every former solid-filled primary/success button now renders as an accent/success outline matching the 79 already-outlined buttons' visual language, in both light and dark mode, with hover/active tint feedback working.

## Actual results

Implemented exactly as planned: a typed `resolveButtonMainColor` helper (no `any`) resolves `ownerState.color` against `theme.palette`, falling back to `primary` for `'inherit'`/undefined; the `MuiButton.styleOverrides.root` function only touches `variant === 'contained'`, leaving `text`/`outlined` untouched. `pnpm --filter @devos/web typecheck lint build` clean.

Live-verified via real Playwright against the real running dev server/API: the "Create work item" button (`/work-items`) and "Start run" button (`/runs`) — both previously `variant="contained"` with no explicit `color` (i.e. `primary`) — now render `background-color: rgba(0,0,0,0)` with `border: 1px solid rgb(145,132,217)` in dark mode and `rgb(121,108,191)` in light mode, both exact matches to `theme.palette.primary.main`, confirmed via `getComputedStyle`. The `color="success"` case (`ApprovalsPage.tsx`'s Approve button, the one non-primary contained button among the 16) was **not independently live-confirmed** — no pending approval exists in the currently reachable dev/API data (`GET /projects` returns zero projects for the available dev credential), so the button never renders in this environment. Its correctness rests on the same, already-live-confirmed `resolveButtonMainColor` code path (`success` is one of the six statically-typed `PALETTE_BUTTON_COLORS`, resolved identically to `primary`) plus a clean typecheck/build — disclosed as a real, narrower-than-ideal verification gap, not silently claimed as proven.
