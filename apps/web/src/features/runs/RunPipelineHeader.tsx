import { Box, Stack, Typography } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import { useTheme } from '@mui/material/styles';
import type { WorkflowTask } from '../../api-client.js';

type StepPaletteKey = 'success' | 'error' | 'info' | 'warning' | 'default';

const STEP_COLOR_KEY: Record<string, StepPaletteKey> = {
  COMPLETED: 'success',
  SUCCEEDED: 'success',
  FAILED: 'error',
  CANCELLED: 'error',
  RUNNING: 'info',
  PENDING: 'warning',
  WAITING: 'warning',
  AWAITING_APPROVAL: 'warning',
  QUEUED: 'warning',
  SKIPPED: 'default',
};

function stepIcon(status: string) {
  switch (status) {
    case 'COMPLETED':
    case 'SUCCEEDED':
      return <CheckCircleIcon fontSize="small" />;
    case 'FAILED':
    case 'CANCELLED':
      return <CancelIcon fontSize="small" />;
    case 'RUNNING':
      return <PlayCircleIcon fontSize="small" />;
    case 'PENDING':
    case 'WAITING':
    case 'AWAITING_APPROVAL':
    case 'QUEUED':
      return <HourglassEmptyIcon fontSize="small" />;
    default:
      return <RadioButtonUncheckedIcon fontSize="small" />;
  }
}

/**
 * DEVOS-214: the mockup's horizontal pipeline header, built from the run's
 * own real ordered task list — the one real per-run "stage-like" sequence
 * this codebase has (see specs/sprints/sprint-31/README.md's grounding on
 * why no separate stage/milestone entity is fabricated).
 */
export function RunPipelineHeader({ tasks }: { tasks: WorkflowTask[] }) {
  const theme = useTheme();

  if (tasks.length === 0) {
    return (
      <Typography variant="caption" color="text.secondary">
        No tasks yet.
      </Typography>
    );
  }

  return (
    <Stack direction="row" alignItems="flex-start" spacing={0} sx={{ overflowX: 'auto', py: 1 }}>
      {tasks.map((task, index) => {
        const colorKey = STEP_COLOR_KEY[task.status] ?? 'default';
        const paletteColor =
          colorKey === 'default' ? theme.palette.text.disabled : theme.palette[colorKey].main;

        return (
          <Box
            key={task.id}
            sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 84 }}
          >
            <Stack direction="row" alignItems="center" sx={{ width: '100%' }}>
              <Box
                sx={{
                  flex: index === 0 ? 0 : 1,
                  height: 1,
                  bgcolor: 'divider',
                  visibility: index === 0 ? 'hidden' : 'visible',
                }}
              />
              <Box sx={{ color: paletteColor, display: 'flex', flexShrink: 0 }}>
                {stepIcon(task.status)}
              </Box>
              <Box
                sx={{
                  flex: index === tasks.length - 1 ? 0 : 1,
                  height: 1,
                  bgcolor: 'divider',
                  visibility: index === tasks.length - 1 ? 'hidden' : 'visible',
                }}
              />
            </Stack>
            <Typography
              variant="caption"
              align="center"
              sx={{ mt: 0.5, wordBreak: 'break-word', lineHeight: 1.2 }}
            >
              {task.nodeId}
            </Typography>
          </Box>
        );
      })}
    </Stack>
  );
}
