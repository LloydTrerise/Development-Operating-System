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

export function WorkflowPalette() {
  function handleDragStart(event: DragEvent<HTMLDivElement>, nodeType: string) {
    event.dataTransfer.setData(PALETTE_DRAG_MIME_TYPE, nodeType);
    event.dataTransfer.effectAllowed = 'move';
  }

  return (
    <Box>
      <Typography variant="caption" color="text.secondary" gutterBottom sx={{ display: 'block' }}>
        Drag a node type onto the canvas
      </Typography>
      <Stack direction="row" flexWrap="wrap" gap={1}>
        {PALETTE_NODE_TYPES.map((type) => (
          <Chip
            key={type}
            label={type}
            size="small"
            draggable
            onDragStart={(event) => handleDragStart(event, type)}
            sx={{ cursor: 'grab' }}
          />
        ))}
      </Stack>
    </Box>
  );
}
