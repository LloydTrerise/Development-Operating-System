# DEVOS-133 — Version diff

**Priority:** P1 | **Estimate:** 2d
**Depends on:** DEVOS-136 (the new draft-version primitive — without it, no `WorkflowDefinition` in this codebase has ever had a second version to diff against). Executed 3rd.

## Scope

A structural diff between two published `WorkflowVersion`s of the same `WorkflowDefinition` (WD-011; Designer spec §32's diff areas: tasks/agents/tools/policies/transitions/outputs) — scoped to a real, computed structural diff (an annotated before/after node-and-edge list), not a full visual side-by-side canvas diff (a real, disclosed narrowing the source backlog document itself already states).

## Grounding

Both versions being diffed are already-fetched, real `WorkflowVersion.definition` graphs (`GET /workflows/:workflowId/versions/:version`, already real server-side, wrapped by DEVOS-136's new `getWorkflowVersionByNumber` client function) — no new backend endpoint is needed; a diff is pure client-side computation over two graphs already in hand.

## Implementation

- New `packages/domain/src/workflows/diff-workflow-versions.ts`: `diffWorkflowVersions(before: WorkflowDefinition, after: WorkflowDefinition): WorkflowVersionDiff` — a pure function (same safe-to-import-from-`apps/web` pattern as `validateWorkflowGraph`/`computeExecutionPaths`). Maps the Designer spec's own diff areas onto this engine's real graph shape:
  - **tasks/agents/tools** → nodes, matched by `id`: added (in `after`, not `before`), removed (in `before`, not `after`), changed (same `id`, different `type`/`name`/`agentRef`/`config` — a real, field-level before/after for each changed node).
  - **transitions** → edges, matched by `(from, to, branch)`: added/removed.
  - **policies**/**outputs** → the definition's own top-level arrays: added/removed entries (simple set difference — these are plain string/unknown arrays with no further structure to diff).
- `apps/web`: a new "Compare versions" view (reachable from a workflow's version history, DEVOS-135) with two version-number selectors, rendering the real computed diff as an annotated list (grouped by added/removed/changed), not a canvas.

## Out of scope

A full visual side-by-side canvas rendering of both versions (explicitly deferred by the source backlog document itself).

## Acceptance

Given two real published versions of the same definition (one created via DEVOS-136's new draft-version primitive, edited, and re-published) that differ by an added node, a removed edge, and a changed `CONDITION` node's `config.rule`, `diffWorkflowVersions` reports exactly those three changes and nothing else (proven by a real unit test in `packages/domain`); the UI renders the same result for a real pair of versions fetched from real Postgres.
