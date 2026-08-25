# DEVOS-086 — Implement structured audit

**Priority:** P0 | **Estimate:** 1d
**Depends on:** DEVOS-082.

## Scope

"Complete actor/action/resource trail" (source, verbatim). Confirmed by grep: `writeAuditRecord` is currently only called from workflow-run lifecycle, artifact publish, context manifest recording, approval decisions, and work-item closure. Project/work-item creation, membership add/remove/role-change, policy create/publish, integration creation, and agent create/publish currently write no audit record at all. This task adds audit-record writes at the most security-significant of these gaps: membership changes (add/remove/role-change), policy publish, integration creation (credential registration), and agent publish — not literally every CRUD operation in the codebase, to keep scope proportionate to the sprint's own "avoid over-engineering" risk.

## Grounding

`specs/constitution/devos-engineering-constitution.md` Principle 10 ("Evidence") and Principle 14 ("Observability") — who, what, when, why must be determinable. `specs/api/poc-api-contracts.md` §40: "Audit = protected/append-only."

## Flagged gap

The exact subset of state changes to audit is not specified anywhere; the scoping above (membership, policy publish, integration creation, agent publish) is this task's own explicit, documented decision, chosen because these four are exactly the operations that change who can act or what an agent/tool can reach — the same security-significant boundary DEVOS-085/083 concern themselves with.

## Acceptance

Each of the four operations above writes an audit record (actor, action, resource, timestamp) on success. A test retrieves the audit trail for a project and confirms each operation type is represented after being exercised against real Postgres.
