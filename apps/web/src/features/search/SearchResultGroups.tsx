import { List, ListItemButton, ListItemText, ListSubheader, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import type {
  Agent,
  Artifact,
  ProjectSearchResults,
  WorkItem,
  WorkflowDefinitionSummary,
} from '../../api-client.js';
import { StatusChip } from '../../components/StatusChip.js';

/**
 * DEVOS-264/265: the one, shared grouped-result renderer both `GlobalSearch`
 * and `CommandPalette` use — navigation targets mirror `README.md`'s own
 * per-entity-type audit exactly: work item/artifact/agent go to their real
 * `/{area}/:id` detail route; workflow has no such route, so it goes to
 * `/workflow-library?workflowId=` (a new deep-link this sprint adds there).
 */
export function SearchResultGroups({
  results,
  onNavigate,
}: {
  results: ProjectSearchResults;
  onNavigate: () => void;
}) {
  const navigate = useNavigate();

  const hasAny =
    results.workItems.length > 0 ||
    results.artifacts.length > 0 ||
    results.workflows.length > 0 ||
    results.agents.length > 0;

  if (!hasAny) {
    return (
      <Typography
        data-testid="search-results-empty"
        variant="body2"
        color="text.secondary"
        sx={{ p: 2 }}
      >
        No results for &ldquo;{results.query}&rdquo;.
      </Typography>
    );
  }

  function go(path: string) {
    onNavigate();
    navigate(path);
  }

  return (
    <List dense disablePadding data-testid="search-results">
      {results.workItems.length > 0 && (
        <li>
          <ul style={{ padding: 0 }}>
            <ListSubheader component="div">Work Items</ListSubheader>
            {results.workItems.map((workItem: WorkItem) => (
              <ListItemButton
                key={workItem.id}
                data-command-item
                onClick={() => go(`/work-items/${workItem.id}`)}
              >
                <ListItemText primary={workItem.title} secondary={workItem.type} />
                <StatusChip status={workItem.status} />
              </ListItemButton>
            ))}
          </ul>
        </li>
      )}
      {results.artifacts.length > 0 && (
        <li>
          <ul style={{ padding: 0 }}>
            <ListSubheader component="div">Artifacts</ListSubheader>
            {results.artifacts.map((artifact: Artifact) => (
              <ListItemButton
                key={artifact.id}
                data-command-item
                onClick={() => go(`/artifacts/${artifact.id}`)}
              >
                <ListItemText primary={artifact.name} secondary={artifact.type} />
                <StatusChip status={artifact.status} />
              </ListItemButton>
            ))}
          </ul>
        </li>
      )}
      {results.workflows.length > 0 && (
        <li>
          <ul style={{ padding: 0 }}>
            <ListSubheader component="div">Workflows</ListSubheader>
            {results.workflows.map((workflow: WorkflowDefinitionSummary) => (
              <ListItemButton
                key={workflow.id}
                data-command-item
                onClick={() => go(`/workflow-library?workflowId=${workflow.id}`)}
              >
                <ListItemText primary={workflow.name} secondary={workflow.key} />
              </ListItemButton>
            ))}
          </ul>
        </li>
      )}
      {results.agents.length > 0 && (
        <li>
          <ul style={{ padding: 0 }}>
            <ListSubheader component="div">Agents</ListSubheader>
            {results.agents.map((agent: Agent) => (
              <ListItemButton
                key={agent.id}
                data-command-item
                onClick={() => go(`/agents/${agent.id}`)}
              >
                <ListItemText primary={agent.name} secondary={agent.key} />
                <StatusChip status={agent.status} />
              </ListItemButton>
            ))}
          </ul>
        </li>
      )}
    </List>
  );
}
