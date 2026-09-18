import { useMemo } from 'react';
import { Chip, List, ListItem, ListItemText, Paper, Stack, Typography } from '@mui/material';
import { diffWorkflowVersions } from '@devos/domain';
import type { WorkflowDefinition as ContractsWorkflowGraph } from '@devos/contracts';
import type { WorkflowGraph } from '../api-client.js';

/**
 * DEVOS-133 (Sprint 14): renders the real, computed structural diff between
 * two published `WorkflowVersion` graphs — imports `diffWorkflowVersions`
 * directly from `@devos/domain`, the same real-function-in-the-browser
 * pattern DEVOS-131/134 already proved safe.
 */
export interface WorkflowVersionDiffViewProps {
  before: WorkflowGraph;
  beforeVersion: number;
  after: WorkflowGraph;
  afterVersion: number;
}

export function WorkflowVersionDiffView({
  before,
  beforeVersion,
  after,
  afterVersion,
}: WorkflowVersionDiffViewProps) {
  const diff = useMemo(
    () =>
      diffWorkflowVersions(
        before as unknown as ContractsWorkflowGraph,
        after as unknown as ContractsWorkflowGraph,
      ),
    [before, after],
  );

  const hasChanges =
    diff.nodesAdded.length > 0 ||
    diff.nodesRemoved.length > 0 ||
    diff.nodesChanged.length > 0 ||
    diff.edgesAdded.length > 0 ||
    diff.edgesRemoved.length > 0 ||
    diff.policiesAdded.length > 0 ||
    diff.policiesRemoved.length > 0 ||
    diff.outputsAdded.length > 0 ||
    diff.outputsRemoved.length > 0;

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="subtitle2" gutterBottom>
        Diff: version {beforeVersion} → version {afterVersion}
      </Typography>
      {!hasChanges && <Typography variant="body2">No structural differences.</Typography>}
      {hasChanges && (
        <List dense>
          {diff.nodesAdded.map((node) => (
            <ListItem key={`node-added-${node.id}`}>
              <Chip label="+ node" color="success" size="small" sx={{ mr: 1 }} />
              <ListItemText primary={`${node.id} (${node.type})`} />
            </ListItem>
          ))}
          {diff.nodesRemoved.map((node) => (
            <ListItem key={`node-removed-${node.id}`}>
              <Chip label="− node" color="error" size="small" sx={{ mr: 1 }} />
              <ListItemText primary={`${node.id} (${node.type})`} />
            </ListItem>
          ))}
          {diff.nodesChanged.map((change) => (
            <ListItem key={`node-changed-${change.id}`}>
              <Chip label="~ node" color="warning" size="small" sx={{ mr: 1 }} />
              <ListItemText
                primary={change.id}
                secondary={
                  <Stack component="span" direction="column">
                    <Typography component="span" variant="caption" display="block">
                      before: {JSON.stringify(change.before)}
                    </Typography>
                    <Typography component="span" variant="caption" display="block">
                      after: {JSON.stringify(change.after)}
                    </Typography>
                  </Stack>
                }
              />
            </ListItem>
          ))}
          {diff.edgesAdded.map((edge, index) => (
            <ListItem key={`edge-added-${index}`}>
              <Chip label="+ edge" color="success" size="small" sx={{ mr: 1 }} />
              <ListItemText
                primary={`${edge.from} → ${edge.to}${edge.branch ? ` (branch: ${edge.branch})` : ''}`}
              />
            </ListItem>
          ))}
          {diff.edgesRemoved.map((edge, index) => (
            <ListItem key={`edge-removed-${index}`}>
              <Chip label="− edge" color="error" size="small" sx={{ mr: 1 }} />
              <ListItemText
                primary={`${edge.from} → ${edge.to}${edge.branch ? ` (branch: ${edge.branch})` : ''}`}
              />
            </ListItem>
          ))}
          {diff.policiesAdded.map((policy) => (
            <ListItem key={`policy-added-${policy}`}>
              <Chip label="+ policy" color="success" size="small" sx={{ mr: 1 }} />
              <ListItemText primary={policy} />
            </ListItem>
          ))}
          {diff.policiesRemoved.map((policy) => (
            <ListItem key={`policy-removed-${policy}`}>
              <Chip label="− policy" color="error" size="small" sx={{ mr: 1 }} />
              <ListItemText primary={policy} />
            </ListItem>
          ))}
        </List>
      )}
    </Paper>
  );
}
