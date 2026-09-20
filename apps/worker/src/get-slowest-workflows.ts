import {
  computeSlowestWorkflows,
  type SlowestWorkflowRow,
  type WorkflowDefinitionRepository,
  type WorkflowVersionRepository,
} from '@devos/domain';
import { parseMetricKey, type MetricsRegistry } from '@devos/observability';

export interface SlowestWorkflowReportRow extends SlowestWorkflowRow {
  workflowDefinitionName: string;
}

export interface GetSlowestWorkflowsDeps {
  workflowVersions: WorkflowVersionRepository;
  workflowDefinitions: WorkflowDefinitionRepository;
}

/**
 * DEVOS-170: reads the worker's own live `MetricsRegistry` (the one real
 * source of this data — `apps/api` runs in a separate process and has no
 * access to it; wiring a live cross-process bridge into the web dashboard
 * is explicitly out of this sprint's own bounded scope, disclosed rather
 * than forced — see `specs/sprints/sprint-21/DEVOS-170.md`), groups the
 * `workflow_task.duration_ms` histogram's real per-`(taskType,
 * workflowVersionId)` summaries by `workflowVersionId` alone (summing
 * across every real task type that ran within it), ranks by real mean
 * duration via `computeSlowestWorkflows`, and resolves each id to its
 * owning `WorkflowDefinition.name` for a human-readable result.
 */
export async function getSlowestWorkflows(
  deps: GetSlowestWorkflowsDeps,
  metrics: MetricsRegistry,
  limit = 10,
): Promise<SlowestWorkflowReportRow[]> {
  const snapshot = metrics.snapshot();
  const totalsByWorkflowVersionId = new Map<string, { sumMs: number; count: number }>();

  for (const [key, summary] of Object.entries(snapshot.histograms)) {
    const { name, labels } = parseMetricKey(key);
    if (name !== 'workflow_task.duration_ms') continue;
    const workflowVersionId = labels.workflowVersionId;
    if (!workflowVersionId) continue;

    const existing = totalsByWorkflowVersionId.get(workflowVersionId) ?? { sumMs: 0, count: 0 };
    totalsByWorkflowVersionId.set(workflowVersionId, {
      sumMs: existing.sumMs + summary.sum,
      count: existing.count + summary.count,
    });
  }

  const totals = Array.from(totalsByWorkflowVersionId.entries()).map(
    ([workflowVersionId, { sumMs, count }]) => ({ workflowVersionId, sumMs, count }),
  );
  const ranked = computeSlowestWorkflows(totals, limit);

  const rows = await Promise.all(
    ranked.map(async (row): Promise<SlowestWorkflowReportRow> => {
      const version = await deps.workflowVersions.getById(
        row.workflowVersionId as Parameters<WorkflowVersionRepository['getById']>[0],
      );
      const definition = version
        ? await deps.workflowDefinitions.getById(version.workflowDefinitionId)
        : null;
      return {
        ...row,
        workflowDefinitionName:
          definition?.name ?? `(unknown workflow version ${row.workflowVersionId})`,
      };
    }),
  );

  return rows;
}
