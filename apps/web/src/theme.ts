import { createTheme, type Theme } from '@mui/material/styles';

export type ThemeMode = 'light' | 'dark';

/**
 * A restrained "control-plane dashboard" palette rather than MUI's default
 * vivid blue — this is an internal engineering-ops tool, not a consumer
 * product. Status colors (SUCCEEDED/FAILED/RUNNING/etc.) are deliberately
 * not added here as new palette keys; they're handled by StatusChip using
 * the standard success/error/warning/info/default semantics already
 * defined per-mode below.
 */
export function createAppTheme(mode: ThemeMode): Theme {
  return createTheme({
    palette: {
      mode,
      primary: { main: mode === 'light' ? '#3f4a5a' : '#8a97ab' },
      secondary: { main: mode === 'light' ? '#5c6b7a' : '#9aa7b5' },
      background:
        mode === 'light'
          ? { default: '#f4f5f7', paper: '#ffffff' }
          : { default: '#12161c', paper: '#1a1f27' },
    },
    typography: {
      fontSize: 13,
      h4: { fontWeight: 600 },
      h5: { fontWeight: 600 },
      h6: { fontWeight: 600 },
    },
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
