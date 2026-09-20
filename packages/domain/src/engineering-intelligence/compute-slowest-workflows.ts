export interface WorkflowDurationTotals {
  workflowVersionId: string;
  sumMs: number;
  count: number;
}

export interface SlowestWorkflowRow {
  workflowVersionId: string;
  meanDurationMs: number;
  taskCount: number;
}

/**
 * DEVOS-170: a pure ranking over already-grouped real duration totals — no
 * I/O, no fabricated percentiles (the underlying registry, DEVOS-087, only
 * ever records `count`/`sum`/`min`/`max`, so "mean" is the only real
 * central-tendency figure this data honestly supports). Ranked descending
 * by mean duration; ties broken by ascending `workflowVersionId` for a
 * disclosed, deterministic order.
 */
export function computeSlowestWorkflows(
  totals: WorkflowDurationTotals[],
  limit = 10,
): SlowestWorkflowRow[] {
  return totals
    .filter((entry) => entry.count > 0)
    .map((entry) => ({
      workflowVersionId: entry.workflowVersionId,
      meanDurationMs: entry.sumMs / entry.count,
      taskCount: entry.count,
    }))
    .sort(
      (a, b) =>
        b.meanDurationMs - a.meanDurationMs ||
        a.workflowVersionId.localeCompare(b.workflowVersionId),
    )
    .slice(0, limit);
}
