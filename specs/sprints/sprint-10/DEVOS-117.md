# DEVOS-117 — Export metrics/tracing to a real external backend

**Priority:** P1 | **Estimate:** 2d
**Depends on:** None (Sprint 8 complete).

## Scope

The real metrics registry (`packages/observability/src/metrics/registry.ts`, DEVOS-087) and correlation-id tracing (DEVOS-088) exist only in-process, exposed today only via periodic snapshot logging (DEVOS-093/100). Add a real exporter — OpenTelemetry to a real backend (Prometheus/Grafana, or a managed equivalent) — behind the registry's existing `snapshot()` seam.

## Grounding

`DEVOS-PRODUCTION-READINESS-ROADMAP.md` B1, Sprint 7 item 9 (`DEVOS-BUILD-STATE.md` verification-debt #9).

## Flagged gap

No specific backend is named anywhere in the spec corpus — choose one and record the choice, same discipline as every other "no spec-mandated design" decision. Confirm the exporter is additive (the existing periodic log-line snapshot can stay or be removed at this task's discretion, but nothing that currently reads `metrics.snapshot()` directly should break).

## Acceptance

A real workflow run's metrics are visible in a real external dashboard/query tool, not only in the worker process's own log output.
