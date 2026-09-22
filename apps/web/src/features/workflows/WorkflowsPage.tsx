import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  FormControl,
  InputLabel,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import {
  createWorkflowVersionDraft,
  getWorkflowVersionByNumber,
  listAgents,
  listWorkflowVersions,
  listWorkflows,
  publishWorkflowVersion,
  updateDraftWorkflow,
  type WorkflowDefinitionSummary,
  type WorkflowVersionDto,
} from '../../api-client.js';
import { ErrorAlert } from '../../components/ErrorAlert.js';
import { LoadingState } from '../../components/LoadingState.js';
import { WorkflowCanvas } from '../../components/WorkflowCanvas.js';
import { WorkflowNodeInspector } from '../../components/WorkflowNodeInspector.js';
import { WorkflowPalette } from '../../components/WorkflowPalette.js';
import { WorkflowPathPreview } from '../../components/WorkflowPathPreview.js';
import { WorkflowVersionDiffView } from '../../components/WorkflowVersionDiffView.js';
import { useProjectContext } from '../../project-context.js';
import { useWorkflowGraphValidation, type ValidatableGraph } from '../../workflow-graph-validation.js';

/**
 * DEVOS-136 (Sprint 14): the other half of `specs/architecture/organisations-and-project-types.md`
 * §2's own confirmed gap ("the web app has zero client functions or UI for
 * it" — a real project's own `WorkflowVersion` draft → validate → publish
 * lifecycle). Reuses Sprint 13's canvas/palette/inspector components
 * verbatim — only what they're bound to (a real project's own `WorkflowVersion`
 * instead of a `ProjectTypeWorkflow` template) and the save/publish wiring
 * differ.
 */
