/**
 * Raw Nocturne design tokens (`Design/nocturne.css`) that don't map onto a
 * single MUI theme property and are needed verbatim by individual
 * components (e.g. an elevated card matching the mockup's `.elev-md`).
 * `theme.ts` covers everything that does map onto `createTheme()` options
 * (palette, typography, shape) directly. Spacing is deliberately NOT a
 * `createTheme()` override — see theme.ts's own comment — so Nocturne's
 * 2.8px-based scale lives here instead, in px, for direct `sx` use.
 */
export const radiusTokens = {
  sm: 4,
  md: 8,
  lg: 14,
} as const;

export const spaceTokens = {
  1: 2.8,
  2: 5.6,
  3: 8.4,
  4: 11.2,
  6: 16.8,
  8: 22.4,
} as const;

export const shadowTokens = {
  sm: '0 0 0 1px #3f424d',
  md: '0 0 0 1px #595d6c, 0 6px 18px rgba(0,0,0,0.55)',
  lg: '0 0 0 1px #9397ab, 0 16px 40px rgba(0,0,0,0.65)',
} as const;

/**
 * Status-tint tokens, ported verbatim (OKLCH) from `Design/DevOS.dc.html`'s
 * inline `--st-*` custom properties (dark: lines 22-35; light: lines 47-60)
 * — `Design/nocturne.css` itself defines none of these, unlike every other
 * token in this file. `idle`/`onSolid` resolve the mockup's own
 * `var(--color-neutral-*)` indirection to their literal hex values
 * (`nocturne.css:21,24,29`). Applied only via raw `sx` (never through MUI's
 * `palette` config), since MUI's palette color utilities don't understand
 * `oklch()` — the same class of parser gap `theme.ts`'s divider comment
 * already discloses for `color-mix()`.
 */
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
