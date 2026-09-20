import { describe, expect, it } from 'vitest';
import { computeSlowestWorkflows } from '../src/engineering-intelligence/compute-slowest-workflows.js';

describe('computeSlowestWorkflows', () => {
  it('ranks real workflow-version duration totals descending by mean duration', () => {
    const result = computeSlowestWorkflows([
      { workflowVersionId: 'fast', sumMs: 1000, count: 10 }, // mean 100
      { workflowVersionId: 'slow', sumMs: 9000, count: 10 }, // mean 900
      { workflowVersionId: 'medium', sumMs: 5000, count: 10 }, // mean 500
    ]);

    expect(result.map((row) => row.workflowVersionId)).toEqual(['slow', 'medium', 'fast']);
    expect(result[0]!.meanDurationMs).toBe(900);
    expect(result[0]!.taskCount).toBe(10);
  });

  it('excludes a zero-count entry rather than dividing by zero', () => {
    const result = computeSlowestWorkflows([{ workflowVersionId: 'empty', sumMs: 0, count: 0 }]);
    expect(result).toHaveLength(0);
  });

  it('respects the limit parameter', () => {
    const totals = Array.from({ length: 15 }, (_, i) => ({
      workflowVersionId: `wf-${i}`,
      sumMs: i * 1000,
      count: 1,
    }));
    const result = computeSlowestWorkflows(totals, 5);
    expect(result).toHaveLength(5);
  });

  it('breaks ties deterministically by ascending workflowVersionId', () => {
    const result = computeSlowestWorkflows([
      { workflowVersionId: 'b', sumMs: 1000, count: 1 },
      { workflowVersionId: 'a', sumMs: 1000, count: 1 },
    ]);
    expect(result.map((row) => row.workflowVersionId)).toEqual(['a', 'b']);
  });
});
