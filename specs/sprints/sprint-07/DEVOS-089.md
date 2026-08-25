# DEVOS-089 — Implement usage/cost telemetry

**Priority:** P1 | **Estimate:** 1d
**Depends on:** DEVOS-087.

## Scope

"Provider usage and estimated cost records" (source, verbatim). Confirmed by inspection: the Gemini adapter discards the real API response's own `usageMetadata` object (`promptTokenCount`, `candidatesTokenCount`, `totalTokenCount`) today. This task captures that usage on every real model call and records an estimated cost derived from a configured per-token rate.

## Grounding

`specs/api/poc-api-contracts.md` §51 explicitly defers "advanced cost/budget contracts" — this task is scoped to recording real usage/estimated cost, not a budget/enforcement or alerting system, matching the sprint's own "Full FinOps platform" exclusion.

## Flagged gap

No per-token pricing table is specified anywhere in the spec corpus; a configured rate constant (documented as an explicit assumption, not fabricated as if authoritative) is used to compute an estimated — not authoritative — cost figure.

## Acceptance

A real Gemini API call (fixture-recorded, per Sprint 2/4 precedent for live verification) results in a stored usage record (prompt/candidate/total token counts) and an estimated cost value, retrievable per agent execution.
