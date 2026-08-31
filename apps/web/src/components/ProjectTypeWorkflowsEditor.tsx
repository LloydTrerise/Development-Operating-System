import { useEffect, useState, type FormEvent } from 'react';
import {
  Button,
  FormControl,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import {
  createProjectTypeWorkflow,
  listProjectTypeAgents,
  listProjectTypeWorkflows,
  updateProjectTypeWorkflow,
  type ProjectTypeWorkflow,
  type WorkflowEdge,
  type WorkflowNode,
} from '../api-client.js';
import { ErrorAlert } from './ErrorAlert.js';
import { LoadingState } from './LoadingState.js';

const WORKFLOW_NODE_TYPES = [
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

const DEFAULT_TRIGGER = { type: 'WORK_ITEM_MANUAL' };
const DEFAULT_INPUTS = [{ name: 'workItemId', type: 'WORK_ITEM', required: true }];

interface DraftState {
  name: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

function toDraft(workflow: ProjectTypeWorkflow): DraftState {
  return {
    name: workflow.name,
    nodes: workflow.definition.nodes,
    edges: workflow.definition.edges,
  };
}

const EMPTY_DRAFT: DraftState = { name: '', nodes: [], edges: [] };

export function ProjectTypeWorkflowsEditor({ projectTypeId }: { projectTypeId: string }) {
  const [workflows, setWorkflows] = useState<ProjectTypeWorkflow[]>([]);
  const [agentKeys, setAgentKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([
      listProjectTypeWorkflows(projectTypeId),
      listProjectTypeAgents(projectTypeId),
    ]).then(([workflowsResult, agentsResult]) => {
      if (cancelled) return;
      setLoading(false);

      if (!workflowsResult.ok) {
        setError(workflowsResult.error.message);
        return;
      }

      setError(null);
      setWorkflows(workflowsResult.data);
      setAgentKeys(agentsResult.ok ? agentsResult.data.map((agent) => agent.key) : []);
    });

    return () => {
      cancelled = true;
    };
  }, [projectTypeId, refreshToken]);

  function selectWorkflow(workflow: ProjectTypeWorkflow) {
    setSelectedKey(workflow.key);
    setCreating(false);
    setNewKey('');
    setDraft(toDraft(workflow));
    setSubmitError(null);
  }

  function startNew() {
    setSelectedKey(null);
    setCreating(true);
    setNewKey('');
    setDraft(EMPTY_DRAFT);
    setSubmitError(null);
  }

  function addNode() {
    setDraft({
      ...draft,
      nodes: [...draft.nodes, { id: '', type: 'TASK', name: '', agentRef: '' }],
    });
  }

  function updateNode(index: number, changes: Partial<WorkflowNode>) {
    setDraft({
      ...draft,
      nodes: draft.nodes.map((node, i) => (i === index ? { ...node, ...changes } : node)),
    });
  }

  function removeNode(index: number) {
    setDraft({ ...draft, nodes: draft.nodes.filter((_, i) => i !== index) });
  }

  function addEdge() {
    setDraft({ ...draft, edges: [...draft.edges, { from: '', to: '' }] });
  }

  function updateEdge(index: number, changes: Partial<WorkflowEdge>) {
    setDraft({
      ...draft,
      edges: draft.edges.map((edge, i) => (i === index ? { ...edge, ...changes } : edge)),
    });
  }

  function removeEdge(index: number) {
    setDraft({ ...draft, edges: draft.edges.filter((_, i) => i !== index) });
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError(null);

    const existing = selectedKey ? workflows.find((w) => w.key === selectedKey) : undefined;
    const cleanedNodes = draft.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      ...(node.name ? { name: node.name } : {}),
      ...(node.type === 'AGENT_TASK' && node.agentRef ? { agentRef: node.agentRef } : {}),
    }));
    const definition = {
      name: draft.name,
      trigger: existing?.definition.trigger ?? DEFAULT_TRIGGER,
      inputs: existing?.definition.inputs ?? DEFAULT_INPUTS,
      nodes: cleanedNodes,
      edges: draft.edges,
      policies: existing?.definition.policies ?? [],
      outputs: existing?.definition.outputs ?? [],
    };

    const result = existing
      ? await updateProjectTypeWorkflow(projectTypeId, existing.key, {
          name: draft.name,
          definition,
        })
      : await createProjectTypeWorkflow(projectTypeId, {
          key: newKey,
          name: draft.name,
          definition,
        });

    setSubmitting(false);

    if (!result.ok) {
      setSubmitError(result.error.message);
      return;
    }

    setSelectedKey(result.data.key);
    setCreating(false);
    setRefreshToken((token) => token + 1);
  }

  return (
    <section>
      <Typography variant="subtitle1" gutterBottom>
        Workflow templates
      </Typography>

      {loading && <LoadingState label="Loading workflow templates…" />}
      {error && <ErrorAlert message={`Failed to load workflow templates: ${error}`} />}

      {!loading && !error && (
        <List dense sx={{ maxWidth: 320, mb: 2 }}>
          {workflows.map((workflow) => (
            <ListItemButton
              key={workflow.id}
              selected={selectedKey === workflow.key}
              onClick={() => selectWorkflow(workflow)}
            >
              <ListItemText primary={`${workflow.name} (${workflow.key})`} />
            </ListItemButton>
          ))}
          <ListItemButton selected={selectedKey === null} onClick={startNew}>
            <ListItemText primary="+ New workflow template" />
          </ListItemButton>
        </List>
      )}

      {!loading && !error && (selectedKey !== null || creating) && (
        <Stack component="form" onSubmit={handleSave} spacing={2} sx={{ maxWidth: 720 }}>
          {selectedKey === null && (
            <TextField
              label="Key"
              value={newKey}
              onChange={(event) => setNewKey(event.target.value)}
              required
              size="small"
            />
          )}
          <TextField
            label="Name"
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            required
            size="small"
          />

          <Typography variant="body2">Nodes</Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Agent ref</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {draft.nodes.map((node, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <TextField
                      size="small"
                      value={node.id}
                      onChange={(event) => updateNode(index, { id: event.target.value })}
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      size="small"
                      value={node.type}
                      onChange={(event) => updateNode(index, { type: event.target.value })}
                    >
                      {WORKFLOW_NODE_TYPES.map((type) => (
                        <MenuItem key={type} value={type}>
                          {type}
                        </MenuItem>
                      ))}
                    </Select>
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      value={node.name ?? ''}
                      onChange={(event) => updateNode(index, { name: event.target.value })}
                    />
                  </TableCell>
                  <TableCell>
                    <FormControl
                      size="small"
                      sx={{ minWidth: 160 }}
                      disabled={node.type !== 'AGENT_TASK'}
                    >
                      <Select
                        value={node.agentRef ?? ''}
                        displayEmpty
                        onChange={(event) => updateNode(index, { agentRef: event.target.value })}
                      >
                        <MenuItem value="">
                          <em>None</em>
                        </MenuItem>
                        {agentKeys.map((key) => (
                          <MenuItem key={key} value={key}>
                            {key}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      onClick={() => removeNode(index)}
                      aria-label="Remove node"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Button size="small" onClick={addNode} sx={{ alignSelf: 'flex-start' }}>
            + Add node
          </Button>

          <Typography variant="body2">Edges</Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>From</TableCell>
                <TableCell>To</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {draft.edges.map((edge, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <TextField
                      size="small"
                      value={edge.from}
                      onChange={(event) => updateEdge(index, { from: event.target.value })}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      value={edge.to}
                      onChange={(event) => updateEdge(index, { to: event.target.value })}
                    />
                  </TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      onClick={() => removeEdge(index)}
                      aria-label="Remove edge"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Button size="small" onClick={addEdge} sx={{ alignSelf: 'flex-start' }}>
            + Add edge
          </Button>

          <Button
            type="submit"
            variant="contained"
            disabled={submitting}
            sx={{ alignSelf: 'flex-start' }}
          >
            {submitting ? 'Saving…' : selectedKey ? 'Save changes' : 'Create workflow template'}
          </Button>
          {submitError && <ErrorAlert message={submitError} />}
        </Stack>
      )}
    </section>
  );
}
