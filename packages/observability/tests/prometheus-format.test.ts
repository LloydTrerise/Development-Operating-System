import { describe, expect, it } from 'vitest';
import { createMetricsRegistry } from '../src/metrics/registry.js';
import { formatPrometheusText } from '../src/metrics/prometheus-format.js';

describe('formatPrometheusText (DEVOS-117)', () => {
  it('formats an unlabeled counter as a Prometheus counter series', () => {
    const registry = createMetricsRegistry();
    registry.incrementCounter('workflow_run_completed', undefined, 3);

    const text = formatPrometheusText(registry.snapshot());

    expect(text).toContain('# TYPE workflow_run_completed counter');
    expect(text).toContain('workflow_run_completed 3');
  });

  it('sanitizes a metric name containing "." into a valid Prometheus identifier', () => {
    const registry = createMetricsRegistry();
    registry.incrementCounter('task_queue.claimed', { taskType: 'AGENT_TASK' });

    const text = formatPrometheusText(registry.snapshot());

    expect(text).toContain('# TYPE task_queue_claimed counter');
    expect(text).toContain('task_queue_claimed{taskType="AGENT_TASK"} 1');
  });

  it('re-serializes labels in real Prometheus label syntax, quoted', () => {
    const registry = createMetricsRegistry();
    registry.incrementCounter('tool_invocation_total', { status: 'SUCCEEDED' });
    registry.incrementCounter('tool_invocation_total', { status: 'FAILED' });

    const text = formatPrometheusText(registry.snapshot());

    expect(text).toContain('tool_invocation_total{status="SUCCEEDED"} 1');
    expect(text).toContain('tool_invocation_total{status="FAILED"} 1');
  });

  it('exports a histogram as four separate gauges (count/sum/min/max) — no fabricated bucket data', () => {
    const registry = createMetricsRegistry();
    registry.observeHistogram('workflow_task_duration_ms', 100, { taskType: 'TOOL_TASK' });
    registry.observeHistogram('workflow_task_duration_ms', 300, { taskType: 'TOOL_TASK' });

    const text = formatPrometheusText(registry.snapshot());

    expect(text).toContain('# TYPE workflow_task_duration_ms_count gauge');
    expect(text).toContain('workflow_task_duration_ms_count{taskType="TOOL_TASK"} 2');
    expect(text).toContain('workflow_task_duration_ms_sum{taskType="TOOL_TASK"} 400');
    expect(text).toContain('workflow_task_duration_ms_min{taskType="TOOL_TASK"} 100');
    expect(text).toContain('workflow_task_duration_ms_max{taskType="TOOL_TASK"} 300');
  });

  it('escapes a quote or backslash in a label value so the output stays parseable', () => {
    const registry = createMetricsRegistry();
    registry.incrementCounter('example', { message: 'a "quote" and a \\backslash' });

    const text = formatPrometheusText(registry.snapshot());

    expect(text).toContain('message="a \\"quote\\" and a \\\\backslash"');
  });

  it('returns an empty string for an empty snapshot', () => {
    const registry = createMetricsRegistry();

    expect(formatPrometheusText(registry.snapshot())).toBe('');
  });
});
