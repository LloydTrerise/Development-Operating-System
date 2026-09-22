# DEVOS-220 — Cross-check existing e2e/UI coverage

**Priority:** P1 | **Estimate:** 0.5d
**Depends on:** DEVOS-218, DEVOS-219 (the markup changes this task cross-checks).
**Depended on by:** DEVOS-221 (full validation assumes this is done).

## Scope

Re-run every existing test touching Approvals/Governance; update any assertion this sprint's changes break; add test coverage for the one new real field this sprint exposes.

## Implementation

- Add a route-level assertion to `apps/api/tests/app.test.ts`'s existing approval DTO tests confirming `riskClass` is surfaced when present on the domain object and omitted when absent, mirroring DEVOS-200's own precedent test for `reliabilityEvidence`.
- Re-run the full real `tests/e2e` suite — approval-related files (`approval-atomicity.test.ts`, `approval-expiry.test.ts`, `approval-node.test.ts`, `approval-reliability-reduction-pilot.test.ts`, `tool-invocation-require-approval.test.ts`, and every workflow-pilot file that exercises an `APPROVAL` node) hit the API directly, not markup, so no assertion changes are expected — confirmed by a clean run, not assumed.
- Re-run `apps/web/tests/api-client.test.ts` in full; no existing test asserts on `Approval`'s exact field set in a way `riskClass`'s addition would break (additive optional fields are safe by construction, confirmed by inspection).

## Out of scope

Any new browser/DOM UI test harness (none exists in this codebase).

## Acceptance

The full real `tests/e2e` suite green, file-by-file, with the actual file/test count recorded. `apps/api` and `apps/web` package test suites green, including the new `riskClass` DTO test.

## Actual results

Added `DEVOS-218: surfaces riskClass on the approval listing DTO when present, and omits it when absent` to `apps/api/tests/app.test.ts`, directly mirroring DEVOS-200's own precedent test's structure and location. `apps/api` test suite: **82/82 green** (was 81 + 1 new). `apps/web` test suite: **26/26 green**, unchanged — no existing test asserted on `Approval`'s exact field set in a way the additive `riskClass` field would break, confirmed by a clean run rather than assumed. The full real `tests/e2e` suite: **27/27 files, 52/52 tests green**, confirmed by a real run — none of the approval-related e2e files needed any assertion changes, since they all exercise the API directly, not markup.
