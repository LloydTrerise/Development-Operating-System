# DEVOS-278 — Rewire `StatusChip` to the new tokens

**Priority:** P1 | **Estimate:** 0.25d
**Depends on:** DEVOS-277.
**Depended on by:** none within this sprint.

## Scope

Make `StatusChip.tsx` render every status from `statusTokens` instead of MUI's stock `success`/`error`/`warning`/`info` chip colors, with zero change to which status maps to which semantic bucket.

## Implementation

- `STATUS_COLOR: Record<string, ChipProps['color']>` (mapping status → MUI color name) becomes `STATUS_BUCKET: Record<string, StatusBucket>` (mapping status → `'ok' | 'run' | 'warn' | 'fail'`), with the exact same right-hand-side grouping as today (`success`→`ok`, `error`→`fail`, `warning`→`warn`, `info`→`run`) — only the bucket's color values change, not which statuses land in which bucket.
- The component reads `theme.palette.mode` via `useTheme()`, looks up `statusTokens[mode][bucket]` (defaulting to `idle` for any unrecognized status, same fallback semantics as today's `?? 'default'`), and renders the `Chip` with explicit `sx={{ color: fg, backgroundColor: bg }}` instead of the MUI `color` prop (which requires a registered palette key `statusTokens` never becomes — see DEVOS-277's own note on avoiding MUI's color-parsing utilities).
- `ChipProps` import may no longer be needed once `color` is dropped from `STATUS_COLOR`'s type; adjust imports accordingly rather than leaving an unused type import (would fail lint).

## Out of scope

Adding new statuses to the map. Changing the chip's `size`/`label` behavior. `onSolid` (no solid-fill chip state exists here — disclosed as unconsumed by this task, same as `shadowTokens` was before DEVOS-281).

## Acceptance

`pnpm --filter @devos/web typecheck lint build` clean. A real dev-server check: every status chip across Home/Work Items/Runs/Approvals renders a muted tint (not MUI's saturated stock colors) matching the mockup's palette, in both light and dark mode, with no visual regression to which bucket any given status falls into.

## Actual results

Implemented exactly as planned: `STATUS_BUCKET` replaces `STATUS_COLOR` with the identical grouping, `useTheme()` resolves the live mode, `Chip` renders via `sx={{ color, backgroundColor }}` instead of the `color` prop. `pnpm --filter @devos/web typecheck lint build` clean.

Live-verified via a real Playwright session against the real running dev server (`localhost:5173`) and real API (`localhost:3000`, real Postgres): a real `COMPLETED` run status chip on `/runs` renders `color: oklch(0.8 0.115 152)` / `background-color: oklch(0.7 0.115 152 / 0.14)` in dark mode and the corresponding light-mode values in light mode — both exact matches to `statusTokens`, confirmed via `getComputedStyle`, not screenshot inspection alone. Zero console errors on Home/Work Items/Runs/Approvals in either mode. Two unrelated `Chip` instances were also observed during this check (a health-check "OK" badge on Home, filter-tab chips reading "All"/"All (1)") — neither is `StatusChip`, both are out of this task's scope, correctly unaffected.
