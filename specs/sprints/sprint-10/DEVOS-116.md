# DEVOS-116 — Extend agent-version capability attribution to every `invokeTool` call site

**Priority:** P1 | **Estimate:** 2d
**Depends on:** None (Sprint 8 complete).

## Scope

`allowedCapabilities` enforcement (`DEVOS-085`) is real but scoped to the one call site that attributes a tool invocation to a specific agent version (`runDevelopmentAgentTask`). Extend that same attribution to every other task handler that calls `invokeTool` (at minimum: `runReviewAgentTask`'s own tool use, the Automated Validation `TOOL_TASK` handler, and `DEVOS-113`'s new scanning stage).

## Grounding

`DEVOS-PRODUCTION-READINESS-ROADMAP.md` F2, Sprint 7 item 9 — "no other task handler currently attributes its tool invocations to a specific agent version."

## Flagged gap

Some `TOOL_TASK` handlers (Automated Validation) have no agent behind them at all (`ToolTaskHandlerDeps`'s own doc comment: "Stage 8 ... has no agent"). Attribution for those should be to the _task_/_run_, not fabricate an agent-version reference that doesn't exist — confirm `invokeTool`'s existing signature already supports an optional agent-version attribution, don't force one where none applies.

## Acceptance

Every task handler that calls `invokeTool` either attributes the invocation to a real agent version (verified via a policy denial test on a capability that version isn't allowed) or is confirmed to correctly have no agent to attribute — no call site is silently unenforced.
