export interface ReleaseEvidenceEntry {
  action: string;
  passed: boolean;
  completedAt: string;
}

export interface DoraReleaseMetrics {
  deploymentCount: number;
  deploymentsPerDay: number;
  changeFailureCount: number;
  changeFailureRate: number;
}

/**
 * DEVOS-167: a pure computation over real `RELEASE_EVIDENCE` rows — no I/O,
 * mirroring `computeExecutionPaths`/`diffWorkflowVersions`'s own
 * pure-function-in-`@devos/domain` pattern. `deploymentCount` counts real
 * `action: 'deploy'` entries; `changeFailureCount` counts entries that
 * either rolled back or failed their own health check
 * (`action === 'rollback' || passed === false`) — the real change-failure
 * signal this codebase's `RELEASE_EVIDENCE` artifacts actually carry.
 */
export function computeDoraReleaseMetrics(
  releaseEvidence: ReleaseEvidenceEntry[],
  periodStart: string,
  periodEnd: string,
): DoraReleaseMetrics {
  const startMs = Date.parse(periodStart);
  const endMs = Date.parse(periodEnd);

  const withinPeriod = releaseEvidence.filter((entry) => {
    const completedAtMs = Date.parse(entry.completedAt);
    return completedAtMs >= startMs && completedAtMs <= endMs;
  });

  const deploymentCount = withinPeriod.filter((entry) => entry.action === 'deploy').length;
  const changeFailureCount = withinPeriod.filter(
    (entry) => entry.action === 'rollback' || entry.passed === false,
  ).length;

  const periodDays = Math.max((endMs - startMs) / (1000 * 60 * 60 * 24), 1);

  return {
    deploymentCount,
    deploymentsPerDay: deploymentCount / periodDays,
    changeFailureCount,
    changeFailureRate: deploymentCount === 0 ? 0 : changeFailureCount / deploymentCount,
  };
}
