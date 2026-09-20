import { parseMetricKey, type MetricsSnapshot } from './registry.js';

/**
 * DEVOS-117: the real exporter behind `MetricsRegistry.snapshot()`'s
 * existing seam. No specific backend is named anywhere in the spec corpus
 * — this task's own recorded choice is Prometheus's pull-based scrape
 * model (a real, self-hosted Prometheus, `infrastructure/docker/docker-compose.yml`,
 * scrapes a real `GET /metrics` HTTP endpoint this format feeds, mirroring
 * DEVOS-106's own self-hosted-rather-than-cloud-account precedent for
 * Vault). Prometheus's own expression browser is the real "external
 * dashboard/query tool" this task's acceptance criterion asks for — a
 * separate Grafana service was considered and deliberately left out to
 * keep the additive footprint to the one new real backend this task
 * actually needs, not a second one on top of it.
 *
 * This is hand-written Prometheus text exposition format (not the OpenTelemetry
 * SDK/Collector) — the registry's own data (counters plus min/max/sum/count
 * histogram summaries, not real bucketed histograms) maps directly onto
 * Prometheus's plain text format without needing OTel's heavier
 * instrumentation/export pipeline in between.
 */

const METRIC_NAME_PATTERN = /^[A-Za-z_:][A-Za-z0-9_:]*$/;

function escapeLabelValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

function formatLabels(labels: Record<string, string>): string {
  const entries = Object.entries(labels);
  if (entries.length === 0) return '';
  return `{${entries.map(([k, v]) => `${k}="${escapeLabelValue(v)}"`).join(',')}}`;
}

/**
 * A metric name recorded through the registry is a free-form string (e.g.
 * `task_queue.claimed`) — Prometheus metric names may not contain `.`.
 * Sanitized here, at the export boundary, rather than constraining every
 * `incrementCounter`/`observeHistogram` call site's own naming.
 */
function sanitizeMetricName(name: string): string {
  const sanitized = name.replace(/[^A-Za-z0-9_:]/g, '_');
  return METRIC_NAME_PATTERN.test(sanitized) ? sanitized : `_${sanitized}`;
}

export function formatPrometheusText(snapshot: MetricsSnapshot): string {
  const lines: string[] = [];
  const emittedType = new Set<string>();

  for (const [key, value] of Object.entries(snapshot.counters)) {
    const { name, labels } = parseMetricKey(key);
    const metricName = sanitizeMetricName(name);
    if (!emittedType.has(metricName)) {
      lines.push(`# TYPE ${metricName} counter`);
      emittedType.add(metricName);
    }
    lines.push(`${metricName}${formatLabels(labels)} ${value}`);
  }

  for (const [key, summary] of Object.entries(snapshot.histograms)) {
    const { name, labels } = parseMetricKey(key);
    const metricName = sanitizeMetricName(name);
    // Not a real Prometheus histogram (no bucket boundaries exist anywhere
    // in this registry's own data model) — exported honestly as four
    // separate gauges per series rather than fabricating bucket data that
    // was never recorded.
    for (const suffix of ['count', 'sum', 'min', 'max'] as const) {
      const gaugeName = `${metricName}_${suffix}`;
      if (!emittedType.has(gaugeName)) {
        lines.push(`# TYPE ${gaugeName} gauge`);
        emittedType.add(gaugeName);
      }
      lines.push(`${gaugeName}${formatLabels(labels)} ${summary[suffix]}`);
    }
  }

  return lines.length > 0 ? `${lines.join('\n')}\n` : '';
}
