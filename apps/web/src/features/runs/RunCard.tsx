import { useEffect, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Card,
  CardContent,
  Grid,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Link as RouterLink } from 'react-router-dom';
import {
  getArtifactVersion,
  getReleaseReadiness,
  getRun,
  listAgentExecutionSummaries,
  listApprovalsForRun,
  listArtifacts,
  listRunTasks,
  listToolInvocationSummaries,
  RUN_TERMINAL_STATUSES,
  type AgentExecutionSummary,
  type Approval,
  type Artifact,
  type ArtifactVersion,
  type ReleaseReadiness,
  type ToolInvocationSummary,
  type WorkflowRun,
  type WorkflowTask,
} from '../../api-client.js';
import { ErrorAlert } from '../../components/ErrorAlert.js';
import { StatusChip } from '../../components/StatusChip.js';
import { RunPipelineHeader } from './RunPipelineHeader.js';
import { RunTaskDetail } from './RunTaskDetail.js';
import { RunTaskList } from './RunTaskList.js';

const POLL_INTERVAL_MS = 2000;

const PRE_PAPER_SX = {
  p: 1,
  fontFamily: 'monospace',
  fontSize: 12,
  overflow: 'auto',
  m: 0,
} as const;

/**
 * DEVOS-214: restyled run display — a real pipeline header (RunPipelineHeader)
 * plus a master/detail task view (RunTaskList/RunTaskDetail) replacing the
 * previous flat stacked task list, above the pre-existing Artifacts/Test
 * evidence/Review evidence/Release readiness accordions (unchanged).
 * DEVOS-215: also fetches and surfaces this run's own approval(s), linking
 * to the Approvals page's new `?approvalId=` highlight — see
 * specs/sprints/sprint-31/DEVOS-215.md.
 */
export function RunCard({
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
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [pollError, setPollError] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const wasTerminal = RUN_TERMINAL_STATUSES.has(run.status);

    async function poll() {
      const [
        runResult,
        tasksResult,
        summariesResult,
        toolInvocationsResult,
        artifactsResult,
        approvalsResult,
      ] = await Promise.all([
        getRun(run.id),
        listRunTasks(run.id),
        listAgentExecutionSummaries(run.id),
        listToolInvocationSummaries(run.id),
        listArtifacts(projectId),
        listApprovalsForRun(run.id),
      ]);
      if (cancelled) return;

      if (!runResult.ok) {
        setPollError(runResult.error.message);
        return;
      }
      setPollError(null);
      setRun(runResult.data);
      if (tasksResult.ok) {
        setTasks(tasksResult.data);
        setSelectedTaskId((current) => current ?? tasksResult.data[0]?.id ?? null);
      }
      if (summariesResult.ok) setAgentExecutions(summariesResult.data);
      if (toolInvocationsResult.ok) setToolInvocations(toolInvocationsResult.data);
      if (approvalsResult.ok) setApprovals(approvalsResult.data);

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
    (reviewEvidence?.metadata?.findings as
      { severity: string; description?: string }[] | undefined) ?? [];
  const selectedTask = tasks.find((task) => task.id === selectedTaskId);
  const selectedAgentExecution = agentExecutions.find(
    (summary) => summary.taskId === selectedTaskId,
  );
  const selectedToolInvocations = toolInvocations.filter(
    (summary) => summary.taskId === selectedTaskId,
  );

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

        {approvals.length > 0 && (
          <Stack spacing={0.5} sx={{ mb: 2 }}>
            {approvals.map((approval) => (
              <Stack
                key={approval.id}
                direction="row"
                spacing={1}
                alignItems="center"
                flexWrap="wrap"
              >
                <Typography variant="body2">
                  Approval — {approval.approvalType}, requested by {approval.requestedBy}
                </Typography>
                <StatusChip status={approval.status} />
                <RouterLink to={`/approvals?approvalId=${approval.id}`}>
                  View approval
                </RouterLink>
              </Stack>
            ))}
          </Stack>
        )}

        <Typography variant="subtitle2" sx={{ mt: 1, mb: 1 }}>
          Pipeline
        </Typography>
        <RunPipelineHeader tasks={tasks} />

        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid size={{ xs: 12, md: 5 }}>
            <Paper variant="outlined" sx={{ height: '100%' }}>
              <RunTaskList
                tasks={tasks}
                selectedTaskId={selectedTaskId}
                onSelect={setSelectedTaskId}
              />
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, md: 7 }}>
            <Paper variant="outlined" sx={{ height: '100%' }}>
              <RunTaskDetail
                task={selectedTask}
                agentExecution={selectedAgentExecution}
                toolInvocations={selectedToolInvocations}
              />
            </Paper>
          </Grid>
        </Grid>

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
