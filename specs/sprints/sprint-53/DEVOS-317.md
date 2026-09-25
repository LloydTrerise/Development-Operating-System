# DEVOS-317 — Per-provider pricing

**Priority:** P2
**Depends on:** DEVOS-315 (the second provider whose models get real rate rows).
**Depended on by:** None within this sprint — feeds `AgentExecution.estimatedCostUsd` unchanged in spirit (§9.6 of the backlog: stays informational).

## Scope

`packages/agents/src/pricing.ts`'s existing flat, Gemini-only rate table widens to a real per-provider/per-model table, covering the new Anthropic model(s) alongside the existing Gemini ones.

## Implementation

`estimateCostUsd(usage, modelReference)`'s own signature is unchanged — model identifiers are already provider-distinguishing strings (a Gemini `modelRef` never collides with an Anthropic one, confirmed by inspection: `gemini-3.6-*` vs. `claude-*`), so no separate `provider` parameter is needed to disambiguate. `MODEL_RATES` gains two new rows:

- `claude-sonnet-5`: $2.00/$10.00 per 1M input/output tokens (Anthropic's own published rate at the time of writing, converted to this table's per-1K-token unit).
- `claude-haiku-4-5`: $1.00/$5.00 per 1M input/output tokens (same source).

Both are an explicitly approximate estimate, matching this file's own pre-existing Gemini-rate disclaimer — not an authoritative billing figure. An unrecognised or absent `modelReference` still falls back to the same Gemini-flash-shaped default rate, unchanged.

## Out of scope

Any change to how `estimatedCostUsd` is consumed (budget alerts, reporting) — stays informational, per the backlog's own §9.6 resolution. Any dynamic/live pricing lookup.

## Acceptance

`pnpm --filter @devos/agents test` clean. A real unit test confirms `claude-sonnet-5`/`claude-haiku-4-5` resolve to real, distinct, correctly-ordered rates (Sonnet costs more than Haiku, matching their real published pricing), and are distinct from every existing Gemini rate.

## Actual results

Implemented as planned. `pnpm --filter @devos/agents typecheck`/`lint`/`test`/`build` all clean. `pricing.test.ts` gained one new test (`DEVOS-317`) confirming the exact rates above and their correct ordering; all 7 pre-existing pricing tests remain green unmodified. No real bugs found during this task.
