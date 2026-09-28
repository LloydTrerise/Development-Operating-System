# Sprint 55 — Full-Epic Pilot & Close-Out

**Source:** `specs/DEVOS-LLM-CREDENTIAL-MANAGEMENT-BACKLOG.md` §5.4 (candidate epic E30, Organisation LLM Provider & Credential Gateway) — the epic's fourth and last sprint.
**Conversion date:** 2026-09-28
**Status:** Converted and executed per explicit user authorization ("convert to spec and Proceed with sprint. Run through sprint fully without waiting for authorisation after each task. Stop once sprint is done", 2026-09-28), given in direct response to a position report confirming Sprints 52–54 complete and Sprint 55 as the recorded next item.

## Goal

Prove, against a real running system, that this epic's own core promise — an organisation's ranked fallback chain genuinely changes which real provider serves a call, and that choice is genuinely visible in cost and audit data, not just structurally plausible from code review — actually holds. Close the epic with a single written disclosure of everything deliberately left out of scope across all four sprints.

## Grounding (confirmed by direct code inspection at conversion time)

- `packages/application/src/tasks/run-agent-task.ts` already computes `estimatedCostUsd` via `estimateCostUsd(invocation.usage, invocation.modelReference)` (DEVOS-089/149/317) — using the real `usage`/`modelReference` returned by whichever candidate adapter actually succeeded (DEVOS-319's own `createResolvingModelAdapter`, which returns the first `SUCCEEDED` result it gets, never a hypothetical one). This part of the backlog's own DEVOS-323 acceptance text ("`estimatedCostUsd` reflects the provider actually used, not the top-priority one") was therefore already true by construction before this sprint — this sprint's own job for that half is to _prove_ it against a real HTTP path, not to build it.
- A real, disclosed gap was found while tracing the other half of DEVOS-323's acceptance text ("the choice is audit-recorded"): `AgentExecution.modelReference` (`packages/domain/src/agents/agent-execution.ts`) and its backing `agent_executions.model_reference` column have existed since DEVOS-089/149 — `toDomain()` in `packages/database/src/repositories/agent-executions.ts` already reads it back — but **no caller of `AgentExecutionRepository.complete()` has ever supplied a value**: the interface's own `complete()` signature never accepted one, `run-agent-task.ts`'s own call site never passed `invocation.modelReference`, and the real Postgres repository's own `complete()` implementation never wrote it. Every `AgentExecution` ever completed by this codebase — across every one of the 54 prior sprints — has a `null` `model_reference`, regardless of which provider actually ran. With a manually-ranked fallback chain now real (Sprint 54), which provider served any individual call is no longer always the same one project-wide, so this pre-existing gap becomes a real, user-visible loss of traceability for the first time — closing it is this sprint's own real, necessary, in-scope fix, not a hypothetical future nice-to-have.
- `tests/e2e/cost-budget-pilot.test.ts` (DEVOS-157) is this codebase's own established precedent for exactly this class of task: "the real end-to-end pilot closing [an epic]'s own exit criterion," built as a permanent e2e test file (not a disposable script) calling `runAgentTask` directly against real Postgres repositories, kept in the suite going forward. Sprint 55's own pilot (`tests/e2e/llm-provider-fallback-pilot.test.ts`) follows the same shape, substituting `createResolvingModelAdapter` (Sprint 54) wired to real `organisation_llm_providers` for DEVOS-157's own deterministic fixture adapter, and two real local `node:http` stand-in servers (mirroring the disposable `debug-devos319.mjs` script's own precedent from Sprint 54, but made permanent here since the epic's own closing pilot is exactly the kind of proof worth keeping in CI going forward, not a one-off manual check) for the real Gemini/Anthropic HTTP path — no live credential for either provider exists in this environment, mirroring Sprint 53's/54's own identical disclosed finding.
- `resolving-model-adapter.test.ts` (Sprint 54) already thoroughly unit-tests the fallback _logic_ itself (unconfigured/disabled/failing/priority-ordering) via an injected `fetchImpl` mock. This sprint's own pilot deliberately does not re-prove that logic at the unit level again — its job is the one thing the unit tests structurally cannot prove: that the real HTTP path, real Postgres persistence, and real per-provider cost math all still agree once wired together for real.

## Real gap found and fixed (not a production bug — a real, disclosed, pre-existing traceability gap)

See `DEVOS-323.md` for the full fix (`packages/domain/src/agents/agent-execution.ts`, `packages/database/src/repositories/agent-executions.ts`, `packages/application/src/tasks/run-agent-task.ts`, plus the in-memory test fake in `packages/application/tests/run-agent-task.test.ts`): `AgentExecutionRepository.complete()` gains a new, optional, additive trailing `modelReference?: string` parameter; the real Postgres repository persists it; `run-agent-task.ts` now supplies `invocation.modelReference`. Additive and backward-compatible — every existing caller/fake compiles and behaves unchanged; the only observable difference is that `agent_executions.model_reference` is no longer permanently `null`.

## Design choice disclosed: "audit-recorded" means the real `AgentExecution` row, not a new `audit_records` write

`AgentExecution` (with its own `modelReference`/`usage`/`estimatedCostUsd` fields) is this codebase's own established, durable execution ledger — DEVOS-098's own doc comment already describes a budget-threshold crossing as producing "a real, visible audit record" via `audit_records`, a genuinely different, governance-focused table for state changes (permission grants, budget crossings, provider-list writes). Adding a second, redundant `audit_records` row for every single agent execution — something no story in this epic or its four sprints ever asked for — would be new, unscoped behavior. Once the real gap above is fixed, `agent_executions.model_reference` is itself a real, durable, queryable record of which provider served each call, joinable back to its own workflow task/run/project/organisation exactly like every other execution field — satisfying DEVOS-323's "the choice is audit-recorded" acceptance text without inventing a new write path.

## Design choice disclosed: no UI surfaces `modelReference`

`get-agent-execution-summaries-for-run.ts`'s `AgentExecutionSummary` DTO (the real data `RunTaskDetail.tsx` renders) was considered for widening to include `modelReference`, mirroring Sprint 32's own `riskClass` DTO-widening precedent. Deliberately not done: no story in this sprint or the backlog's own §5.4 acceptance text asks for it (the text says "audit-recorded," not "displayed"), and Sprint 54 already closed out this epic's own UI story with the "AI Providers" settings panel. Disclosed here as a real, considered-and-declined addition, not an oversight — a natural candidate for a future, separately-scoped UI task if wanted.

## In scope

- **DEVOS-323** — The real gap fix above, and a real, permanent end-to-end pilot (`tests/e2e/llm-provider-fallback-pilot.test.ts`) proving the fallback chain, real per-provider cost attribution, and the now-fixed recorded-provider-choice all hold against real Postgres and real local HTTP stand-in servers.
- **DEVOS-324** — Final validation and a single written closing disclosure of everything deliberately left out of scope across the whole epic.

## Out of scope

Everything every prior sprint in this epic already disclosed as deliberately out of scope (per-user/project-level credentials, dynamic cost/quality/latency-based routing, automatic budget cutoff, a credential-testing console) — restated in full in `DEVOS-324.md`'s own closing disclosure. Any UI display of `modelReference` (considered and declined above). The pre-existing, cross-cutting API `500` handler observability gap (disclosed and declined for fixing across Sprints 49–54), unrelated to this epic.

## Task index

| ID        | Story                                                   | File           |
| --------- | ------------------------------------------------------- | -------------- |
| DEVOS-323 | Real end-to-end pilot                                   | `DEVOS-323.md` |
| DEVOS-324 | Final validation, documentation, and closing disclosure | `DEVOS-324.md` |
