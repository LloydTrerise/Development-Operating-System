# DEVOS-087 — Implement metrics

**Priority:** P0 | **Estimate:** 1d
**Depends on:** Sprint 6 complete.

## Scope

"Workflow, agent, tool and queue metrics" (source, verbatim). `packages/observability` (`specs/architecture/repository-code-structure.md` §24: logging/metrics/tracing/correlation subdirs) has been an empty bootstrap scaffold since Sprint 1. This task activates it for the first time: a real, in-process metrics registry (counters/histograms — no external backend, per the sprint's out-of-scope list) with instrumentation added at workflow-run start/complete, agent execution start/complete, tool invocation (per capability, per status), and task-queue claim/reclaim/retry.

## Grounding

`specs/architecture/repository-code-structure.md` §24. `specs/constitution/devos-engineering-constitution.md` Principle 14 ("Observability").

## Flagged gap

No metrics-backend choice (Prometheus, StatsD, etc.) is specified; a real in-process registry exposed via a query/export function is sufficient to meet this task's own acceptance criterion without adding an external dependency, consistent with the sprint's "avoid over-engineering" risk and its explicit exclusion of a real metrics backend.

## Acceptance

Real metrics are recorded when a real workflow run, real agent execution, real tool invocation, and real queue claim/reclaim each occur (verified via the metrics registry's own query interface after exercising the real code path — real Postgres, not mocks). Values increment correctly across repeated real executions.
