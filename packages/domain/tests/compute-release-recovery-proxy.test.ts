import { describe, expect, it } from 'vitest';
import { computeReleaseRecoveryProxyMs } from '../src/engineering-intelligence/compute-release-recovery-proxy.js';

describe('computeReleaseRecoveryProxyMs', () => {
  it('pairs a real failure with the next real successful deploy, chronologically', () => {
    const result = computeReleaseRecoveryProxyMs([
      { action: 'deploy', passed: true, completedAt: '2026-09-01T00:00:00.000Z' },
      { action: 'deploy', passed: false, completedAt: '2026-09-02T00:00:00.000Z' },
      { action: 'rollback', passed: false, completedAt: '2026-09-02T00:05:00.000Z' },
      { action: 'deploy', passed: true, completedAt: '2026-09-02T01:00:00.000Z' },
    ]);

    // Two failures (the failed deploy and its rollback), each recovers at
    // the same next successful deploy (02:00 -> 03:00 window = 1h and 55m).
    expect(result.sampleCount).toBe(2);
    expect(result.meanMs).toBeGreaterThan(0);
    expect(result.label).toBe('release-failure-to-next-successful-deploy');
  });

  it('excludes a trailing failure with no later successful deploy, rather than fabricating a value', () => {
    const result = computeReleaseRecoveryProxyMs([
      { action: 'deploy', passed: true, completedAt: '2026-09-01T00:00:00.000Z' },
      { action: 'rollback', passed: false, completedAt: '2026-09-02T00:00:00.000Z' },
    ]);

    expect(result.sampleCount).toBe(0);
    expect(result.meanMs).toBe(0);
  });

  it('reports zero samples for an empty release history', () => {
    const result = computeReleaseRecoveryProxyMs([]);
    expect(result.sampleCount).toBe(0);
    expect(result.meanMs).toBe(0);
  });
});
