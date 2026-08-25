import { useEffect, useState, type FormEvent } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  getArtifactVersion,
  getReleaseReadiness,
  getRun,
  listAgentExecutionSummaries,
  listArtifacts,
  listRunTasks,
  listToolInvocationSummaries,
  listWorkflowRunsForWorkItem,
  listWorkItems,
  listWorkflows,
  startRun,
  RUN_TERMINAL_STATUSES,
  type AgentExecutionSummary,
  type Artifact,
  type ArtifactVersion,
  type ReleaseReadiness,
  type ToolInvocationSummary,
  type WorkflowDefinitionSummary,
  type WorkflowRun,
  type WorkflowTask,
  type WorkItem,
} from '../api-client.js';
import { ErrorAlert } from '../components/ErrorAlert.js';
import { StatusChip } from '../components/StatusChip.js';
import { useProjectContext } from '../project-context.js';

const POLL_INTERVAL_MS = 2000;

const PRE_PAPER_SX = {
  p: 1,
  fontFamily: 'monospace',
  fontSize: 12,
  overflow: 'auto',
  m: 0,
} as const;

function RunCard({
  run: initialRun,
  projectId,
  artifacts,
  onCompleted,
}: {
  run: WorkflowRun;
  projectId: string;
  artifacts: Artifact[];
  onCompleted: () => void;
}) {
  const [run, setRun] = useState(initialRun);
  const [tasks, setTasks] = useState<WorkflowTask[]>([]);
  const [agentExecutions, setAgentExecutions] = useState<AgentExecutionSummary[]>([]);
  const [toolInvocations, setToolInvocations] = useState<ToolInvocationSummary[]>([]);
  const [testEvidence, setTestEvidence] = useState<ArtifactVersion | null>(null);
  const [reviewEvidence, setReviewEvidence] = useState<ArtifactVersion | null>(null);
  const [releaseReadiness, setReleaseReadiness] = useState<ReleaseReadiness | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const wasTerminal = RUN_TERMINAL_STATUSES.has(run.status);

    async function poll() {
      const [runResult, tasksResult, summariesResult, toolInvocationsResult, artifactsResult] =
        await Promise.all([
          getRun(run.id),
          listRunTasks(run.id),
          listAgentExecutionSummaries(run.id),
          listToolInvocationSummaries(run.id),
          listArtifacts(projectId),
        ]);
      if (cancelled) return;

      if (!runResult.ok) {
        setPollError(runResult.error.message);
        return;
      }
      setPollError(null);
      setRun(runResult.data);
      if (tasksResult.ok) setTasks(tasksResult.data);
      if (summariesResult.ok) setAgentExecutions(summariesResult.data);
      if (toolInvocationsResult.ok) setToolInvocations(toolInvocationsResult.data);

      // DEVOS-070: test/review evidence for this run's own development
      // cycle — fetched fresh each poll (not from the parent's own
      // `artifacts` prop, which only refreshes when a run reaches a
      // terminal status, too late to show evidence produced mid-run).
      if (artifactsResult.ok) {
        const ownArtifacts = artifactsResult.data.filter(
          (artifact) => artifact.provenance.workflowRunId === run.id,
        );
        const latestOfType = (type: string) =>
          ownArtifacts
            .filter((artifact) => artifact.type === type)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

        const testEvidenceArtifact = latestOfType('TEST_EVIDENCE');
        if (testEvidenceArtifact) {
          const versionResult = await getArtifactVersion(testEvidenceArtifact.id, 1);
          if (!cancelled && versionResult.ok) setTestEvidence(versionResult.data);
        }
        const reviewEvidenceArtifact = latestOfType('REVIEW_EVIDENCE');
        if (reviewEvidenceArtifact) {
          const versionResult = await getArtifactVersion(reviewEvidenceArtifact.id, 1);
          if (!cancelled && versionResult.ok) setReviewEvidence(versionResult.data);
        }
      }

      const readinessResult = await getReleaseReadiness(projectId);
      if (!cancelled && readinessResult.ok) setReleaseReadiness(readinessResult.data);

      if (!wasTerminal && RUN_TERMINAL_STATUSES.has(runResult.data.status)) onCompleted();
    }

    poll();

    if (wasTerminal) return;

    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [run.id, run.status, projectId]);

  const runArtifacts = artifacts.filter((artifact) => artifact.provenance.workflowRunId === run.id);
  const findings =
    (reviewEvidence?.metadata?.findings as { severity: string; description?: string }[] | undefined) ??
    [];

  return (
    <Card variant="outlined" sx={{ mb: 3 }}>
      <CardContent>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="subtitle1">
            Run <code>{run.id}</code>
          </Typography>
          <StatusChip status={run.status} />
          {!RUN_TERMINAL_STATUSES.has(run.status) && (
            <Typography variant="caption" color="text.secondary">
              (polling…)
            </Typography>
          )}
        </Stack>
        {run.errorMessage && <ErrorAlert message={`Error: ${run.errorMessage}`} />}
        {pollError && <ErrorAlert message={`Failed to refresh run status: ${pollError}`} />}

        <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
          Timeline
        </Typography>
        <List dense disablePadding>
          {tasks.map((task, index) => {
            const execution = agentExecutions.find((summary) => summary.taskId === task.id);
            const invocations = toolInvocations.filter((summary) => summary.taskId === task.id);
            return (
              <ListItem key={task.id} disableGutters sx={{ display: 'block', mb: 1.5 }}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <Typography variant="body2">
                    {index + 1}. {task.nodeId} ({task.type})
                  </Typography>
                  <StatusChip status={task.status} />
                  {task.attempt > 0 && (
                    <Typography variant="caption" color="text.secondary">
                      attempt {task.attempt}
                    </Typography>
                  )}
                </Stack>
                {task.error && <ErrorAlert message={task.error} />}

                {execution && (
                  <Box sx={{ ml: 2, mt: 0.5 }}>
                    <Typography variant="caption" color="text.secondary" component="div">
                      Agent
                    </Typography>
                    <Typography variant="body2">
                      {execution.role}
                      {execution.promptReference && ` (prompt ${execution.promptReference})`} —{' '}
                      {execution.status}
                    </Typography>
                    {execution.contextManifest && (
                      <>
                        <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1 }}>
                          Context manifest
                        </Typography>
                        <Typography variant="body2">
                          {execution.contextManifest.sourceCount} source
                          {execution.contextManifest.sourceCount === 1 ? '' : 's'}:{' '}
                          {execution.contextManifest.sources.map((s) => s.type).join(', ')}
                        </Typography>
                      </>
                    )}
                    {execution.output && (
                      <>
                        <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1 }}>
                          Output
                        </Typography>
                        <Paper variant="outlined" component="pre" sx={PRE_PAPER_SX}>
                          {JSON.stringify(execution.output, null, 2)}
                        </Paper>
                      </>
                    )}
                    {execution.errorMessage && <ErrorAlert message={execution.errorMessage} />}
                  </Box>
                )}

                {invocations.length > 0 && (
                  <Box sx={{ ml: 2, mt: 1 }}>
                    <Typography variant="caption" color="text.secondary" component="div">
                      Tool invocations
                    </Typography>
                    <List dense disablePadding>
                      {invocations.map((invocation) => (
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
              </ListItem>
            );
          })}
          {tasks.length === 0 && (
            <ListItem disableGutters>
              <ListItemText primary="No tasks yet." />
            </ListItem>
          )}
        </List>

        <Accordion disableGutters sx={{ mt: 2 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2">Artifacts ({runArtifacts.length})</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <List dense disablePadding>
              {runArtifacts.map((artifact) => (
                <ListItem key={artifact.id} disableGutters>
                  <ListItemText primary={`${artifact.name} (${artifact.type})`} />
                  <StatusChip status={artifact.status} />
                </ListItem>
              ))}
              {runArtifacts.length === 0 && (
                <ListItem disableGutters>
                  <ListItemText primary="No artifacts yet." />
                </ListItem>
              )}
            </List>
          </AccordionDetails>
        </Accordion>

        {testEvidence && (
          <Accordion disableGutters>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2">Test evidence</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" gutterBottom>
                Passed: {String(testEvidence.metadata?.passed ?? 'unknown')}
              </Typography>
              <Typography variant="caption" color="text.secondary" component="div">
                Build
              </Typography>
              <Paper variant="outlined" component="pre" sx={PRE_PAPER_SX}>
                {JSON.stringify(testEvidence.metadata?.build, null, 2)}
              </Paper>
              <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1 }}>
                Test
              </Typography>
              <Paper variant="outlined" component="pre" sx={PRE_PAPER_SX}>
                {JSON.stringify(testEvidence.metadata?.test, null, 2)}
              </Paper>
            </AccordionDetails>
          </Accordion>
        )}

        {reviewEvidence && (
          <Accordion disableGutters>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2">Review evidence</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" gutterBottom>
                Decision: <strong>{String(reviewEvidence.metadata?.decision ?? 'unknown')}</strong>
              </Typography>
              <List dense disablePadding>
                {findings.map((finding, index) => (
                  <ListItem key={`${finding.severity}-${index}`} disableGutters>
                    <ListItemText primary={`[${finding.severity}] ${finding.description ?? ''}`} />
                  </ListItem>
                ))}
                {findings.length === 0 && (
                  <ListItem disableGutters>
                    <ListItemText primary="No findings." />
                  </ListItem>
                )}
              </List>
            </AccordionDetails>
          </Accordion>
        )}

        {releaseReadiness && (
          <Accordion disableGutters defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2">Release readiness</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" gutterBottom>
                {releaseReadiness.ready ? 'Ready to release.' : 'Not ready to release.'}
              </Typography>
              {!releaseReadiness.ready && (
                <Stack spacing={1}>
                  {releaseReadiness.reasons.map((reason) => (
                    <ErrorAlert key={reason} message={reason} />
                  ))}
                </Stack>
              )}
            </AccordionDetails>
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
}

export function RunsPage() {
  const { selectedProjectId } = useProjectContext();
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowDefinitionSummary[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedWorkItemId, setSelectedWorkItemId] = useState('');
  const [selectedWorkflowId, setSelectedWorkflowId] = useState('');
  const [startError, setStartError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [workItemRuns, setWorkItemRuns] = useState<WorkflowRun[]>([]);
  const [workItemRunsError, setWorkItemRunsError] = useState<string | null>(null);

  useEffect(() => {
    setRuns([]);
    if (!selectedProjectId) {
      setWorkItems([]);
      setWorkflows([]);
      setArtifacts([]);
      return;
    }

    let cancelled = false;

    Promise.all([
      listWorkItems(selectedProjectId),
      listWorkflows(selectedProjectId),
      listArtifacts(selectedProjectId),
    ]).then(([workItemsResult, workflowsResult, artifactsResult]) => {
      if (cancelled) return;

      if (!workItemsResult.ok) {
        setLoadError(workItemsResult.error.message);
        return;
      }
      if (!workflowsResult.ok) {
        setLoadError(workflowsResult.error.message);
        return;
      }

      setLoadError(null);
      setWorkItems(workItemsResult.data);
      setWorkflows(workflowsResult.data);
      setArtifacts(artifactsResult.ok ? artifactsResult.data : []);
      setSelectedWorkItemId(workItemsResult.data[0]?.id ?? '');
      setSelectedWorkflowId(workflowsResult.data[0]?.id ?? '');
    });

    return () => {
      cancelled = true;
    };
  }, [selectedProjectId]);

  function refreshArtifacts() {
    if (!selectedProjectId) return;
    listArtifacts(selectedProjectId).then((result) => {
      if (result.ok) setArtifacts(result.data);
    });
  }

  // DEVOS-080: the complete ordered history of every run this work item's
  // change has gone through (planning, development, release, ...) — not
  // just the runs started this browser session above. Re-fetched whenever
  // the selected work item changes or a run this page started completes,
  // so a run started here shows up in its own work item's timeline too.
  function refreshWorkItemRuns() {
    if (!selectedWorkItemId) {
      setWorkItemRuns([]);
      return;
    }
    listWorkflowRunsForWorkItem(selectedWorkItemId).then((result) => {
      if (result.ok) {
        setWorkItemRunsError(null);
        setWorkItemRuns(result.data);
      } else {
        setWorkItemRunsError(result.error.message);
      }
    });
  }

  useEffect(() => {
    refreshWorkItemRuns();
  }, [selectedWorkItemId]);

  async function handleStartRun(event: FormEvent) {
    event.preventDefault();
    if (!selectedWorkItemId || !selectedWorkflowId) return;

    setStarting(true);
    setStartError(null);

    const result = await startRun(selectedWorkflowId, {
      workItemId: selectedWorkItemId,
      idempotencyKey: `web-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    });
    setStarting(false);

    if (!result.ok) {
      setStartError(result.error.message);
      return;
    }

    setRuns((current) => [result.data, ...current]);
    refreshWorkItemRuns();
  }

  if (!selectedProjectId) {
    return (
      <section>
        <Typography variant="h4" component="h2" gutterBottom>
          Runs
        </Typography>
        <Typography color="text.secondary">Select a project to start and observe workflow runs.</Typography>
      </section>
    );
  }

  return (
    <section>
      <Typography variant="h4" component="h2" gutterBottom>
        Runs
      </Typography>

      {loadError && <ErrorAlert message={`Failed to load run data: ${loadError}`} />}

      <Typography variant="h6" component="h3" gutterBottom>
        Start a run
      </Typography>
      <Stack
        component="form"
        onSubmit={handleStartRun}
        direction="row"
        spacing={2}
        alignItems="flex-start"
        flexWrap="wrap"
        sx={{ mb: 4 }}
      >
        <FormControl size="small" sx={{ minWidth: 240 }} required>
          <InputLabel id="work-item-label">Work item</InputLabel>
          <Select
            labelId="work-item-label"
            label="Work item"
            value={selectedWorkItemId}
            onChange={(event) => setSelectedWorkItemId(event.target.value)}
          >
            {workItems.map((workItem) => (
              <MenuItem key={workItem.id} value={workItem.id}>
                {workItem.title}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 220 }} required>
          <InputLabel id="workflow-label">Workflow</InputLabel>
          <Select
            labelId="workflow-label"
            label="Workflow"
            value={selectedWorkflowId}
            onChange={(event) => setSelectedWorkflowId(event.target.value)}
          >
            {workflows.map((workflow) => (
              <MenuItem key={workflow.id} value={workflow.id}>
                {workflow.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button
          type="submit"
          variant="contained"
          disabled={starting || workItems.length === 0 || workflows.length === 0}
          sx={{ mt: 0.5 }}
        >
          {starting ? 'Starting…' : 'Start run'}
        </Button>
        {startError && <ErrorAlert message={startError} />}
      </Stack>

      <Typography variant="h6" component="h3" gutterBottom>
        Runs started this session
      </Typography>
      <Box sx={{ mb: 4 }}>
        {runs.map((run) => (
          <RunCard
            key={run.id}
            run={run}
            projectId={selectedProjectId}
            artifacts={artifacts}
            onCompleted={refreshArtifacts}
          />
        ))}
        {runs.length === 0 && <Typography color="text.secondary">No runs started yet.</Typography>}
      </Box>

      <Typography variant="h6" component="h3" gutterBottom>
        Work item timeline
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Every run this work item&apos;s change has gone through — planning, development, release,
        and any others — oldest first, not just the runs started above.
      </Typography>
      {workItemRunsError && <ErrorAlert message={`Failed to load the work item's runs: ${workItemRunsError}`} />}
      <Box>
        {workItemRuns.map((run) => (
          <RunCard
            key={run.id}
            run={run}
            projectId={selectedProjectId}
            artifacts={artifacts}
            onCompleted={refreshArtifacts}
          />
        ))}
        {workItemRuns.length === 0 && !workItemRunsError && (
          <Typography color="text.secondary">No runs recorded yet for this work item.</Typography>
        )}
      </Box>
    </section>
  );
}
