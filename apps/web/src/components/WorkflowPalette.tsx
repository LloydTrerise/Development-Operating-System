import type { DragEvent } from 'react';
import { Box, Chip, Stack, Typography } from '@mui/material';

/**
 * DEVOS-129: exactly `@devos/contracts`' full `workflowNodeTypes` — not the
 * Designer spec's own larger aspirational palette (`HUMAN_TASK`/`LOOP`/
 * `SUBWORKFLOW`/`ARTIFACT`/`NOTIFICATION` remain absent from the contract,
 * so they're absent here too, per `specs/sprints/sprint-13/README.md`'s
 * own scoping).
 */
export const PALETTE_NODE_TYPES = [
  'TRIGGER',
  'TASK',
  'AGENT_TASK',
  'TOOL_TASK',
  'APPROVAL',
  'CONDITION',
  'PARALLEL',
  'JOIN',
  'WAIT',
  'END',
] as const;

export const PALETTE_DRAG_MIME_TYPE = 'application/devos-workflow-node-type';

export interface WorkflowPaletteProps {
  /** 'row' (default) preserves the original wrapped-chip layout used by the
   * Project Type template editor. 'column' is the Designer restyle's own
   * narrow-column layout (DEVOS-222) — same chips, same drag behavior,
   * stacked vertically to fit a fixed-width palette panel. */
  variant?: 'row' | 'column';
}

export function WorkflowPalette({ variant = 'row' }: WorkflowPaletteProps) {
  function handleDragStart(event: DragEvent<HTMLDivElement>, nodeType: string) {
    event.dataTransfer.setData(PALETTE_DRAG_MIME_TYPE, nodeType);
    event.dataTransfer.effectAllowed = 'move';
  }

  return (
    <Box>
      <Typography variant="caption" color="text.secondary" gutterBottom sx={{ display: 'block' }}>
        Drag a node type onto the canvas
      </Typography>
      <Stack
        direction={variant === 'column' ? 'column' : 'row'}
        flexWrap={variant === 'column' ? 'nowrap' : 'wrap'}
        alignItems={variant === 'column' ? 'stretch' : undefined}
        gap={1}
      >
        {PALETTE_NODE_TYPES.map((type) => (
          <Chip
            key={type}
            label={type}
            size="small"
            draggable
            onDragStart={(event) => handleDragStart(event, type)}
            sx={{ cursor: 'grab', justifyContent: variant === 'column' ? 'flex-start' : undefined }}
          />
        ))}
      </Stack>
    </Box>
  );
}
