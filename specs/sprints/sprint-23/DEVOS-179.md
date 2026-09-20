# DEVOS-179 — Quality-aware selection tie-break

**Priority:** P1 | **Estimate:** 2d
**Depends on:** Sprint 22's DEVOS-174 (the real per-agent-version quality signal).
**Depended on by:** DEVOS-180 (pilot exercises this).

## Scope

Among `selectAgentForTask`'s existing role/capability-matching candidates, prefer the real higher pass rate (DEVOS-174); fall back to today's ascending-`agent.key` tie-break when no quality data exists or rates tie.

## Implementation

- `packages/domain/src/agents/select-agent-for-task.ts`: `selectAgentForTask` gains an optional parameter, e.g. `qualityByAgentVersionId?: Map<string, number>` (pass rate, `0`–`1`). After the existing role/capability filter, sort matches by real pass rate descending (missing data treated as absent from the comparison, not as `0` — a candidate with no data is never penalized below one with a real `0%` rate), then by ascending `agent.key` exactly as today. Zero change to the function's own signature default behaviour when the new parameter is omitted.
- `apps/worker/src/agent-task-router.ts`: when resolving via `selectAgentForTask`, optionally supplies the quality map (fetched via DEVOS-174's own query) — confirm during implementation whether this needs a new `AgentTaskRouterDeps` field or can reuse an existing one; record the choice.

## Out of scope

Any configurable weighting between quality and other factors — this is one fixed, disclosed secondary sort key, not a scoring system. Cost-aware selection (separately, unrelatedly blocked on a real provider cost figure).

## Acceptance

Unit tests: with quality data present and distinct, the higher-pass-rate candidate wins over the lexicographically-earlier key; with no quality data, today's exact behaviour is reproduced byte-for-byte (every existing `select-agent-for-task.test.ts` case passes unmodified); a tie in pass rate falls back to ascending key. `pnpm --filter @devos/domain --filter @devos/worker typecheck test` green.
