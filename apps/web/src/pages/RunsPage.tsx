import { useEffect, useState, type FormEvent } from 'react';
import {
  getRun,
  listAgentExecutionSummaries,
  listArtifacts,
  listRunTasks,
  listWorkItems,
  listWorkflows,
  startRun,
  RUN_TERMINAL_STATUSES,
  type AgentExecutionSummary,
  type Artifact,
  type WorkflowDefinitionSummary,
  type WorkflowRun,
  type WorkflowTask,
  type WorkItem,
} from '../api-client.js';
import { useProjectContext } from '../project-context.js';

const POLL_INTERVAL_MS = 2000;

function RunCard({
  run: initialRun,
  artifacts,
  onCompleted,
}: {
  run: WorkflowRun;
  artifacts: Artifact[];
  onCompleted: () => void;
}) {
  const [run, setRun] = useState(initialRun);
  const [tasks, setTasks] = useState<WorkflowTask[]>([]);
  const [agentExecutions, setAgentExecutions] = useState<AgentExecutionSummary[]>([]);
  const [pollError, setPollError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const wasTerminal = RUN_TERMINAL_STATUSES.has(run.status);

    async function poll() {
      const [runResult, tasksResult, summariesResult] = await Promise.all([
        getRun(run.id),
        listRunTasks(run.id),
        listAgentExecutionSummaries(run.id),
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
      if (!wasTerminal && RUN_TERMINAL_STATUSES.has(runResult.data.status)) onCompleted();
    }

    poll();

    if (wasTerminal) return;

    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [run.id, run.status]);

  const runArtifacts = artifacts.filter((artifact) => artifact.provenance.workflowRunId === run.id);

  return (
    <li>
      <p>
        Run <code>{run.id}</code> — <strong>{run.status}</strong>
        {!RUN_TERMINAL_STATUSES.has(run.status) && ' (polling…)'}
      </p>
      {run.errorMessage && <p role="alert">Error: {run.errorMessage}</p>}
      {pollError && <p role="alert">Failed to refresh run status: {pollError}</p>}

      <h4>Timeline</h4>
      <ol>
        {tasks.map((task) => {
          const execution = agentExecutions.find((summary) => summary.taskId === task.id);
          return (
            <li key={task.id}>
              {task.nodeId} ({task.type}) — {task.status}
              {task.attempt > 0 && ` — attempt ${task.attempt}`}
              {task.error && <span role="alert"> — {task.error}</span>}
              {execution && (
                <dl>
                  <dt>Agent</dt>
                  <dd>
                    {execution.role}
                    {execution.promptReference && ` (prompt ${execution.promptReference})`} —{' '}
                    {execution.status}
                  </dd>
                  {execution.contextManifest && (
                    <>
                      <dt>Context manifest</dt>
                      <dd>
                        {execution.contextManifest.sourceCount} source
                        {execution.contextManifest.sourceCount === 1 ? '' : 's'}:{' '}
                        {execution.contextManifest.sources.map((s) => s.type).join(', ')}
                      </dd>
                    </>
                  )}
                  {execution.output && (
                    <>
                      <dt>Output</dt>
                      <dd>
                        <pre>{JSON.stringify(execution.output, null, 2)}</pre>
                      </dd>
                    </>
                  )}
                  {execution.errorMessage && (
                    <>
                      <dt>Error</dt>
                      <dd role="alert">{execution.errorMessage}</dd>
                    </>
                  )}
                </dl>
              )}
            </li>
          );
        })}
        {tasks.length === 0 && <li>No tasks yet.</li>}
      </ol>

      <h4>Artifacts</h4>
      <ul>
        {runArtifacts.map((artifact) => (
          <li key={artifact.id}>
            {artifact.name} ({artifact.type}) — {artifact.status}
          </li>
        ))}
        {runArtifacts.length === 0 && <li>No artifacts yet.</li>}
      </ul>
    </li>
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
  }

  if (!selectedProjectId) {
    return (
      <section>
        <h2>Runs</h2>
        <p>Select a project to start and observe workflow runs.</p>
      </section>
    );
  }

  return (
    <section>
      <h2>Runs</h2>

      {loadError && <p role="alert">Failed to load run data: {loadError}</p>}

      <h3>Start a run</h3>
      <form onSubmit={handleStartRun}>
        <label>
          Work item
          <select
            value={selectedWorkItemId}
            onChange={(event) => setSelectedWorkItemId(event.target.value)}
            required
          >
            <option value="" disabled>
              Select a work item
            </option>
            {workItems.map((workItem) => (
              <option key={workItem.id} value={workItem.id}>
                {workItem.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Workflow
          <select
            value={selectedWorkflowId}
            onChange={(event) => setSelectedWorkflowId(event.target.value)}
            required
          >
            <option value="" disabled>
              Select a workflow
            </option>
            {workflows.map((workflow) => (
              <option key={workflow.id} value={workflow.id}>
                {workflow.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={starting || workItems.length === 0 || workflows.length === 0}
        >
          {starting ? 'Starting…' : 'Start run'}
        </button>
        {startError && <p role="alert">{startError}</p>}
      </form>

      <h3>Runs started this session</h3>
      <ul>
        {runs.map((run) => (
          <RunCard key={run.id} run={run} artifacts={artifacts} onCompleted={refreshArtifacts} />
        ))}
        {runs.length === 0 && <li>No runs started yet.</li>}
      </ul>
    </section>
  );
}
