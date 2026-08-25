# DEVOS-084 — Tenant isolation tests

**Priority:** P0 | **Estimate:** 1d
**Depends on:** DEVOS-082, DEVOS-083.

## Scope

"Systematic cross-project/org tests" (source, verbatim). DEVOS-049 already established project-scope isolation tests for a handful of resource types. This task systematically extends that coverage across every resource type the API exposes: work items, workflow runs, policies, integrations, agents, knowledge sources, approvals, artifacts.

## Grounding

`specs/api/poc-api-contracts.md` §41: "authorise server-side," "never trust agent-supplied identity." `specs/constitution/devos-engineering-constitution.md` Principle 6.

## Flagged gap

No spec enumerates the full resource-type list to cover — it is derived directly from the existing route table in `apps/api/src/routes/`. A resource type with no project-scoping mechanism at all (rather than a broken one) is a finding to fix under this task, not to work around.

## Acceptance

For each resource type in the route table, a test creates it under project A and asserts a request scoped to project B (same DB, different project) cannot read, modify, or list it. All such tests pass against real Postgres.
