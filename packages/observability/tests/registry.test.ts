import { describe, expect, it } from 'vitest';
import { createMetricsRegistry } from '../src/metrics/registry.js';

describe('metrics registry', () => {
  it('increments a counter with no labels', () => {
    const registry = createMetricsRegistry();

    registry.incrementCounter('workflow_run.completed');
    registry.incrementCounter('workflow_run.completed');

    expect(registry.getCounter('workflow_run.completed')).toBe(2);
  });

  it('tracks counters with the same name but different label values as separate series', () => {
    const registry = createMetricsRegistry();

    registry.incrementCounter('tool_invocation.total', { status: 'SUCCEEDED' });
    registry.incrementCounter('tool_invocation.total', { status: 'SUCCEEDED' });
    registry.incrementCounter('tool_invocation.total', { status: 'FAILED' });

    expect(registry.getCounter('tool_invocation.total', { status: 'SUCCEEDED' })).toBe(2);
    expect(registry.getCounter('tool_invocation.total', { status: 'FAILED' })).toBe(1);
  });

  it('is insensitive to label key insertion order', () => {
    const registry = createMetricsRegistry();

    registry.incrementCounter('task_queue.claimed', { taskType: 'AGENT_TASK', attempt: '1' });
    registry.incrementCounter('task_queue.claimed', { attempt: '1', taskType: 'AGENT_TASK' });

    expect(
      registry.getCounter('task_queue.claimed', { taskType: 'AGENT_TASK', attempt: '1' }),
    ).toBe(2);
  });

  it('increments by an explicit value when given one', () => {
    const registry = createMetricsRegistry();

    registry.incrementCounter('task_queue.reclaimed_stale', undefined, 3);

    expect(registry.getCounter('task_queue.reclaimed_stale')).toBe(3);
  });

  it('returns 0 for a counter that was never incremented', () => {
    const registry = createMetricsRegistry();

    expect(registry.getCounter('never.incremented')).toBe(0);
  });

  it('records histogram observations with count/sum/min/max', () => {
    const registry = createMetricsRegistry();

    registry.observeHistogram('workflow_task.duration_ms', 100, { taskType: 'TOOL_TASK' });
    registry.observeHistogram('workflow_task.duration_ms', 300, { taskType: 'TOOL_TASK' });
    registry.observeHistogram('workflow_task.duration_ms', 50, { taskType: 'TOOL_TASK' });

    expect(registry.getHistogram('workflow_task.duration_ms', { taskType: 'TOOL_TASK' })).toEqual({
      count: 3,
      sum: 450,
      min: 50,
      max: 300,
    });
  });

  it('returns undefined for a histogram that was never observed', () => {
    const registry = createMetricsRegistry();

    expect(registry.getHistogram('never.observed')).toBeUndefined();
  });

  it('snapshot() returns every recorded counter and histogram, keyed by name+labels', () => {
    const registry = createMetricsRegistry();

    registry.incrementCounter('workflow_run.completed');
    registry.incrementCounter('tool_invocation.total', { status: 'SUCCEEDED' });
    registry.observeHistogram('workflow_task.duration_ms', 10, { taskType: 'AGENT_TASK' });

    const snapshot = registry.snapshot();

    expect(snapshot.counters).toEqual({
      'workflow_run.completed': 1,
      'tool_invocation.total{status=SUCCEEDED}': 1,
    });
    expect(snapshot.histograms).toEqual({
      'workflow_task.duration_ms{taskType=AGENT_TASK}': { count: 1, sum: 10, min: 10, max: 10 },
    });
  });

  it('two independent registries never share state', () => {
    const first = createMetricsRegistry();
    const second = createMetricsRegistry();

    first.incrementCounter('workflow_run.completed');

    expect(second.getCounter('workflow_run.completed')).toBe(0);
  });
});
