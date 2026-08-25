# DEVOS-101 — Defect/remediation sprint

**Priority:** P0 | **Estimate:** 2d
**Depends on:** DEVOS-100 (its findings define this task's actual content).

## Scope

"Fix pilot-critical issues" (source, verbatim). This task's real content cannot be pre-specified — it is whatever DEVOS-100's real pilot run actually finds, if anything. Its own spec file records what was found and how it was resolved, following the exact same fix-with-a-regression-test discipline every other task in this codebase already uses.

## Grounding

`specs/constitution/devos-engineering-constitution.md`'s own evidence/traceability principles: a fix without a regression test is not considered complete anywhere else in this codebase, and this task does not lower that bar.

## Flagged gap

If DEVOS-100's pilot run finds nothing pilot-critical, this task is honestly recorded as "no critical defect found — nothing to remediate," not padded with manufactured work to appear busier than the real pilot run warranted.

## Acceptance

Every issue DEVOS-100 actually found and classified as pilot-critical is fixed and covered by a new regression test; anything found but deliberately not fixed (e.g. genuinely out of this sprint's scope) is explicitly recorded as accepted risk, not silently dropped.
