import { describe, expect, it } from 'vitest';
import { computeDoraReleaseMetrics } from '../src/engineering-intelligence/compute-dora-release-metrics.js';

const PERIOD_START = '2026-09-01T00:00:00.000Z';
const PERIOD_END = '2026-09-11T00:00:00.000Z'; // 10-day window

describe('computeDoraReleaseMetrics', () => {
  it('counts real deploys and change failures within the period, computing a correct rate', () => {
    const result = computeDoraReleaseMetrics(
      [
        { action: 'deploy', passed: true, completedAt: '2026-09-02T00:00:00.000Z' },
        { action: 'deploy', passed: true, completedAt: '2026-09-03T00:00:00.000Z' },
        { action: 'rollback', passed: false, completedAt: '2026-09-04T00:00:00.000Z' },
        { action: 'deploy', passed: false, completedAt: '2026-09-05T00:00:00.000Z' }, // failed deploy, not a rollback
      ],
      PERIOD_START,
      PERIOD_END,
    );

    expect(result.deploymentCount).toBe(3);
    expect(result.deploymentsPerDay).toBeCloseTo(0.3, 6);
    // rollback + the one failed (passed: false) deploy = 2 change failures.
    expect(result.changeFailureCount).toBe(2);
    expect(result.changeFailureRate).toBeCloseTo(2 / 3, 6);
  });

  it('reports zero deployments and a 0 rate, not NaN, when nothing falls inside the period', () => {
    const result = computeDoraReleaseMetrics([], PERIOD_START, PERIOD_END);

    expect(result.deploymentCount).toBe(0);
    expect(result.changeFailureCount).toBe(0);
    expect(result.changeFailureRate).toBe(0);
  });

  it('excludes entries outside the period window', () => {
    const result = computeDoraReleaseMetrics(
      [
        { action: 'deploy', passed: true, completedAt: '2026-08-15T00:00:00.000Z' }, // before
        { action: 'deploy', passed: true, completedAt: '2026-09-20T00:00:00.000Z' }, // after
        { action: 'deploy', passed: true, completedAt: '2026-09-05T00:00:00.000Z' }, // inside
      ],
      PERIOD_START,
      PERIOD_END,
    );

    expect(result.deploymentCount).toBe(1);
  });
});
