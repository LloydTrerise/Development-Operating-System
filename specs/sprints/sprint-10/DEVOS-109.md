# DEVOS-109 — Wire the generic context builder into `runAgentTask`

**Priority:** P1 | **Estimate:** 2d
**Depends on:** None (Sprint 8 complete).

## Scope

`buildContext()` (`packages/knowledge/src/context/build-context.ts`, DEVOS-041) is standalone, tested, and live-verified, but not called from the live `runAgentTask` path (`packages/application/src/tasks/run-agent-task.ts`) — each of the four planning-path agents still resolves its own prior-stage artifact directly. Replace that per-agent resolution with a single call into `buildContext()`, keeping each agent's own `AgentTaskAdditionalContext` extension point for whatever's genuinely agent-specific.

## Grounding

`DEVOS-PRODUCTION-READINESS-ROADMAP.md` D1, itself carried forward from Sprint 3 item 6 (`DEVOS-BUILD-STATE.md` verification-debt #6) — "explicitly scoped out of Sprint 3's own acceptance criteria," not an oversight.

## Flagged gap

`runAgentTask` already assembles a `ContextManifest` inline (see its own doc comment on `withProvenance`) — confirm `buildContext()`'s own output shape is compatible with, or replaces, that inline assembly before wiring it in, rather than running both and reconciling two manifests.

## Acceptance

A real planning-path run's context manifest is produced by `buildContext()` for every one of its four stages; the manifest's sources are diffed against pre-change behavior and confirmed equivalent (no context an agent previously received is silently dropped). All four `run-*-agent-task.test.ts` suites pass with the new wiring.
