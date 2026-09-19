# DEVOS-155 — Organisation-level budget

**Priority:** P0 | **Estimate:** 2d
**Depends on:** DEVOS-150 (`sumEstimatedCostUsdForOrganisation`), DEVOS-154 (tiered mechanism).
**Depended on by:** DEVOS-157 (pilot).

## Scope

`Organisation` gains an optional `budgetUsd` (mirroring `Project.budgetUsd`'s own additive, optional pattern exactly), checked against DEVOS-150's real organisation cost rollup through the same tiered-alert mechanism as DEVOS-154.

## Implementation

- New migration adding `organisations.budget_usd numeric`, mirroring migration `0027`'s own `projects.budget_usd` shape.
- `Organisation`/`CreateOrganisationInput`/`UpdateOrganisationInput` (`packages/domain/src/organisations/organisation.ts`) gain `budgetUsd?: number`; `packages/database/src/repositories/organisations.ts` gains the corresponding read/write mapping.
- New `maybeAlertOnOrganisationBudgetExceeded`, called alongside the existing project-level check in `runAgentTask` after a completed execution's cost is recorded, using `sumEstimatedCostUsdForOrganisation` and firing `organisation.budget_warning`/`organisation.budget_exceeded` audit records via the same tiered helper DEVOS-154 introduced.
- API/UI: `budgetUsd` addable via the existing organisation update path if one exists, or documented as a flagged assumption if organisations currently have no update-field route for it (checked during implementation).

## Out of scope

Any change to how `Project.budgetUsd` itself works (unchanged, extended-alongside not replaced).

## Acceptance

A real organisation with a configured `budgetUsd`, crossed by real accumulated cost across two of its real projects, produces the correct warning/exceeded audit records at the organisation level, verified against real Postgres — independent of any single project's own budget state.
