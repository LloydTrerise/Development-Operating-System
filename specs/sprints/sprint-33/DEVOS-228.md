# DEVOS-228 — Validation, documentation, and gap disclosure

**Priority:** P1 | **Estimate:** 0.5d
**Depends on:** DEVOS-222–227.
**Depended on by:** none.

## Scope

Full validation of the sprint's real changes, and disclosure of any gap found but not fixed, matching every prior E28 sprint's own closing-task convention.

## Implementation

- Full monorepo `pnpm turbo run typecheck lint test build --filter='!@devos/e2e-tests'`.
- The full real `tests/e2e` suite.
- Cross-check every existing e2e/UI test that touches Workflows/Workflow Library/Projects/Organisations for any markup-dependent assertion broken by the restyles (mirroring DEVOS-216/DEVOS-220's own discipline in Sprints 31/32); update and disclose any found.
- Record real gaps found during this sprint's own implementation that were deliberately not fixed (expected candidates, to be confirmed against what was actually found while implementing DEVOS-222–227, not assumed in advance): any restyle-driven visual regression caught only via a real screenshot (this epic's own repeated pattern in Sprints 29/30); any further member/settings-panel limitation found only once real data was exercised.

## Acceptance

Full validation green, matching the prior sprint's own baseline unless a real, disclosed reason changes it. Full real `tests/e2e` suite green. This file's own "Actual results" section records the final counts and any gap disclosure, per this epic's established practice.

## Actual results

Full monorepo `pnpm turbo run typecheck lint test build --filter='!@devos/e2e-tests'`: **76/76 successful**, exactly matching Sprint 32's own baseline (no new package this sprint, only new fields/wrappers/tests within existing ones). The full real `tests/e2e` suite: **27/27 files, 52/52 tests green**, zero regression — re-confirmed a second time after the fix described below.

Cross-check of existing e2e/UI coverage (DEVOS-228, same discipline as DEVOS-216/DEVOS-220): this codebase has no browser DOM-rendering test harness for `apps/web` (re-confirmed, consistent with every prior sprint's own disclosure since DEVOS-202) — no e2e test asserts on any Workflows/Workflow Library/Projects/Organisations markup, so no test needed updating for the restyles themselves. `apps/web/tests/api-client.test.ts` grew from 26 to 32 cases (the six new DEVOS-224/226/227 wrapper tests); all pass.

**A real, pre-existing, significant bug was found while verifying DEVOS-222, confirmed NOT introduced by this sprint's restyle, then root-caused and fixed per explicit user instruction ("fix the bug first") before this sprint was marked complete.** Symptom: selecting an already-drafted workflow version with real content in the Designer (e.g. the seeded "Intake to Artifact" workflow) rendered an apparently-empty canvas — the real node data reached the DOM correctly but React Flow left it permanently at its own pre-measurement `visibility: hidden` state, and the client-side structural-validation banner incorrectly reported the graph as having no name and no nodes despite the loaded draft genuinely containing both. Isolated via a real `git stash` test to reproduce identically against the exact pre-Sprint-33 code, ruling out this sprint's Designer restyle as the cause, then root-caused via temporary debug logging: `WorkflowCanvas.tsx`'s `handleNodesChange` treated *every* React-Flow-reported `NodeChange` — including its own internal `dimensions` measurement events, not just user drags — as a real edit, feeding a brand-new `nodes` array back into `draft` each time; since nothing downstream memoized node identity by content, this recreated the React Flow node objects every render, which React Flow then re-measured, closing an infinite loop that permanently starved both the node's own visibility and `useWorkflowGraphValidation`'s debounce. **Fixed** by filtering to `type === 'position'` changes only and skipping the callback entirely when the resolved position is unchanged from what's already stored — confirmed via a real dev-server check that node selection, drag-repositioning (verified via real before/after `boundingBox()`), Save Draft persistence (verified via a real API re-fetch), and drag-create-from-palette all still work exactly as before, and that the original repro now shows the node `visibility: visible` immediately with zero validation issues. Full detail in `DEVOS-222.md`'s own "Root cause and fix" section. A harmless side effect: the real seeded "Intake to Artifact" workflow now carries an extra real `DRAFT` version 2 from reproducing/verifying this bug, alongside its original `PUBLISHED` version 1 (which remains what any real run-start against its active version resolves to) — the same accepted-stray-test-artifact pattern already documented for DEVOS-090 and Sprint 31.

A second, smaller, also-pre-existing bug (`<div>`-inside-`<p>` invalid HTML nesting from a `Typography`/`StatusChip` combination in the Workflow Library's version-history rows) was found while verifying DEVOS-224 and fixed in place, since this sprint's own DEVOS-224 work was already directly editing that exact markup — see `DEVOS-223.md`/`DEVOS-224.md` for the full account.

Other gaps disclosed, not fixed, consistent with this sprint's own narrow scope: no user-directory/search capability for the Members "add" action (principal-ID text field only, per README grounding — no such capability exists anywhere in this codebase); no `/organisations/:id` detail route (deferred to Sprint 34's own already-planned Organisations restyle); `description`/`status`/`budgetUsd` remain unexposed in either Settings panel (the backlog's own explicit "rename only" scope, not a limitation this sprint discovered); last-owner-removal protection and non-OWNER 403 handling for membership actions were verified only at the "error surfaces correctly" level, not independently re-exercised end-to-end beyond what the pre-existing application-layer tests already cover.

**Sprint 33 (DEVOS-222–228, Workflows/Designer & Projects: Restyle + Gap Closure) implementation and validation are complete.** Per this codebase's own established governance, the sprint is reported here for explicit user review before being marked complete.
