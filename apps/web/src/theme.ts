import { alpha, createTheme, type Theme } from '@mui/material/styles';
import type { ButtonProps } from '@mui/material/Button';
import { radiusTokens, shadowTokens } from './theme-tokens';

export type ThemeMode = 'light' | 'dark';

/**
 * Nocturne (`Design/nocturne.css`) is this app's ported visual language.
 * Status colors (SUCCEEDED/FAILED/RUNNING/etc.) are rendered by StatusChip
 * directly from `theme-tokens.ts`'s `statusTokens`, ported from the mockup's
 * own inline `--st-*` tokens (`nocturne.css` itself defines none) — not from
 * this theme's palette, since MUI's palette color utilities don't parse
 * `oklch()`.
 *
 * nocturne.css defines exactly one (dark-oriented) palette — it has no
 * separate light-mode variant. Dark mode below ports its `:root` tokens
 * verbatim. Light mode is derived from the same neutral/accent ramps
 * nocturne.css already defines (no color invented outside the source
 * file), recombined for light-on-dark contrast: lighter neutral steps for
 * surfaces, darker neutral/accent steps for text/primary so contrast holds
 * against a light background.
 */

type PaletteButtonColor = 'primary' | 'secondary' | 'success' | 'error' | 'info' | 'warning';
const PALETTE_BUTTON_COLORS: readonly PaletteButtonColor[] = [
  'primary',
  'secondary',
  'success',
  'error',
  'info',
  'warning',
];

function resolveButtonMainColor(theme: Theme, color: ButtonProps['color']): string {
  const key = PALETTE_BUTTON_COLORS.find((candidate) => candidate === color);
  return theme.palette[key ?? 'primary'].main;
}

// Every elevation index MUI can request resolves to one of Nocturne's three
// shadow tiers (`theme-tokens.ts`'s `shadowTokens`), grouped by which
// components actually request which elevation by default: Card/Paper (1)
// and AppBar (4) land in `sm`; Menu/popovers (commonly 8) in `md`;
// Drawer/Dialog (commonly 16/24) in `lg`. The source design system defines
// only this one (dark-ground-tuned) shadow-token set — no separate
// light-mode variant exists to port, so both modes share it.
const nocturneShadows: Theme['shadows'] = [
  'none',
  shadowTokens.sm,
  shadowTokens.sm,
  shadowTokens.sm,
  shadowTokens.sm,
  shadowTokens.md,
  shadowTokens.md,
  shadowTokens.md,
  shadowTokens.md,
  shadowTokens.md,
  shadowTokens.md,
  shadowTokens.md,
  shadowTokens.md,
  shadowTokens.lg,
  shadowTokens.lg,
  shadowTokens.lg,
  shadowTokens.lg,
  shadowTokens.lg,
  shadowTokens.lg,
  shadowTokens.lg,
  shadowTokens.lg,
  shadowTokens.lg,
  shadowTokens.lg,
  shadowTokens.lg,
  shadowTokens.lg,
];

export function createAppTheme(mode: ThemeMode): Theme {
  const primaryMain = mode === 'light' ? '#796cbf' : '#9184d9';
  return createTheme({
    shadows: nocturneShadows,
    palette: {
      mode,
      primary: { main: primaryMain },
      secondary: { main: mode === 'light' ? '#7972a9' : '#a7a1db' },
      background:
        mode === 'light'
          ? { default: '#e4e7f5', paper: '#f3f5fe' }
          : { default: '#161826', paper: '#232532' },
      text: {
        primary: mode === 'light' ? '#292b31' : '#e9e9ed',
      },
      // MUI's internal color parser doesn't support CSS `color-mix()` (used
      // by nocturne.css's own --color-divider); rgba() carries the same
      // 16%-opacity intent in a format MUI actually accepts.
      divider: mode === 'light' ? 'rgba(41, 43, 49, 0.16)' : 'rgba(233, 233, 237, 0.16)',
    },
    typography: {
      fontFamily: '"Inter", system-ui, sans-serif',
      fontSize: 13,
      h4: { fontWeight: 500 },
      h5: { fontWeight: 500 },
      h6: { fontWeight: 500 },
    },
    shape: {
      borderRadius: radiusTokens.md,
    },
    // Deliberately NOT overriding the default 8px spacing unit: every
    // existing page already uses theme.spacing()-based sx props (e.g.
    // `mt: 8` to clear the fixed AppBar) tuned against that default —
    // overriding it silently broke that layout during this task's own
    // implementation (main content rendered behind the AppBar), caught by
    // this task's own real dev-server check and reverted. Nocturne's raw
    // 2.8px-based scale is exposed via theme-tokens.ts's `spaceTokens`
    // instead, for components that want that exact scale directly.
    components: {
      MuiTableCell: {
        defaultProps: { size: 'small' },
      },
      MuiCssBaseline: {
        styleOverrides: {
          body: { minHeight: '100vh' },
          // Mirrors Design/nocturne.css:120-121. `!important` is required
          // here (not present in the source file, which has no competing
          // component library): MUI's own ButtonBase-derived components
          // (Button, IconButton, MenuItem, ...) and form inputs each ship
          // their own same-specificity `.Mui-focusVisible`/input outline
          // reset, inserted after CssBaseline's global styles, which would
          // otherwise silently win the cascade tie and suppress this ring —
          // confirmed by live keyboard-navigation testing against the real
          // dev server.
          ':focus': { outline: 'none' },
          ':focus-visible': {
            outline: `2px solid ${primaryMain} !important`,
            outlineOffset: '2px',
          },
        },
      },
      // Design/_ds/.../styles.css's `.btn` has no solid-filled variant for
      // any color (background is always transparent) — this makes every
      // `variant="contained"` button render as the design system's
      // outlined-accent style instead, regardless of `color`.
      MuiButton: {
        styleOverrides: {
          root: ({ theme, ownerState }) => {
            if (ownerState.variant !== 'contained') {
              return {};
            }
            const main = resolveButtonMainColor(theme, ownerState.color);
            return {
              backgroundColor: 'transparent',
              boxShadow: 'none',
              color: main,
              border: `1px solid ${main}`,
              '&:hover': {
                backgroundColor: alpha(main, 0.12),
                boxShadow: 'none',
              },
              '&:active': {
                backgroundColor: alpha(main, 0.22),
              },
            };
          },
        },
      },
    },
  });
}
