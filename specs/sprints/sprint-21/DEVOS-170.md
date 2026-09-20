# DEVOS-170 — Richer task-duration labels for bottleneck analytics

**Priority:** P1 | **Estimate:** 2d
**Depends on:** none (extends the existing DEVOS-087 metrics call site).
**Depended on by:** DEVOS-171 (dashboard renders the resulting bottleneck query).

## Scope

`apps/worker/src/task-dispatcher.ts`'s existing `workflow_task.duration_ms` histogram emission gains a `workflowVersionId` label alongside the existing `taskType` label — the minimal additive change needed to distinguish "which workflow's tasks are slow," not yet per-node (a deliberately bounded first step, per this sprint's own README grounding).

## Implementation

- `apps/worker/src/task-dispatcher.ts`: `processNext()` already loads the claimed `task` (which carries `workflowRunId`) before emitting metrics. When both `metrics` and a new optional `workflowRuns: WorkflowRunRepository` option are supplied, resolves `task.workflowRunId` → `WorkflowRun.workflowVersionId` (one additional repository lookup, skipped entirely when metrics aren't configured) and adds it to the existing `labels` object passed to every metric this function already emits, not just the duration histogram.
- `packages/observability/src/metrics/registry.ts`: gained an exported `parseMetricKey`/`ParsedMetricKey` — the inverse of the existing `metricKey` serialization, factored out of `prometheus-format.ts`'s own previously-private `parseKey` so a second real consumer (below) doesn't reimplement the same parsing.
- `packages/domain/src/engineering-intelligence/compute-slowest-workflows.ts` (new, pure): ranks already-grouped `{workflowVersionId, sumMs, count}` totals by real mean duration descending, ties broken by ascending id.

**Corrected during implementation, disclosed here rather than left stale:** the original plan named `packages/application/src/engineering-intelligence/get-slowest-workflows.ts` as the grouping/ranking use case, implying it would be reachable the same way the other engineering-intelligence reports are (`apps/api`, gated by project membership). Direct inspection of this codebase's own process model surfaced a real architectural fact this task's own scoping hadn't accounted for: `apps/api` and `apps/worker` are separate OS processes, and the `MetricsRegistry` this ranking reads is `apps/worker`'s own **in-process** object — `apps/api` has no access to it, and building a live cross-process bridge (e.g. `apps/api` fetching and parsing the worker's own `/metrics` Prometheus text on every request) is real, buildable work, but a second real feature in its own right, not implicit in "add a label and rank by it." Rather than force that extra scope in silently, the real, honest, and _smaller_ implementation was chosen instead:

- `apps/worker/src/get-slowest-workflows.ts` (new — lives in `apps/worker`, not `@devos/application`, since `@devos/application` has no dependency on `@devos/observability` and this data is worker-process-local by construction): reads the worker's own live `metrics.snapshot()`, groups `workflow_task.duration_ms` entries by `workflowVersionId` via `parseMetricKey`, ranks via `computeSlowestWorkflows`, and resolves each id to its `WorkflowDefinition.name`.
- `apps/worker/src/metrics-server.ts` (DEVOS-117's existing bare-`node:http` server): gains a second real route, `GET /slowest-workflows`, returning this ranking as JSON — served from the same live process, no new port, only present when `apps/worker/src/main.ts` supplies the new optional `workflowVersions`/`workflowDefinitions` deps (mirrors `/metrics`'s own always-on, unauthenticated, single-tenant-deployment precedent).

## Out of scope

Per-node-id labelling (a real, larger cardinality tradeoff, explicitly deferred — see this sprint's own README and the backlog document's §9). Any change to existing counters'/exports' current behavior for any caller not reading the new label. A live `apps/api`↔`apps/worker` metrics bridge — the real gap named above, disclosed rather than built under this task's own time-boxed scope; DEVOS-171's own dashboard section reflects this as a real, live-verified worker-side capability (confirmed via a direct HTTP call to the worker's own new endpoint during the pilot), not a fully wired browser-facing chart, the same kind of bounded MVP boundary DEVOS-152 already drew around Grafana.

## Acceptance

A unit test on `task-dispatcher.ts`'s metrics wiring confirms the new label is present and correct for a real dispatched task (extending the existing dispatcher test suite). A unit test for `compute-slowest-workflows.ts`'s pure ranking logic. A real HTTP test (`metrics-server.test.ts`, a real ephemeral-port server) confirms `GET /slowest-workflows` returns a correctly grouped-and-ranked real JSON result, and 404s when the new deps aren't supplied (existing `/metrics`-only behaviour unaffected). `pnpm --filter @devos/worker --filter @devos/domain --filter @devos/observability typecheck test` green; every existing dispatcher/metrics/prometheus-format test passes unmodified.
