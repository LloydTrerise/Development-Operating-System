# DEVOS-222 — Workflow Designer restyle

**Priority:** P1 | **Estimate:** 1.5d
**Depends on:** none (Sprint 29's `features/` structure and Nocturne theme already exist).
**Depended on by:** none within this sprint.

## Scope

Restyle `WorkflowsPage.tsx`'s editor view into the mockup's 3-column Designer layout (node palette | canvas | inspector), visual language only — `WorkflowCanvas.tsx`'s real React Flow node/edge/drag/connect behavior is unchanged.

## Implementation

- `WorkflowsPage.tsx`: when a draft is loaded, replace the current vertical stack (`WorkflowPalette` above `WorkflowCanvas` above `WorkflowNodeInspector`) with a 3-column MUI `Box`/CSS-grid layout mirroring the mockup's proportions (a fixed-width palette column, a flexible canvas column, a fixed-width inspector column), each column its own bordered/surfaced panel per the established Nocturne panel convention (`GovernancePage.tsx`/`ApprovalsPage.tsx`'s own panel styling from Sprints 31-32).
- `WorkflowPalette.tsx`: no behavior change; restyled (spacing/typography only) to read as a vertical list matching the mockup's palette column rather than a wrapped chip row, since it now lives in a narrow fixed-width column.
- `WorkflowNodeInspector.tsx`: no behavior change to its 537 lines of field logic; only its outer container restyled to fit the fixed-width inspector column (scrollable, matching the mockup's own `overflow:auto` inspector panel).
- The existing header row (version badge, Save/Publish/Start-new-draft actions) is restyled to match the mockup's header bar convention (badge + contextual note + right-aligned action buttons), reusing the real, unchanged `handleSave`/`handlePublish`/`handleStartDraft` handlers.
- The existing version-diff comparison (`WorkflowVersionDiffView`) and validation-issue/path-preview sections remain below the 3-column layout, unchanged in behavior.

## Out of scope

Any change to `WorkflowCanvas.tsx`'s node/edge creation, drag-and-drop, or connection logic. Any change to `WorkflowNodeInspector.tsx`'s field validation/editing logic. A "Diff against vN" quick-action button distinct from the existing version-picker diff UI (the mockup shows one; the real diff UI already exists in a different, already-functional shape — not rebuilt to match the mockup's button literally, since that would be a behavior change disguised as a restyle).

## Acceptance

`pnpm --filter @devos/web typecheck lint build` clean. A real dev-server check: the designer view renders as a 3-column layout (palette, canvas, inspector) at the mockup's approximate proportions; dragging a palette item onto the canvas still creates a real node (unchanged); clicking a canvas node still populates the inspector (unchanged); Save/Publish still persist for real (unchanged). Zero console errors, both light and dark mode.

## Actual results

`WorkflowsPage.tsx`'s draft editor was restyled into a 3-column CSS grid (`200px minmax(0,1fr) 320px`, matching the mockup's proportions): a bordered "Node palette" panel (`WorkflowPalette` given a new `variant="column"` prop — additive, defaulting to the original `variant="row"` wrapped-chip layout so `ProjectTypeWorkflowsEditor.tsx`'s own reuse of the same component, out of this sprint's scope, is visually unchanged), the canvas in its own bordered panel (`WorkflowCanvas` itself completely untouched — confirmed via diff, zero lines changed in that file), and a "Selected node" panel showing either a real placeholder ("Select a node...") or the existing, unmodified `WorkflowNodeInspector`. The header row was restyled to show `StatusChip` for the version status instead of plain text. The definitions list above it was wrapped in a bordered `Paper` panel (secondary line showing the workflow key) as part of this same pass.

`pnpm --filter @devos/web typecheck lint build` clean throughout. A real dev-server check (Playwright, against the real seeded "DevOS POC" project) confirmed the 3-column layout renders correctly and dragging/clicking still works exactly as before — zero console errors on the published-version view.

**A real, pre-existing bug was found while verifying this task, confirmed NOT caused by this sprint's restyle**: selecting a workflow that already has a `DRAFT` version with real content (e.g. the seeded "Intake to Artifact" workflow, 1 real node) loaded a canvas that rendered nothing visible, plus a validation banner incorrectly reporting "name is required" / "at least one node is required" despite the loaded draft genuinely having both. Isolated via a real `git stash` test confirming it reproduced identically against the exact pre-Sprint-33 code, and via real network-response capture confirming the API itself always returned fully correct data — ruling out this restyle and ruling out a backend gap. Initially disclosed as left-unfixed (out of this restyle-only task's own scope), then **root-caused and fixed per explicit user instruction ("fix the bug first")** before this sprint was marked complete — see the "Root cause and fix" section below.

