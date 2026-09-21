import type { AgentVersionQuality } from './compute-agent-version-quality.js';

export type ReliabilitySignal = 'MET' | 'UNMET' | 'INSUFFICIENT_SAMPLE';

/**
 * DEVOS-198: a pure, three-way read of an already-computed
 * `AgentVersionQuality[]` (`computeAgentVersionQuality`) against a
 * caller-supplied threshold — no matching row, or fewer reviews than
 * `minSampleSize`, is `'INSUFFICIENT_SAMPLE'` even at a 100% pass rate, so a
 * brand-new agent version can never qualify by accident.
 */
export function resolveReliabilitySignal(
  qualities: AgentVersionQuality[],
  agentVersionId: string,
  minPassRate: number,
  minSampleSize: number,
): ReliabilitySignal {
  const quality = qualities.find((row) => row.agentVersionId === agentVersionId);
  if (!quality || quality.reviewCount < minSampleSize) return 'INSUFFICIENT_SAMPLE';
  return quality.passRate >= minPassRate ? 'MET' : 'UNMET';
}
