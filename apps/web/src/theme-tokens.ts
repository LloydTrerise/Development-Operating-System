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
