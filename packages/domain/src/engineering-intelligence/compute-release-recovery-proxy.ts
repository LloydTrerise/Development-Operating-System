export interface RecoveryProxyReleaseEntry {
  action: string;
  passed: boolean;
  completedAt: string;
}

export interface RecoveryProxySummary {
  sampleCount: number;
  meanMs: number;
  /** DEVOS-169: a fixed, disclosed label the UI surfaces verbatim — never presented as an unqualified "MTTR". */
  label: string;
}

/**
 * DEVOS-169: a real, disclosed proxy for "time to restore service" — the
 * interval between a failed/rolled-back release and the next real
 * `passed: true` deploy for the same project. Not a true MTTR: no
 * timestamp anywhere in this codebase distinguishes "incident detected"
 * from "release marked failed" (confirmed by inspection before this was
 * written, `specs/DEVOS-ENGINEERING-INTELLIGENCE-BACKLOG.md` §2). A
 * trailing failure with no later successful deploy contributes no sample —
 * never fabricated as `0` or "still open."
 */
export function computeReleaseRecoveryProxyMs(
  releaseEvidence: RecoveryProxyReleaseEntry[],
): RecoveryProxySummary {
  const chronological = [...releaseEvidence].sort(
    (a, b) => Date.parse(a.completedAt) - Date.parse(b.completedAt),
  );

  const samplesMs: number[] = [];
  for (let i = 0; i < chronological.length; i += 1) {
    const entry = chronological[i]!;
    const isFailure = entry.action === 'rollback' || entry.passed === false;
    if (!isFailure) continue;

    const recovery = chronological
      .slice(i + 1)
      .find((candidate) => candidate.action === 'deploy' && candidate.passed === true);
    if (recovery) {
      samplesMs.push(Date.parse(recovery.completedAt) - Date.parse(entry.completedAt));
    }
  }

  const meanMs =
    samplesMs.length === 0
      ? 0
      : samplesMs.reduce((sum, value) => sum + value, 0) / samplesMs.length;

  return {
    sampleCount: samplesMs.length,
    meanMs,
    label: 'release-failure-to-next-successful-deploy',
  };
}
