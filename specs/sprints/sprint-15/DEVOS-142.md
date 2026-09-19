# DEVOS-142 — Validation, documentation, and gap disclosure

**Priority:** P1 | **Estimate:** 1d
**Depends on:** DEVOS-138–141 (validates the whole sprint's real, integrated behaviour).

## Scope

Full monorepo validation confirmed green; any real gap the new attributes/hierarchy/simulation surfaced during DEVOS-138–141 (matching every prior sprint's own honest-disclosure convention) recorded in `DEVOS-BUILD-STATE.md`'s state-change-log, not silently patched or hidden.

## Implementation / verification steps

1. `pnpm turbo run typecheck lint test build --filter='!@devos/e2e-tests'` green across every touched package (`@devos/policy`, `@devos/domain`, `@devos/database`, `@devos/application`, `@devos/tools`, `@devos/api`, `@devos/web`).
2. The full real `tests/e2e` suite (`pnpm --filter @devos/e2e-tests test`) re-confirmed unaffected — no engine/runtime code changed this sprint, only the policy/organisation/audit surfaces, so a regression here would indicate an unintended coupling.
3. `prettier --check` clean across every file this sprint touched.
4. This sprint's own **exit criterion** (`README.md`) demonstrated live, end to end, against real Postgres and a real running `apps/api`: an organisation-scoped policy keyed on a real agent-version or workflow-version/risk-class attribute is authored through the UI (DEVOS-140), simulated against real historical requests (DEVOS-141) showing the intended decision, published (DEVOS-139), and confirmed to actually govern a new real request through the real `invoke-tool.ts` path (DEVOS-138/139's precedence rule).
5. Any real gap found in the process — for example, a mismatch between what DEVOS-141's simulation can reconstruct from an `AuditRecord` and the original real request shape, or any place `resolveEffectivePolicies` does not (or should not) apply — is written up honestly in this file's own "Gaps disclosed" section below once found, and mirrored into `DEVOS-BUILD-STATE.md`.

## Acceptance

All five steps above pass with real, not simulated, evidence. `DEVOS-BUILD-STATE.md`/`DEVOS-ROADMAP.md` updated only on explicit user approval of Sprint 15's completion, per `AGENTS.md` §18/§19 (this document does not itself authorize that update).

## Gaps disclosed

- **DEVOS-138**: `decide-approval.ts`'s own `evaluatePoliciesWithPrecedence` call is still keyed only on `action`/`actorRole`/`resourceType` — an approval decision has no capability/agent-version/workflow-version context available at that call site (an `Approval` carries no `ToolCapability`/`AgentVersion` reference), so the new ABAC attributes only ever govern real tool invocations, not approval decisions themselves. A real, disclosed narrowing, not a silent gap.
- **DEVOS-139**: `createOrganisationPolicy` (like `createPolicy` before it) does not itself require the `OWNER` role to create a *draft* — only `publishPolicy` is OWNER-gated. This preserves the exact pre-existing asymmetry `createPolicy` already had (confirmed by direct inspection before extending it, not a new gap introduced by this task).
- **DEVOS-141**: simulation only ever replays `tool_invocation.*`-shaped `AuditRecord`s (the only category whose `metadata` carries a reliable policy `action`, via `metadata.capability`). `policy.*`/`approval.*`/`membership.*`/`workflow.*` audit categories have no equivalent stored attribute and are silently skipped, not fabricated into an approximate request. Live-verified: a real seeded `tool_invocation.succeeded` audit record for `deploy` (outcome `SUCCESS`) was correctly shown to be `DENY`-decided by a real draft policy before it was ever published.
- **Environment-only, not a code defect**: this Windows checkout's own `core.autocrlf=true` makes every file appear CRLF in the working tree even though the committed git blobs are LF-only (confirmed via `git show`) — `prettier --check` was run with `--end-of-line auto` to validate real style (quotes/width/trailing-commas) without being tripped up by that local line-ending conversion; two transient `vitest` worker crashes (`Assertion failed: new_time >= loop->time`, a libuv/Windows timing issue) occurred once during back-to-back full-suite runs and were independently re-run and confirmed clean, matching the exact "genuine Windows resource contention, not a code defect" precedent `DEVOS-SPRINT10-DECISIONS.md` already documented.

See `DEVOS-BUILD-STATE.md`'s Sprint 15 state-change-log entries for the full, timestamped, authoritative record.
