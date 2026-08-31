# Sprint 10 — Engine Reliability & Policy Wiring

**Source:** `specs/DEVOS-POST-POC-BACKLOG-AND-SPRINT-PLAN.md` §8, a direct decomposition of `DEVOS-PRODUCTION-READINESS-ROADMAP.md`'s entire P1 row set (B1, B2, D1, D2, D4, D5, E2, E3, F1, F2).
**Conversion date:** 2026-08-28
**Status:** Proposed — not yet approved to begin.

## Goal

Close every P1 gap the production-readiness roadmap named — code that already exists, is already tested in isolation, but isn't wired into the live path it was built for; plus the observability/scaling gaps that block real multi-instance production load. Unlike Sprint 9 (new external adapters), Sprint 10 is entirely about connecting and hardening what Sprints 1–8 already built.

## Architecture

Nine of this sprint's ten tasks wire existing, already-tested standalone components into a live call path (`packages/knowledge/src/context/build-context.ts`, `packages/policy/src/evaluator/evaluate-policies.ts`) or extend an existing mechanism's coverage (audit, capability attribution, rate limiting, metrics export) — none require new architecture. One (`DEVOS-112`, the re-planning loop) is genuinely new behavior, but has a direct working precedent already in this codebase (`runReviewAgentTask`'s own CHANGES_REQUIRED rework-run pattern, `packages/application/src/tasks/run-review-agent-task.ts`) to mirror.

## In scope

Wiring `buildContext()`/policy evaluation into the live agent-execution and approval-decision paths; an atomic approval-decide transaction; a re-planning loop; real security scanning feeding release readiness; a wired rollback trigger; extended audit and capability-attribution coverage; real metrics/tracing export; a shared rate-limit store.

## Out of scope / deferred

Every item named in `specs/DEVOS-POST-POC-BACKLOG-AND-SPRINT-PLAN.md` §13 (E20–E27). The remaining P2 items in `DEVOS-PRODUCTION-READINESS-ROADMAP.md` (D3, D6, E1, E4, F3, G2, H1–H4, I1) — real but explicitly lower-urgency; revisit only if a specific future task needs one of them, per that document's own recommendation column.

## Sprint-wide acceptance criteria

- Every planning-path agent's context resolution goes through `buildContext()`; no agent has its own bespoke artifact-lookup left as the sole source of context.
- A published policy can block or allow an approval decision, not only a tool invocation.
- An approval decision and its resulting run-status transition are one atomic database transaction.
- A rejected planning approval starts a new planning-path run for the same work item instead of failing it outright.
- Release readiness includes a real security/static-analysis scan result.
- `runReleaseRollbackTask` is reachable from a real, non-test-only trigger.
- Every state-changing operation named in `DEVOS-PRODUCTION-READINESS-ROADMAP.md` F1 produces an audit record.
- `allowedCapabilities` attribution covers every `invokeTool` call site, not only `runDevelopmentAgentTask`.
- The real metrics registry and correlation-id tracing are queryable from outside the process they run in.
- The rate limiter survives a process restart and is correct across multiple `apps/api` instances.

## Quality gates

Each wiring task is proven by a real run that exercises the _new_ path and fails without the fix (the same "reproduce, then fix" discipline `DEVOS-094` already established for the task-queue fencing bug) — not merely a unit test against the already-passing standalone component.

## Key risks

- **Wiring regressions** — every agent task handler currently has its own working, tested context-resolution logic; replacing it with `buildContext()` must not silently change what context a planning-path agent actually receives. Diff the resulting context manifests, don't just check the tests still pass.
- **Transaction scope creep** — `DEVOS-111`'s atomic transaction must not grow to include unrelated work; keep it to exactly the decide + transition pair the gap named.
- **Re-planning loop infinite recursion** — `DEVOS-112` needs the same kind of bound `MAX_AUTOMATIC_REWORK_CYCLES` (`packages/application/src/tasks/run-review-agent-task.ts`) already applies to the development rework loop; a rejected plan must not be able to re-plan forever.

## Exit criteria

Sprint 10 is complete when its sprint-wide acceptance criteria are all met, the full monorepo validation gate is green, and `DEVOS-PRODUCTION-READINESS-ROADMAP.md`'s entire P1 row set is closed.
