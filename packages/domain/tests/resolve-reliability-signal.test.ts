import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { resolveReliabilitySignal } from '../src/agents/resolve-reliability-signal.js';
import type { AgentVersionQuality } from '../src/agents/compute-agent-version-quality.js';

describe('resolveReliabilitySignal', () => {
  it('returns MET when the pass rate meets the threshold with enough samples', () => {
    const agentVersionId = randomUUID();
    const qualities: AgentVersionQuality[] = [
      { agentVersionId, reviewCount: 5, passCount: 5, passRate: 1 },
    ];

    expect(resolveReliabilitySignal(qualities, agentVersionId, 0.8, 3)).toBe('MET');
  });

  it('returns UNMET when real data exists but the pass rate is below the minimum', () => {
    const agentVersionId = randomUUID();
    const qualities: AgentVersionQuality[] = [
      { agentVersionId, reviewCount: 5, passCount: 2, passRate: 0.4 },
    ];

    expect(resolveReliabilitySignal(qualities, agentVersionId, 0.8, 3)).toBe('UNMET');
  });

  it('returns INSUFFICIENT_SAMPLE when reviewCount is below minSampleSize even at a 100% pass rate', () => {
    const agentVersionId = randomUUID();
    const qualities: AgentVersionQuality[] = [
      { agentVersionId, reviewCount: 2, passCount: 2, passRate: 1 },
    ];

    expect(resolveReliabilitySignal(qualities, agentVersionId, 0.8, 3)).toBe('INSUFFICIENT_SAMPLE');
  });

  it('returns INSUFFICIENT_SAMPLE when no quality row exists for the given agentVersionId', () => {
    const qualities: AgentVersionQuality[] = [
      { agentVersionId: randomUUID(), reviewCount: 10, passCount: 10, passRate: 1 },
    ];

    expect(resolveReliabilitySignal(qualities, randomUUID(), 0.8, 3)).toBe('INSUFFICIENT_SAMPLE');
  });
});
