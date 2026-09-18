# DEVOS-097 — Agent evaluation suite

**Priority:** P0 | **Estimate:** 1.5d
**Depends on:** none within this sprint.

## Scope

"Quality regression and representative scenarios" (source, verbatim). `agent-fixtures-regression.test.ts` (DEVOS-037) already proves the recorded fixture chain plumbs through schema validation and artifact chaining correctly for one representative work item (a CSV-export feature) — but it asserts nothing about output _quality_: whether a response is actually relevant to its specific input, versus merely correctly shaped.

## Grounding

Confirmed by reading the existing test: every assertion is either a status/type check or a structural `toMatchObject` against the fixture's own recorded result — there is no assertion that the _content_ of any stage's output is actually about CSV exports, the reporting dashboard, or anything specific to the work item at all. A schema-shape-only check would not catch a regression where a prompt/schema change made the model produce correctly-shaped but semantically generic or wrong output.

## Flagged gap

No `GEMINI_API_KEY` is available in this session — the same limitation DEVOS-089 disclosed. This task adds content-relevance assertions to the _existing_, already-real recorded fixtures (real Gemini responses from Sprint 2's live verification), rather than fabricating new "recorded" fixtures for additional scenarios that were never actually produced by a live call.

## Acceptance

At least one content-relevance assertion (checking for real, work-item-specific detail, not just a schema-valid shape) is added per planning-path stage (discovery, requirements, technical design, planning) against its existing recorded fixture.
