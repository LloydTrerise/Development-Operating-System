import type { WorkflowRunId } from '@devos/contracts';
import { getWorkflowRunForPrincipal } from './get-workflow-run.js';
import type { AgentExecutionSummaryUseCaseDeps } from './deps.js';

/**
 * DEVOS-036: the read-side counterpart to run-agent-task.ts's write path —
 * per task, which prompt version ran, a summary of its context manifest,
 * its status, and its output/error. Not a literal spec-documented endpoint
 * (specs/api/poc-api-contracts.md §20 documents agent-scoped execution
 * listing, not this run/task-scoped shape the RunsPage UI actually needs);
 * flagged here as the resulting assumption.
 */
export interface AgentExecutionSummary {
  taskId: string;
  executionId: string;
  status: string;
  agentVersionId: string;
  role: string;
  promptReference?: string;
  output?: Record<string, unknown>;
  errorMessage?: string;
  usage?: { promptTokens: number; candidatesTokens: number; totalTokens: number };
  estimatedCostUsd?: number;
  contextManifest?: {
    sourceCount: number;
    sources: { type: string; ref: string }[];
  };
}

export async function getAgentExecutionSummariesForRun(
  deps: AgentExecutionSummaryUseCaseDeps,
  principalId: string,
  runId: WorkflowRunId,
): Promise<AgentExecutionSummary[]> {
  const run = await getWorkflowRunForPrincipal(deps, principalId, runId);
  const tasks = await deps.workflowTasks.listForRun(run.id);

  const summaries: AgentExecutionSummary[] = [];
  for (const task of tasks) {
    const executions = await deps.agentExecutions.listForTask(task.id);
    // listForTask orders by created_at ascending — the most recent attempt
    // (a retry after a prior failure) is the one worth showing.
    const latest = executions[executions.length - 1];
    if (!latest) continue;

    const version = await deps.agentVersions.getById(latest.agentVersionId);
    const manifest = await deps.contextManifests.getForExecution(latest.id);

    summaries.push({
      taskId: task.id,
      executionId: latest.id,
      status: latest.status,
      agentVersionId: latest.agentVersionId,
      role: version?.configuration.role ?? 'UNKNOWN',
      ...(version?.promptReference !== undefined
        ? { promptReference: version.promptReference }
        : {}),
      ...(latest.output !== undefined ? { output: latest.output } : {}),
      ...(latest.errorMessage !== undefined ? { errorMessage: latest.errorMessage } : {}),
      ...(latest.usage !== undefined ? { usage: latest.usage } : {}),
      ...(latest.estimatedCostUsd !== undefined
        ? { estimatedCostUsd: latest.estimatedCostUsd }
        : {}),
      ...(manifest !== null
        ? { contextManifest: { sourceCount: manifest.sources.length, sources: manifest.sources } }
        : {}),
    });
  }

  return summaries;
}
