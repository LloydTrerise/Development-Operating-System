# DEVOS-202 — Validation, documentation, and gap disclosure

**Priority:** P1 | **Estimate:** 1d
**Depends on:** DEVOS-198, DEVOS-199, DEVOS-200, DEVOS-201.
**Depended on by:** none — closes Sprint 28 and the whole E27 epic (pending Sprint 27's own independent completion).

## Scope

Full monorepo validation, plus explicit disclosure of any real gap DEVOS-198–201 surfaced.

## Implementation

- Run `pnpm turbo run typecheck lint test build --filter='!@devos/e2e-tests'`; fix any real failure.
- Run the full real `tests/e2e` suite; confirm every existing file remains green (no existing test configures `reliabilityReduction`, so this is a pure regression check on `resolveApprovalRequirements`).
- Record in this file's own Acceptance section any real gap found — expected candidates: the tool-invocation `REQUIRE_APPROVAL` path's own pre-existing, still-unaddressed gap (explicitly out of this epic's scope, per the backlog document and both sprint READMEs); whether a canvas-editor UI for authoring `reliabilityReduction` (deferred per DEVOS-199's own "out of scope") should be a follow-up item.

## Out of scope

Any new feature.

## Acceptance

Full validation green: `pnpm turbo run typecheck lint test build --filter='!@devos/e2e-tests'` **76/76 successful** across all 19 non-e2e packages (typecheck, lint, test, build). The full real `tests/e2e` suite **27/27 files, 52/52 tests green** (26/51 pre-existing files/tests unaffected, plus the one new `approval-reliability-reduction-pilot.test.ts` file/test this sprint added) — no existing test configures `reliabilityReduction`, so this is a pure regression check on `resolveApprovalRequirements` confirming zero behaviour change for every pre-DEVOS-199 `APPROVAL` node.

`requiredApprovers` cannot be reduced below 1 by any configuration this sprint introduced: `resolveApprovalRequirements`'s own `Math.max(1, Math.min(...))` floor (`run-approval-task.ts`) is unconditional, not itself configurable, and is directly proven by DEVOS-199's own `reducedRequiredApprovers: 0` hostile-config unit test (`run-approval-task.test.ts`) still producing `requiredApprovers: 1`.

## Gaps disclosed (not silently patched)

- **The tool-invocation `REQUIRE_APPROVAL` policy path remains untouched and still has its own pre-existing, separately-disclosed gap** (`invoke-tool.ts` treats it identically to `DENY`, never creating a real `Approval` row) — explicitly out of this epic's scope from the start (backlog §9, both sprint READMEs), not a new finding.
- **DEVOS-199's own spec text assumed an existing `approval.created` audit-record write to additively extend** ("never a new audit action, an additive field on the existing one") — direct inspection before implementing found no such write exists anywhere in this codebase: neither `run-approval-task.ts` (the `APPROVAL` graph-node creation path) nor `request-approval.ts` (the tool-invocation-triggered creation path) ever calls `auditRecords.create` for approval *creation* (only approval *decisions*, and even then only implicitly via `decideApprovalAndTransition`'s own transaction, not a dedicated audit action). Rather than fabricate a new audit action the spec's own grounding didn't actually establish, `reliabilityEvidence` was instead persisted directly on the `Approval` row itself (a real, nullable JSONB column, migration `0041`) and surfaced through the existing approval-listing DTO/`GovernancePage.tsx` (DEVOS-200) — governance visibility is fully real and achieved, just not through an audit-record path that doesn't exist. A dedicated `approval.created` audit action (covering both the static/policy-tiered and reliability-conditioned resolution) would be a reasonable, disclosed future addition, mirroring DEVOS-086's own four-family audit scope, but was not fabricated here to satisfy an inaccurate spec assumption.
- **DEVOS-200's own acceptance text asked for "the resulting requiredApprovers versus what the static/policy-tiered resolution would otherwise have required"** — only the final, post-reduction `requiredApprovers` and the applied-reduction outcome are persisted (`Approval.reliabilityEvidence.appliedReducedRequiredApprovers`, when a reduction was actually applied); the pre-reduction static/policy-tiered value itself is not separately stored anywhere once a reduction has overwritten it. `GovernancePage.tsx` therefore shows the real resulting `requiredApprovers` and the real reliability outcome (checked/not-checked, signal, and the reduced value when applied), but cannot show a "before vs. after" comparison for the `MET` case without a further, not-yet-scoped field. Not fabricated; flagged instead of silently narrowing DEVOS-199's own explicitly bounded `Approval.reliabilityEvidence` shape to accommodate it.
- **`apps/web` has no browser DOM-rendering test harness** (confirmed by direct inspection: zero `@testing-library/react`/jsdom dependency anywhere in the workspace) — DEVOS-200's own acceptance text ("renders correctly... from a unit/integration-test fixture") was satisfied instead via the real HTTP route/DTO `GovernancePage.tsx` itself fetches from (`GET /projects/:id/approvals`, confirmed by a real integration test in `apps/api/tests/app.test.ts`) and, at full end-to-end scope, via DEVOS-201's own real pilot querying that same live route. No synthetic component-render test was added, since introducing a new test-framework dependency for one narrow assertion would be disproportionate scope for this task (AGENTS.md §11).
- **No canvas-editor UI exists for authoring `reliabilityReduction` on an `APPROVAL` node** — confirmed out of scope from the start (DEVOS-199's own "Out of scope" section, mirroring `riskClass`'s own precedent of shipping the resolution mechanism before its properties-inspector field), not a new finding. A workflow author must still hand-author this field in the node's raw `config` JSON today.
