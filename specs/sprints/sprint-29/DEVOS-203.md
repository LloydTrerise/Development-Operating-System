# DEVOS-203 — Nocturne MUI theme

**Priority:** P0 | **Estimate:** 2d
**Depends on:** none.
**Depended on by:** DEVOS-204 (nav restyle sits on top of the new theme), and every later restyle story in Sprints 30-34.

## Scope

Author a Nocturne-branded MUI theme variant in `apps/web/src/theme.ts`, replacing the current minimal palette/typography customization with tokens ported from `Design/nocturne.css`, for both light and dark mode. **Per this sprint's README grounding: no status-tint work is in scope.** `nocturne.css` defines no status-tint custom properties, and `StatusChip.tsx` already resolves every known status via MUI's built-in semantic colors (`success`/`error`/`warning`/`info`/`default`) — that mechanism is correct today and must not be touched by this story.

## Implementation

- `apps/web/src/theme.ts`: extend `createAppTheme(mode: ThemeMode)`'s `palette` with Nocturne's ported values — `background.default`/`background.paper` from `--color-bg`/`--color-surface`, `text.primary` from `--color-text`, `primary.main`/`secondary.main` from `--color-accent`/`--color-accent-2` (each with their own 9-step `-100`..`-900` scale available in `nocturne.css` for shade selection), `divider` from `--color-divider` — each with real mode-appropriate values for both light and dark (read `nocturne.css`'s actual current values at implementation time; do not invent hex codes not present in the source file).
- Add a `shape.borderRadius` value from `--radius-sm`/`--radius-md`/`--radius-lg` (pick the one nearest MUI's current default context, e.g. `--radius-md` for the base `shape.borderRadius`, with `--radius-sm`/`--radius-lg` available as named constants for components that need to override).
- Extend `typography` with `--font-heading`/`--font-heading-weight`/`--font-body` (`fontFamily`, heading `fontWeight`) — keep the existing `fontSize: 13` and per-heading-level overrides unless Nocturne's own type scale requires otherwise; do not silently drop tested `MuiTableCell`/`MuiCssBaseline` overrides.
- Introduce a small exported token module (e.g. `apps/web/src/theme-tokens.ts`) mirroring `nocturne.css`'s spacing (`--space-1/2/3/4/6/8`) and shadow (`--shadow-sm/md/lg`) scales as plain constants, for components that need them outside MUI's own `theme.spacing()`/`theme.shadows` mechanisms where a direct Nocturne value is needed (e.g. matching the mockup's own card elevation).
- Do not import `nocturne.css` itself into the app (backlog §9 explicitly forbids running two styling systems side by side) — only port the token *values* into the MUI theme object.
- Leave `StatusChip.tsx` and its `STATUS_COLOR` map completely unchanged.

## Out of scope

Any status-tint token or `StatusChip.tsx` change (see grounding correction above). Any change to which pages/components consume the theme — that is every later restyle sprint's own job, not this story's. Importing `nocturne.css` as a stylesheet.

## Acceptance

`apps/web/src/theme.ts` (and the new token module, if added) typechecks and lints clean. A real dev-server visual check (`pnpm --filter @devos/web dev`) confirms the app renders with the new palette in both light and dark mode via the existing theme-mode toggle, with no visual regression to any component that isn't part of this story's scope (e.g. `StatusChip` colors remain exactly as before). `pnpm --filter @devos/web typecheck lint build` green.
