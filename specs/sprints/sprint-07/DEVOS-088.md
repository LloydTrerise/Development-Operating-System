# DEVOS-088 — Implement tracing

**Priority:** P1 | **Estimate:** 1d
**Depends on:** DEVOS-087 (shares `packages/observability`'s new activation).

## Scope

"API→workflow→agent/tool trace" (source, verbatim). A correlation id is generated at the API boundary (or accepted if already present on the inbound request) and threaded through workflow-run creation, task dispatch, agent execution, and tool invocation, so every log line and audit/metrics record touching a single logical request can be joined by that id.

## Grounding

`specs/architecture/repository-code-structure.md` §24 (`correlation` subdir). `specs/constitution/devos-engineering-constitution.md` Principle 14.

## Flagged gap

No distributed-tracing backend (OpenTelemetry collector, Jaeger, etc.) is specified or in scope — this task implements correlation-id propagation and structured log correlation, not spans shipped to an external trace store, consistent with the sprint's explicit exclusion of a real tracing backend.

## Acceptance

A test triggers a real workflow run through the API and confirms the same correlation id appears in the API request log, the workflow run's stored metadata, and the resulting tool invocation's logged/recorded context.
