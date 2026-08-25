# DEVOS-098 — Cost controls

**Priority:** P1 | **Estimate:** 1d
**Depends on:** DEVOS-089 (Sprint 7's usage/cost telemetry).

## Scope

"Budgets, usage limits and alerts" (source, verbatim). DEVOS-089 already records real per-execution token usage and an estimated cost (`AgentExecution.usage`/`estimatedCostUsd`) — this task is specifically the enforcement/alerting half that task's own decision log explicitly deferred (`specs/api/poc-api-contracts.md` §51's "advanced cost/budget contracts"), now in scope because this sprint's own backlog names it directly.

## Grounding

No numeric budget default or alerting mechanism is specified anywhere in the spec corpus. Scoped to a real, checkable per-project budget threshold and a real alert — reusing DEVOS-090's existing governance "risk activity" surface (already filters the real audit trail for `outcome === 'FAILURE'`) rather than building a new alerting channel.

## Flagged gap

Not a payment/billing system — no invoicing, no automatic spend cutoff, no currency conversion. A budget is a simple configured number; exceeding it produces a real, visible audit record, not a blocked action. Actually preventing further agent execution once a budget is exceeded is explicitly not attempted here — that would be premature enforcement with no spec-stated behavior to build against.

## Acceptance

A project with a configured budget and real accumulated `estimatedCostUsd` exceeding it produces a real audit record (visible in the existing Governance dashboard's risk activity) when the threshold is crossed, verified against real Postgres.
