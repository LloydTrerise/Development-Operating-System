import { Box, List, ListItem, Paper, Stack, Typography } from '@mui/material';
import { ErrorAlert } from '../../components/ErrorAlert.js';
import { StatusChip } from '../../components/StatusChip.js';
import type { AgentExecutionSummary, ToolInvocationSummary, WorkflowTask } from '../../api-client.js';

const PRE_PAPER_SX = {
  p: 1,
  fontFamily: 'monospace',
  fontSize: 12,
  overflow: 'auto',
  m: 0,
} as const;

/**
 * DEVOS-214: the mockup's task-detail pane, scoped to one selected task —
 * the exact agent-execution/tool-invocation content `RunCard` already
 * rendered inline for every task at once, now shown for the selected one.
 */
export function RunTaskDetail({
  task,
  agentExecution,
  toolInvocations,
}: {
  task: WorkflowTask | undefined;
  agentExecution: AgentExecutionSummary | undefined;
  toolInvocations: ToolInvocationSummary[];
}) {
  if (!task) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ p: 1.5 }}>
        Select a task to see its detail.
      </Typography>
    );
  }

  return (
    <Box sx={{ p: 1.5 }}>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
        <Typography variant="subtitle2">{task.nodeId}</Typography>
        <StatusChip status={task.status} />
        {task.attempt > 0 && (
          <Typography variant="caption" color="text.secondary">
            attempt {task.attempt}
          </Typography>
        )}
      </Stack>
      <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 1 }}>
        {task.type}
      </Typography>
      {task.error && <ErrorAlert message={task.error} />}

      {agentExecution && (
        <Box sx={{ mt: 1.5 }}>
          <Typography variant="caption" color="text.secondary" component="div">
            Agent
          </Typography>
          <Typography variant="body2">
            {agentExecution.role}
            {agentExecution.promptReference && ` (prompt ${agentExecution.promptReference})`} —{' '}
            {agentExecution.status}
          </Typography>
          {agentExecution.contextManifest && (
            <>
              <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1 }}>
                Context manifest
              </Typography>
              <Typography variant="body2">
                {agentExecution.contextManifest.sourceCount} source
                {agentExecution.contextManifest.sourceCount === 1 ? '' : 's'}:{' '}
                {agentExecution.contextManifest.sources.map((s) => s.type).join(', ')}
              </Typography>
            </>
          )}
          {agentExecution.output && (
            <>
              <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1 }}>
                Output
              </Typography>
              <Paper variant="outlined" component="pre" sx={PRE_PAPER_SX}>
                {JSON.stringify(agentExecution.output, null, 2)}
              </Paper>
            </>
          )}
          {agentExecution.errorMessage && <ErrorAlert message={agentExecution.errorMessage} />}
        </Box>
      )}

      {toolInvocations.length > 0 && (
        <Box sx={{ mt: 1.5 }}>
          <Typography variant="caption" color="text.secondary" component="div">
            Tool invocations
          </Typography>
          <List dense disablePadding>
            {toolInvocations.map((invocation) => (
              <ListItem key={invocation.invocationId} disableGutters sx={{ display: 'block' }}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <Typography variant="body2">{invocation.capabilityKey}</Typography>
                  <StatusChip status={invocation.status} />
                  {invocation.providerReference && (
                    <Typography variant="caption" color="text.secondary">
                      evidence: {invocation.providerReference}
                    </Typography>
                  )}
                </Stack>
                {invocation.errorCode && <ErrorAlert message={invocation.errorCode} />}
                {invocation.outputMetadata && (
                  <Paper variant="outlined" component="pre" sx={{ ...PRE_PAPER_SX, mt: 0.5 }}>
                    {JSON.stringify(invocation.outputMetadata, null, 2)}
                  </Paper>
                )}
              </ListItem>
            ))}
          </List>
        </Box>
      )}

      {!agentExecution && toolInvocations.length === 0 && !task.error && (
        <Typography variant="body2" color="text.secondary">
          No agent execution or tool invocations recorded for this task.
        </Typography>
      )}
    </Box>
  );
}