### Root cause and fix

Temporary debug logging (`console.log` at the `setDraft` call site and at render, removed after diagnosis) traced the real sequence: `draft` genuinely did receive the correct data (`name`, the `discovery` node) via `setDraft`, but on every subsequent render `draft`'s own `nodes` array kept getting a *new* object reference — each one identical in value but a different JS identity — and `useWorkflowGraphValidation`'s debounce (`workflow-graph-validation.ts`, keyed on `[graph]` by reference) kept getting reset before it could ever settle on the correct value, so `validationIssues` stayed frozen at its very first (pre-load, empty) computation.

Root cause, confirmed in `WorkflowCanvas.tsx`'s `handleNodesChange`: it treated *every* `NodeChange` React Flow reports — not just user-driven `position` drags, but also its own internal `dimensions` measurement events, which fire automatically for every node on mount — as a real edit, unconditionally calling `onNodesReposition` with a brand-new `nodes` array. That fed back into `draft`, which `WorkflowCanvas` receives as a new `nodes` prop, which `toFlowNodes` (no memoization keyed by content, only by the `nodes` reference) turns into brand-new React Flow node objects every time — which React Flow then treats as genuinely new nodes needing to be measured again, re-firing `dimensions` events, closing the loop. The node was consequently stuck permanently at React Flow's own pre-measurement `visibility: hidden` state, and `draft`'s constant reference churn permanently starved the validation debounce.

**Fix** (`WorkflowCanvas.tsx`'s `handleNodesChange`): filter `changes` to `type === 'position'` only before doing anything, and additionally skip calling `onNodesReposition` entirely when the resolved position for every node is unchanged from its current `config.canvasPosition` (an exact-equality check, not a new object each time). This is the same node/edge-creation and drag behavior as before for a genuine user drag — confirmed via a real dev-server check: node selection still populates the inspector, dragging a node still repositions it for real (confirmed via `boundingBox()` before/after), "Save Draft" still persists for real (confirmed via a direct API re-fetch), and dragging a new node in from the palette still creates it (node count 1 → 2) — but the internal `dimensions`/`select`/other non-position change types no longer feed back into `draft` at all, so the loop cannot start. Re-verified the original repro directly: the "Discovery (TASK)" node now renders `visibility: visible` immediately, the validation banner is gone, and "Save Draft"/"Publish" are both enabled — zero console errors.

A harmless side effect of this investigation: the real seeded "Intake to Artifact" workflow now has a real `DRAFT` version 2 (created while reproducing the bug, then re-saved during the fix's own verification) alongside its original `PUBLISHED` version 1 — the same accepted-stray-test-artifact pattern already documented for DEVOS-090's stray test policies and Sprint 31's own stray test runs; version 1 remains `PUBLISHED` and is what any real run-start against this workflow's active version still resolves to, so this is disclosed as harmless, not silently left unmentioned.

A second, real, pre-existing bug was found and fixed as part of DEVOS-224's own work in the sibling `WorkflowLibraryPage.tsx` (not this file) — see `DEVOS-224.md`'s own Actual results.
