# DEVOS-323 — Real end-to-end pilot

**Priority:** P1
**Depends on:** Sprint 52 (DEVOS-311, `organisation_llm_providers`), Sprint 53 (DEVOS-316/317, per-task resolution and per-provider pricing), Sprint 54 (DEVOS-319, the real ranked fallback chain).
**Depended on by:** DEVOS-324 (final validation references this task's own results).

## Scope

A real organisation configured with 2+ real providers; the top-priority one deliberately made to fail/be unconfigured; confirms the fallback chain genuinely falls through to the next real provider, the resulting `AgentExecution.estimatedCostUsd` reflects the provider actually used (not the top-priority one), and the choice is audit-recorded (backlog §5.4).

## Real gap found and fixed (not a production bug)

Traced while grounding "the choice is audit-recorded": `AgentExecution.modelReference` (`packages/domain/src/agents/agent-execution.ts`) and `agent_executions.model_reference` (`packages/database/src/repositories/agent-executions.ts`'s own `toDomain()`) have existed since DEVOS-089/149 — but `AgentExecutionRepository.complete()`'s own signature never accepted a `modelReference` parameter, so no caller, ever, in this codebase's history, has supplied one. The column has been permanently `null` for every `AgentExecution` this codebase has ever completed.

Fixed:

- `packages/domain/src/agents/agent-execution.ts`: `AgentExecutionRepository.complete()` gains a new, optional, additive **trailing** parameter, `modelReference?: string` — positioned last so every existing positional call site (real and faked) continues to compile and behave unchanged.
- `packages/database/src/repositories/agent-executions.ts`: the real Postgres `complete()` implementation now accepts the new parameter and sets `model_reference: modelReference ?? null` in the same `UPDATE` that already sets `usage_metadata`/`estimated_cost_usd`.
- `packages/application/src/tasks/run-agent-task.ts`: the one production call site now passes `invocation.modelReference` — the real value `estimateCostUsd` already reads to price this same execution — as the new trailing argument.
- `packages/application/tests/run-agent-task.test.ts`: the in-memory `AgentExecutionRepository` fake's `complete()` now captures the new parameter; the existing "resolves the published agent version, records a SUCCEEDED execution" test gained one new assertion (`modelReference: 'fake-model@1'`) proving the value round-trips through `runAgentTask` itself, not just through the repository layer.

## Real end-to-end pilot

`tests/e2e/llm-provider-fallback-pilot.test.ts` (new, permanent — added to the e2e suite going forward, mirroring `cost-budget-pilot.test.ts`'s DEVOS-157 precedent for "the real end-to-end pilot closing an epic's own exit criterion"). Two real scenarios, each building a real, throwaway organisation/project/agent/workflow/work-item/run/task directly against real Postgres (the same "call `runAgentTask` directly against real repositories" precedent `tests/e2e/approval-expiry.test.ts` established), with two real local `node:http` servers standing in for the real Gemini/Anthropic HTTP APIs (no live `GEMINI_API_KEY`/`ANTHROPIC_API_KEY` exists in this environment, mirroring Sprint 53's/54's own identical disclosed finding):

1. **Unconfigured top-priority provider.** A `gemini` row at priority 1 whose `credentialReference` names an environment variable deliberately never set (`CredentialResolver.resolve()` genuinely returns `null`); an `anthropic` row at priority 2 with a real, resolvable reference. Asserts the gemini stand-in server received **zero** requests (skipped before any HTTP call, per DEVOS-319's own precise "unconfigured" definition) and the anthropic stand-in received exactly one.
2. **Actively failing top-priority provider.** Both rows have real, resolvable credentials, but the gemini stand-in server responds `500` to every request — a genuinely distinct failure mode from "unconfigured," per DEVOS-319's own precise "failing" definition. Asserts the gemini stand-in received exactly one request (genuinely tried, genuinely failed) before the anthropic stand-in received its one successful request.

Both scenarios then assert, against the real Postgres row read back via `AgentExecutionRepository.getById()`:

- `status === 'SUCCEEDED'`.
- `modelReference === 'claude-sonnet-5'` — the real, disclosed gap this task fixed, now durably proven, not just unit-asserted against a fake.
- `estimatedCostUsd` matches `estimateCostUsd()` computed from the real usage numbers the real anthropic stand-in server reported (1200 prompt / 400 candidate tokens) at the real `claude-sonnet-5` per-model rate (DEVOS-317) — a number only the real fallback provider's own real response could have produced, not a number derivable from the top-priority candidate (which, in both scenarios, never returned any usage at all).

Both `it()` blocks clean up all real test data in a `finally` block (mirroring every prior pilot's own established convention); the first additionally confirms zero residual `organisation_llm_providers` rows via a direct query (the table's own `ON DELETE CASCADE` on `organisation_id`, migration `0059`, is relied on rather than a separate explicit delete — confirmed, not assumed).

## Out of scope

Route-level/UI proof (already covered by Sprint 54's own DEVOS-322 real end-to-end proof against a real running `apps/api`) — this task's own job is specifically the cost-attribution/audit-recording half the backlog names, which lives entirely below the route layer. Any change to the fallback logic itself (already correct and already unit-tested, Sprint 54). Displaying `modelReference` in any UI (considered and declined, `README.md`).

## Acceptance

`pnpm --filter @devos/domain --filter @devos/database --filter @devos/agents --filter @devos/application run typecheck` clean; `pnpm --filter @devos/application run test` **398/398** (net zero new/removed — the fix widens an existing test's assertions rather than adding a new one); `pnpm --filter @devos/e2e-tests run typecheck` / `run lint` clean; the new pilot file passes against real Postgres, both scenarios, with zero residual data afterward.

## Actual results

Implemented and verified exactly as planned. See `DEVOS-324.md` for full monorepo validation and the complete real e2e suite run.
