# DEVOS-154 — Tiered, recurring budget alerts

**Priority:** P0 | **Estimate:** 2d
**Depends on:** DEVOS-098 (existing one-time alert mechanism).
**Depended on by:** DEVOS-155 (reuses the same tiered mechanism at organisation scope), DEVOS-157 (pilot).

## Scope

`maybeAlertOnBudgetExceeded`'s single one-time-crossing alert becomes a real, configurable multi-tier mechanism (a "warning" threshold below 100% plus the existing hard-crossing alert), each tier firing its own distinct, real audit record exactly once per crossing — still audit-only, no automatic cutoff.

## Implementation

- Generalize the crossing-detection logic into a reusable helper, e.g. `detectThresholdCrossing(previousTotal, currentTotal, thresholdUsd)`, used once per tier.
- Two tiers against `Project.budgetUsd`: `WARNING_FRACTION = 0.8` (disclosed, approximate default) and the existing 100% hard crossing. Warning tier fires `project.budget_warning`; hard tier keeps firing `project.budget_exceeded` (action name unchanged, so DEVOS-147's existing compliance-export/filter behavior is unaffected).
- Each tier's own crossing is independent and fires at most once per tier per project (mirrors the existing guard: fires only when the pre-completion total was still under that tier's own threshold).

## Out of scope

A configurable-per-project warning fraction (out of this task's own scope — a single disclosed default constant, matching `MAX_AUTOMATIC_REWORK_CYCLES`-style precedent elsewhere in this codebase).

## Acceptance

A real project's accumulated cost crossing 80% of `budgetUsd` produces exactly one `project.budget_warning` audit record; crossing 100% afterward produces exactly one `project.budget_exceeded` audit record; neither fires more than once for the same project. Every existing `run-agent-task.test.ts` budget-alert case still passes.
