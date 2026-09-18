# DEVOS-128 — Canvas foundation

**Priority:** P0 | **Estimate:** 3d
**Depends on:** None (Sprint 12 complete).

## Scope

A real drag-and-drop graph canvas (pan/zoom, per Designer spec §37) integrated into `apps/web`, replacing `ProjectTypeWorkflowsEditor.tsx`'s table-based node/edge editor for `ProjectType` workflow templates — the explicit follow-up `specs/architecture/organisations-and-project-types.md` §12.2 named and deferred.

## Grounding

`ProjectTypeWorkflowsEditor.tsx` (`apps/web/src/components/`) is a plain MUI `Table`/`TextField`/`Select` form, embedded in `ProjectTypesPage.tsx` and driven by the existing `listProjectTypeWorkflows`/`createProjectTypeWorkflow`/`updateProjectTypeWorkflow`/`listProjectTypeAgents` `api-client.ts` functions — all of which this task keeps calling unchanged; only the editing surface for `nodes`/`edges` changes.

## Design decision (confirmed by the user — see `README.md`'s flagged decisions)

Adds `@xyflow/react` as a new `apps/web` dependency (`pnpm add @xyflow/react --filter @devos/web`) — no equivalent capability exists in this repo today.

## Implementation

- New component (e.g. `WorkflowCanvas.tsx`) rendering a `@xyflow/react` `<ReactFlow>` instance: nodes/edges derived from the selected `ProjectTypeWorkflow`'s `definition.nodes`/`definition.edges`, with drag-to-reposition, pan, zoom, and a minimap (Designer spec §37).
- `ProjectTypeWorkflowsEditor.tsx` is updated to render the canvas instead of the table for an existing/new template's node/edge editing; the surrounding key/name form fields and save button are unchanged.
- Node position is a real, new, purely-visual concern this graph model has never needed before (`WorkflowNode` has no `x`/`y` field) — stored as `config.canvasPosition: { x, y }` (an additive, optional field on the existing generic `config` extension point, the same pattern `WorkflowNode.config` already serves for `CONDITION`/`JOIN`/`WAIT`/`APPROVAL`) rather than a new top-level contract field, so an unpositioned (e.g. seeded) graph still validates and loads with a sane default auto-layout.

## Out of scope

The palette (DEVOS-129), the properties inspector (DEVOS-130), real-time validation (DEVOS-131), and save wiring (DEVOS-132) — this task only establishes the canvas itself rendering/repositioning the already-loaded graph.

## Acceptance

An existing `ProjectTypeWorkflow` template's real nodes/edges render as a real draggable, pannable, zoomable graph (not a table) in a real dev-server browser session; repositioning a node and reloading the page preserves its position (round-tripped through `config.canvasPosition`).
