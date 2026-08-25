import { Box, CircularProgress, Typography } from '@mui/material';

export function LoadingState({ label }: { label?: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 2 }}>
      <CircularProgress size={20} />
      {label && <Typography variant="body2">{label}</Typography>}
    </Box>
  );
}
