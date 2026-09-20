import { createServer, type Server } from 'node:http';
import { formatPrometheusText, type MetricsRegistry } from '@devos/observability';
import { getSlowestWorkflows, type GetSlowestWorkflowsDeps } from './get-slowest-workflows.js';

/**
 * DEVOS-117: the real, external side of `MetricsRegistry.snapshot()`'s
 * existing seam — a real HTTP endpoint a real, self-hosted Prometheus
 * (`infrastructure/docker/docker-compose.yml`) actually scrapes on its own
 * configured interval, replacing "only visible in this process's own log
 * output" with "visible in a real external query tool." Deliberately a
 * bare `node:http` server, not a new web-framework dependency — one route,
 * no routing/middleware needs a framework to serve.
 *
 * DEVOS-170: gains a second route, `GET /slowest-workflows`, for the same
 * reason — the worker's own live `MetricsRegistry` is the only place this
 * ranking's real data exists (`apps/api` runs in a separate process with
 * no access to it; a live cross-process bridge into the web dashboard is
 * explicitly deferred, disclosed in `specs/sprints/sprint-21/DEVOS-170.md`
 * rather than forced under this sprint's own scope).
 */
export function startMetricsServer(
  metrics: MetricsRegistry,
  port: number,
  slowestWorkflowsDeps?: GetSlowestWorkflowsDeps,
): Server {
  const server = createServer((req, res) => {
    if (req.method !== 'GET') {
      res.writeHead(404).end();
      return;
    }

    if (req.url === '/metrics') {
      const body = formatPrometheusText(metrics.snapshot());
      res.writeHead(200, { 'content-type': 'text/plain; version=0.0.4; charset=utf-8' });
      res.end(body);
      return;
    }

    if (req.url === '/slowest-workflows' && slowestWorkflowsDeps) {
      getSlowestWorkflows(slowestWorkflowsDeps, metrics)
        .then((rows) => {
          res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify(rows));
        })
        .catch(() => {
          res.writeHead(500).end();
        });
      return;
    }

    res.writeHead(404).end();
  });
  server.listen(port);
  return server;
}