export function WorkflowsPage() {
  const { selectedProjectId } = useProjectContext();
  const [definitions, setDefinitions] = useState<WorkflowDefinitionSummary[]>([]);
  const [agentKeys, setAgentKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [versions, setVersions] = useState<WorkflowVersionDto[]>([]);
  const [latestVersion, setLatestVersion] = useState<WorkflowVersionDto | null>(null);
  const [draft, setDraft] = useState<ValidatableGraph | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [diffBeforeVersion, setDiffBeforeVersion] = useState<number | ''>('');
  const [diffAfterVersion, setDiffAfterVersion] = useState<number | ''>('');
  const [diffBefore, setDiffBefore] = useState<WorkflowVersionDto | null>(null);
  const [diffAfter, setDiffAfter] = useState<WorkflowVersionDto | null>(null);

  useEffect(() => {
    if (!selectedProjectId) return;
    let cancelled = false;
    setLoading(true);

    Promise.all([listWorkflows(selectedProjectId), listAgents(selectedProjectId)]).then(
      ([workflowsResult, agentsResult]) => {
        if (cancelled) return;
        setLoading(false);
        if (!workflowsResult.ok) {
          setError(workflowsResult.error.message);
          return;
        }
        setError(null);
        setDefinitions(workflowsResult.data);
        setAgentKeys(agentsResult.ok ? agentsResult.data.map((agent) => agent.key) : []);
      },
    );

    return () => {
      cancelled = true;
    };
  }, [selectedProjectId, refreshToken]);

  useEffect(() => {
    if (!selectedWorkflowId) {
      setVersions([]);
      setLatestVersion(null);
      setDraft(null);
      return;
    }
    let cancelled = false;
    setActionError(null);
    setSelectedNodeId(null);
    setDiffBeforeVersion('');
    setDiffAfterVersion('');
    setDiffBefore(null);
    setDiffAfter(null);

    listWorkflowVersions(selectedWorkflowId).then(async (versionsResult) => {
      if (cancelled) return;
      if (!versionsResult.ok || versionsResult.data.length === 0) {
        setVersions([]);
        setLatestVersion(null);
        setDraft(null);
        return;
      }
      setVersions(versionsResult.data);
      const latest = versionsResult.data.reduce((max, candidate) =>
        candidate.version > max.version ? candidate : max,
      );
      const fullResult = await getWorkflowVersionByNumber(selectedWorkflowId, latest.version);
      if (cancelled || !fullResult.ok) return;
      setLatestVersion(fullResult.data);
      setDraft(
        fullResult.data.status === 'DRAFT'
          ? {
              name: fullResult.data.definition.name,
              nodes: fullResult.data.definition.nodes,
              edges: fullResult.data.definition.edges,
            }
          : null,
      );
    });

    return () => {
      cancelled = true;
    };
  }, [selectedWorkflowId, refreshToken]);

  useEffect(() => {
    if (!selectedWorkflowId || diffBeforeVersion === '' || diffAfterVersion === '') {
      setDiffBefore(null);
      setDiffAfter(null);
      return;
    }
    let cancelled = false;
    Promise.all([
      getWorkflowVersionByNumber(selectedWorkflowId, diffBeforeVersion),
      getWorkflowVersionByNumber(selectedWorkflowId, diffAfterVersion),
    ]).then(([beforeResult, afterResult]) => {
      if (cancelled) return;
      setDiffBefore(beforeResult.ok ? beforeResult.data : null);
      setDiffAfter(afterResult.ok ? afterResult.data : null);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedWorkflowId, diffBeforeVersion, diffAfterVersion]);

  const validationIssues = useWorkflowGraphValidation(draft ?? { name: '', nodes: [], edges: [] });

  async function handleStartDraft() {
    if (!selectedWorkflowId) return;
    setBusy(true);
    setActionError(null);
    const result = await createWorkflowVersionDraft(selectedWorkflowId);
    setBusy(false);
    if (!result.ok) {
      setActionError(result.error.message);
      return;
    }
    setRefreshToken((token) => token + 1);
  }

  async function handleSave() {
    if (!selectedWorkflowId || !latestVersion || !draft) return;
    setBusy(true);
    setActionError(null);
    const result = await updateDraftWorkflow(selectedWorkflowId, {
      ...latestVersion.definition,
      name: draft.name,
      nodes: draft.nodes,
      edges: draft.edges,
    });
    setBusy(false);
    if (!result.ok) {
      setActionError(result.error.message);
      return;
    }
    setRefreshToken((token) => token + 1);
  }

  async function handlePublish() {
    if (!selectedWorkflowId) return;
    setBusy(true);
    setActionError(null);
    const result = await publishWorkflowVersion(selectedWorkflowId);
    setBusy(false);
    if (!result.ok) {
      setActionError(result.error.message);
      return;
    }
    setRefreshToken((token) => token + 1);
  }

  if (!selectedProjectId) {
    return <Typography>Select a project to view its workflows.</Typography>;
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h5">Workflows</Typography>
      {loading && <LoadingState label="Loading workflows…" />}
      {error && <ErrorAlert message={`Failed to load workflows: ${error}`} />}

      {!loading && !error && (
        <List dense sx={{ maxWidth: 360 }}>
          {definitions.map((definition) => (
            <ListItemButton
              key={definition.id}
              selected={selectedWorkflowId === definition.id}
              onClick={() => setSelectedWorkflowId(definition.id)}
            >
              <ListItemText primary={`${definition.name} (${definition.key})`} />
            </ListItemButton>
          ))}
          {definitions.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>
              No workflows in this project yet.
            </Typography>
          )}
        </List>
      )}

      {selectedWorkflowId && latestVersion && (
        <Stack spacing={2}>
          <Typography variant="subtitle1">
            Version {latestVersion.version} — {latestVersion.status}
          </Typography>

          {versions.length > 1 && (
            <Stack spacing={1}>
              <Typography variant="body2">Compare versions</Typography>
              <Stack direction="row" spacing={2}>
                <FormControl size="small" sx={{ minWidth: 160 }}>
                  <InputLabel id="diff-before-version">From</InputLabel>
                  <Select<number | ''>
                    labelId="diff-before-version"
                    label="From"
                    value={diffBeforeVersion}
                    onChange={(event) =>
                      setDiffBeforeVersion(
                        event.target.value === '' ? '' : Number(event.target.value),
                      )
                    }
                  >
                    <MenuItem value="">
                      <em>Choose a version</em>
                    </MenuItem>
                    {versions.map((version) => (
                      <MenuItem key={version.version} value={version.version}>
                        v{version.version} ({version.status})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 160 }}>
                  <InputLabel id="diff-after-version">To</InputLabel>
                  <Select<number | ''>
                    labelId="diff-after-version"
                    label="To"
                    value={diffAfterVersion}
                    onChange={(event) =>
                      setDiffAfterVersion(
                        event.target.value === '' ? '' : Number(event.target.value),
                      )
                    }
                  >
                    <MenuItem value="">
                      <em>Choose a version</em>
                    </MenuItem>
                    {versions.map((version) => (
                      <MenuItem key={version.version} value={version.version}>
                        v{version.version} ({version.status})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>
              {diffBefore && diffAfter && (
                <WorkflowVersionDiffView
                  before={diffBefore.definition}
                  beforeVersion={diffBefore.version}
                  after={diffAfter.definition}
                  afterVersion={diffAfter.version}
                />
              )}
            </Stack>
          )}

          {actionError && <ErrorAlert message={actionError} />}

          {latestVersion.status !== 'DRAFT' && (
            <Alert
              severity="info"
              action={
                <Button size="small" disabled={busy} onClick={handleStartDraft}>
                  Start new draft
                </Button>
              }
            >
              This version is published and immutable. Start a new draft to edit it.
            </Alert>
          )}

          {draft && (
            <>
              <WorkflowPalette />
              <WorkflowCanvas
                nodes={draft.nodes}
                edges={draft.edges}
                onNodesReposition={(nodes) => setDraft({ ...draft, nodes })}
                onNodeCreate={(node) => setDraft({ ...draft, nodes: [...draft.nodes, node] })}
                onEdgeCreate={(edge) => setDraft({ ...draft, edges: [...draft.edges, edge] })}
                selectedNodeId={selectedNodeId}
                onNodeSelect={setSelectedNodeId}
              />
              {(() => {
                const selectedIndex = draft.nodes.findIndex((node) => node.id === selectedNodeId);
                if (selectedIndex === -1) return null;
                const selectedNode = draft.nodes[selectedIndex]!;
                return (
                  <WorkflowNodeInspector
                    node={selectedNode}
                    otherNodeIds={draft.nodes
                      .map((node) => node.id)
                      .filter((id) => id !== selectedNode.id && id.length > 0)}
                    agentKeys={agentKeys}
                    onChange={(changes) =>
                      setDraft({
                        ...draft,
                        nodes: draft.nodes.map((node, i) =>
                          i === selectedIndex ? { ...node, ...changes } : node,
                        ),
                      })
                    }
                  />
                );
              })()}

              {validationIssues.length > 0 && (
                <ErrorAlert
                  message={`This graph has ${validationIssues.length} real structural issue${validationIssues.length === 1 ? '' : 's'} (cannot save until fixed): ${validationIssues
                    .map((issue) => `${issue.field}: ${issue.message}`)
                    .join(' | ')}`}
                />
              )}

              {validationIssues.length === 0 && (
                <WorkflowPathPreview nodes={draft.nodes} edges={draft.edges} />
              )}

              <Stack direction="row" spacing={2}>
                <Button
                  variant="contained"
                  disabled={busy || validationIssues.length > 0}
                  onClick={handleSave}
                >
                  Save draft
                </Button>
                <Button
                  variant="outlined"
                  disabled={busy || validationIssues.length > 0}
                  onClick={handlePublish}
                >
                  Publish
                </Button>
              </Stack>
            </>
          )}
        </Stack>
      )}
    </Stack>
  );
}
