# DEVOS-277 — Author status-tint tokens

**Priority:** P1 | **Estimate:** 0.25d
**Depends on:** none.
**Depended on by:** DEVOS-278.

## Scope

Add a new `statusTokens` export to `apps/web/src/theme-tokens.ts`, verbatim from `Design/DevOS.dc.html`'s inline `--st-*` custom properties (dark: lines 22–35; light: lines 47–60), keyed by mode, covering the five semantic buckets (`ok`/`run`/`warn`/`fail`/`idle`) plus each bucket's `-bg` tint and the shared `on-solid` value.

## Implementation

- `theme-tokens.ts` gains:
  ```ts
  export const statusTokens = {
    dark: {
      ok: { fg: 'oklch(0.80 0.115 152)', bg: 'oklch(0.70 0.115 152 / 0.14)' },
      run: { fg: 'oklch(0.80 0.115 245)', bg: 'oklch(0.70 0.115 245 / 0.14)' },
      warn: { fg: 'oklch(0.84 0.125 78)', bg: 'oklch(0.74 0.125 78 / 0.14)' },
      fail: { fg: 'oklch(0.79 0.145 25)', bg: 'oklch(0.68 0.145 25 / 0.14)' },
      idle: { fg: '#b2b6ca', bg: 'rgba(147,151,171,0.14)' },
      onSolid: '#292b31',
    },
    light: {
      ok: { fg: 'oklch(0.48 0.115 152)', bg: 'oklch(0.48 0.115 152 / 0.12)' },
      run: { fg: 'oklch(0.48 0.115 245)', bg: 'oklch(0.48 0.115 245 / 0.12)' },
      warn: { fg: 'oklch(0.46 0.125 68)', bg: 'oklch(0.52 0.125 68 / 0.12)' },
      fail: { fg: 'oklch(0.50 0.165 25)', bg: 'oklch(0.50 0.165 25 / 0.12)' },
      idle: { fg: '#595d6c', bg: 'rgba(89,93,108,0.10)' },
      onSolid: '#f3f5fe',
    },
  } as const;
  ```
- `idle`'s `fg` (dark mode) resolves the mockup's `var(--color-neutral-400)` reference to its literal hex (`#b2b6ca`, `nocturne.css:24`); `on-solid` resolves `var(--color-neutral-900)`/`var(--color-neutral-100)` to their literals (`#292b31`/`#f3f5fe`, `nocturne.css:29`/`21`) — the mockup's own tokens are themselves indirected through the neutral ramp, not directly hex, so this is a direct, disclosed resolution, not an invented value.
- Colors are plain CSS strings (`oklch()`, `rgba()`, hex), applied later only via raw `sx` properties (never through MUI's `palette` config, which runs its own color-decomposition/contrast utilities that don't understand `oklch()` — the same class of parser gap Sprint 29 already found and worked around for `color-mix()` on `divider`).

## Out of scope

Consuming these tokens (DEVOS-278). Any status bucket, tint, or token beyond the six named above.

## Acceptance

`pnpm --filter @devos/web typecheck build` clean. Every token value matches the mockup's cited lines exactly (verified by direct comparison, not re-derived).

## Actual results

Implemented exactly as planned. `statusTokens` added to `theme-tokens.ts`, both modes, all six keys (`ok`/`run`/`warn`/`fail`/`idle`/`onSolid`), values copied verbatim from `Design/DevOS.dc.html:22-35`/`47-60`, with `idle`/`onSolid`'s neutral-ramp indirection resolved to the literal hex values from `Design/nocturne.css:21,24,29`. `pnpm --filter @devos/web typecheck build` clean. `onSolid` has no consumer within this sprint's own scope (StatusChip renders a tinted chip, never a solid-fill badge) — disclosed, not silently dropped, the same class of honest non-consumption `shadowTokens` itself carried from Sprint 29 until DEVOS-281.
