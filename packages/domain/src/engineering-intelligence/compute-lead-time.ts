/**
 * DEVOS-168: a real interval, in milliseconds, between a `CODE_CHANGE`
 * artifact's own `generatedAt` and a `RELEASE_EVIDENCE` artifact's own
 * `completedAt` — the two real timestamps this codebase's evidence
 * artifacts already carry (`run-development-agent-task.ts`/
 * `run-release-task.ts`).
 */
export function computeLeadTimeMs(
  codeChangeGeneratedAt: string,
  releaseCompletedAt: string,
): number {
  return Date.parse(releaseCompletedAt) - Date.parse(codeChangeGeneratedAt);
}

export interface LeadTimeSummary {
  sampleCount: number;
  leadTimeMsP50: number;
  leadTimeMsMean: number;
}

/**
 * DEVOS-168: summarises a real distribution of lead-time samples — no
 * fabricated percentile from a single sample; `p50` is the true median of
 * whatever real samples were actually matched (§ "Out of scope": a
 * `CODE_CHANGE` with no matched release contributes no sample at all, it is
 * never treated as `0`).
 */
export function summarizeLeadTimes(samplesMs: number[]): LeadTimeSummary {
  if (samplesMs.length === 0) {
    return { sampleCount: 0, leadTimeMsP50: 0, leadTimeMsMean: 0 };
  }

  const sorted = [...samplesMs].sort((a, b) => a - b);
  const midpoint = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0 ? (sorted[midpoint - 1]! + sorted[midpoint]!) / 2 : sorted[midpoint]!;
  const mean = sorted.reduce((sum, value) => sum + value, 0) / sorted.length;

  return { sampleCount: sorted.length, leadTimeMsP50: median, leadTimeMsMean: mean };
}
