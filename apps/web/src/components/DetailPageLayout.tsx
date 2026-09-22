import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, IconButton, Stack, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

/**
 * Shared shell for every real, parameterized `/{area}/:id` detail route
 * introduced from Sprint 29 onward (specs/sprints/sprint-29/DEVOS-206.md).
 * Existing in-page panels (e.g. Runs' task drill-down) are a deliberately
 * separate, untouched convention — this shell is only for a genuinely new
 * routed detail surface.
 */
export function DetailPageLayout({
  title,
  backTo,
  children,
}: {
  title: string;
  backTo: string;
  children: ReactNode;
}) {
  const navigate = useNavigate();

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <IconButton aria-label="Back" onClick={() => navigate(backTo)} size="small">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Typography variant="h5" component="h2">
          {title}
        </Typography>
      </Stack>
      <Box>{children}</Box>
    </Box>
  );
}
