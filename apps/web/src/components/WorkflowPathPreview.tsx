import { useMemo } from 'react';
import { Alert, List, ListItem, ListItemText, Paper, Typography } from '@mui/material';
import { computeExecutionPaths, type ExecutionPath } from '@devos/domain';
import type { WorkflowDefinition as WorkflowGraph } from '@devos/contracts';
import type { WorkflowEdge, WorkflowNode } from '../api-client.js';

/**
 * DEVOS-134 (Sprint 14): a real, static preview of the graph's own computed
 * paths (Designer spec §29) — imports `computeExecutionPaths` directly from
 * `@devos/domain`, the same real-function-in-the-browser pattern DEVOS-131
 * already proved safe for `validateWorkflowGraph` (confirmed again here:
 * `computeExecutionPaths` has the identical "pure, no I/O" shape).
 */
export interface WorkflowPathPreviewProps {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

function describePath(path: ExecutionPath, nodesById: Map<string, WorkflowNode>): string {
  const names = path.nodeIds.map((id) => nodesById.get(id)?.name || id);
  const tags: string[] = [];
  if (path.branchesTaken.length > 0) tags.push(`branch: ${path.branchesTaken.join(' → ')}`);
  if (path.passesThroughParallelOrJoin) tags.push('parallel/join');
  if (path.passesThroughApproval) tags.push('approval');
  const suffix = tags.length > 0 ? ` (${tags.join(', ')})` : '';
  return `${names.join(' → ')}${suffix}`;
}

export function WorkflowPathPreview({ nodes, edges }: WorkflowPathPreviewProps) {
  const paths = useMemo(
    () =>
      computeExecutionPaths({
        name: '',
        trigger: {},
        inputs: [],
        nodes,
        edges,
        policies: [],
        outputs: [],
      } as unknown as WorkflowGraph),
    [nodes, edges],
  );
  const nodesById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="subtitle2" gutterBottom>
        Execution paths ({paths.length})
      </Typography>
      <Alert severity="info" sx={{ mb: 1 }}>
        Computed from the graph&apos;s own structure — not a guarantee this exact sequence will
        occur at runtime.
      </Alert>
      <List dense>
        {paths.map((path, index) => (
          <ListItem key={index} disableGutters>
            <ListItemText primary={describePath(path, nodesById)} />
          </ListItem>
        ))}
        {paths.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            No path could be computed (the graph may be empty or fully cyclic).
          </Typography>
        )}
      </List>
    </Paper>
  );
}
