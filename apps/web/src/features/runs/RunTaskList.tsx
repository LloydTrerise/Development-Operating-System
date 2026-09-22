import { List, ListItemButton, ListItemText, Stack, Typography } from '@mui/material';
import { StatusChip } from '../../components/StatusChip.js';
import type { WorkflowTask } from '../../api-client.js';

/**
 * DEVOS-214: the mockup's master task list — the same real task data
 * `RunCard` already fetched, just presented as a selectable dense list
 * instead of a flat stacked one.
 */
export function RunTaskList({
  tasks,
  selectedTaskId,
  onSelect,
}: {
  tasks: WorkflowTask[];
  selectedTaskId: string | null;
  onSelect: (taskId: string) => void;
}) {
  if (tasks.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ p: 1.5 }}>
        No tasks yet.
      </Typography>
    );
  }

  return (
    <List dense disablePadding>
      {tasks.map((task, index) => (
        <ListItemButton
          key={task.id}
          selected={task.id === selectedTaskId}
          onClick={() => onSelect(task.id)}
          divider
        >
          <ListItemText
            primary={
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <Typography variant="body2">
                  {index + 1}. {task.nodeId}
                </Typography>
                <StatusChip status={task.status} />
              </Stack>
            }
            secondary={task.type}
          />
        </ListItemButton>
      ))}
    </List>
  );
}
