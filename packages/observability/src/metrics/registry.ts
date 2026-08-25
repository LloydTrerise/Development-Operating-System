/**
 * DEVOS-087: a real, in-process metrics registry — counters and simple
 * histograms, queryable by the process that recorded them. No metrics
 * backend (Prometheus, StatsD, etc.) is in scope for this sprint (see
 * `specs/sprints/sprint-07/DEVOS-087.md`); this is the primitive a future
 * exporter would sit on top of, not the exporter itself.
 */
export type MetricLabels = Record<string, string>;

export interface HistogramSummary {
  count: number;
  sum: number;
  min: number;
  max: number;
}

export interface MetricsSnapshot {
  counters: Record<string, number>;
  histograms: Record<string, HistogramSummary>;
}

export interface MetricsRegistry {
  incrementCounter(name: string, labels?: MetricLabels, value?: number): void;
  observeHistogram(name: string, value: number, labels?: MetricLabels): void;
  getCounter(name: string, labels?: MetricLabels): number;
  getHistogram(name: string, labels?: MetricLabels): HistogramSummary | undefined;
  snapshot(): MetricsSnapshot;
}

/**
 * A metric's identity is its name plus its label *values* — two calls with
 * the same name but different label values are different time series, not
 * the same one overwritten. Labels are sorted by key before serializing so
 * that `{a:'1', b:'2'}` and `{b:'2', a:'1'}` key identically.
 */
function metricKey(name: string, labels?: MetricLabels): string {
  if (!labels || Object.keys(labels).length === 0) return name;
  const sortedEntries = Object.entries(labels).sort(([a], [b]) => a.localeCompare(b));
  const labelPart = sortedEntries.map(([key, value]) => `${key}=${value}`).join(',');
  return `${name}{${labelPart}}`;
}

export function createMetricsRegistry(): MetricsRegistry {
  const counters = new Map<string, number>();
  const histograms = new Map<string, HistogramSummary>();

  return {
    incrementCounter(name, labels, value = 1) {
      const key = metricKey(name, labels);
      counters.set(key, (counters.get(key) ?? 0) + value);
    },

    observeHistogram(name, value, labels) {
      const key = metricKey(name, labels);
      const existing = histograms.get(key);
      if (!existing) {
        histograms.set(key, { count: 1, sum: value, min: value, max: value });
        return;
      }
      histograms.set(key, {
        count: existing.count + 1,
        sum: existing.sum + value,
        min: Math.min(existing.min, value),
        max: Math.max(existing.max, value),
      });
    },

    getCounter(name, labels) {
      return counters.get(metricKey(name, labels)) ?? 0;
    },

    getHistogram(name, labels) {
      return histograms.get(metricKey(name, labels));
    },

    snapshot() {
      return {
        counters: Object.fromEntries(counters),
        histograms: Object.fromEntries(histograms),
      };
    },
  };
}
