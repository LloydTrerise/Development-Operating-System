import { createTheme, type Theme } from '@mui/material/styles';
import { radiusTokens } from './theme-tokens';

export type ThemeMode = 'light' | 'dark';

/**
 * Nocturne (`Design/nocturne.css`) is this app's ported visual language.
 * Status colors (SUCCEEDED/FAILED/RUNNING/etc.) are deliberately not added
 * here as new palette keys; they're handled by StatusChip using the
 * standard success/error/warning/info/default semantics already defined
 * per-mode below — nocturne.css itself defines no status-tint tokens, so
 * there is nothing to port for those.
 *
 * nocturne.css defines exactly one (dark-oriented) palette — it has no
 * separate light-mode variant. Dark mode below ports its `:root` tokens
 * verbatim. Light mode is derived from the same neutral/accent ramps
 * nocturne.css already defines (no color invented outside the source
 * file), recombined for light-on-dark contrast: lighter neutral steps for
 * surfaces, darker neutral/accent steps for text/primary so contrast holds
 * against a light background.
 */
export function createAppTheme(mode: ThemeMode): Theme {
  return createTheme({
    palette: {
      mode,
      primary: { main: mode === 'light' ? '#796cbf' : '#9184d9' },
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
      divider:
        mode === 'light' ? 'rgba(41, 43, 49, 0.16)' : 'rgba(233, 233, 237, 0.16)',
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
        },
      },
    },
  });
}
