import { createServer, type Server } from 'node:http';
import { formatPrometheusText, type MetricsRegistry } from '@devos/observability';

/**
 * DEVOS-117: the real, external side of `MetricsRegistry.snapshot()`'s
 * existing seam — a real HTTP endpoint a real, self-hosted Prometheus
 * (`infrastructure/docker/docker-compose.yml`) actually scrapes on its own
 * configured interval, replacing "only visible in this process's own log
 * output" with "visible in a real external query tool." Deliberately a
 * bare `node:http` server, not a new web-framework dependency — one route,
 * no routing/middleware needs a framework to serve.
 */
export function startMetricsServer(metrics: MetricsRegistry, port: number): Server {
  const server = createServer((req, res) => {
    if (req.method !== 'GET' || req.url !== '/metrics') {
      res.writeHead(404).end();
      return;
    }
    const body = formatPrometheusText(metrics.snapshot());
    res.writeHead(200, { 'content-type': 'text/plain; version=0.0.4; charset=utf-8' });
    res.end(body);
  });
  server.listen(port);
  return server;
}
