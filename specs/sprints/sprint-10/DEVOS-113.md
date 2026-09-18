# DEVOS-113 — Real security/static-analysis scanning stage

**Priority:** P1 | **Estimate:** 2d
**Depends on:** None (Sprint 8 complete). Benefits from, but does not require, Sprint 9's real deployment target.

## Scope

`evaluateReleaseReadiness` (`packages/application/src/workflows/evaluate-release-readiness.ts`, DEVOS-069) checks only test-evidence-passed and review-decision-PASS. Add a real static/security-scanning tool as a new `TOOL_TASK` stage (mirroring the existing Automated Validation stage's own build/test `TOOL_TASK` pattern) feeding a new evidence input into release readiness.

## Grounding

`DEVOS-PRODUCTION-READINESS-ROADMAP.md` E2, Sprint 5 item 7 — "scoped to exactly what this sprint's own evidence supported," at the time.

## Flagged gap

No specific scanning tool is named anywhere in the spec corpus — choose one appropriate to this codebase's own stack (e.g. a real dependency/vulnerability scanner runnable in CI) and record the choice as a flagged assumption.

## Acceptance

A release-path run includes a real scan stage whose real (not fabricated) findings are recorded as a new artifact type, exactly like `TEST_EVIDENCE`; `evaluateReleaseReadiness` treats a failing scan result the same way it already treats a failing test result (blocks readiness) — verified with both a passing and a genuinely failing real scan.
