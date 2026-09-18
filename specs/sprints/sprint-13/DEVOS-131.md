# DEVOS-131 — Real-time structural validation

**Priority:** P0 | **Estimate:** 2d
**Depends on:** DEVOS-128–130 (a graph with real config to validate).

## Scope

Every meaningful canvas edit re-runs the existing, unmodified `validateWorkflowGraph` (`packages/domain/src/workflows/validation.ts`) and renders errors inline (Designer spec §28's severities — this codebase's own real validator only ever produces one severity, `WorkflowValidationIssue { field, message }`, no Warning/Info/Policy-block distinction; §28's richer taxonomy is aspirational beyond what the real engine checks, so the inspector shows exactly what the real function returns, not a fabricated severity split) — a workflow with a structural error cannot be saved (matching `createProjectTypeWorkflow`/`updateProjectTypeWorkflow`'s own existing, unchanged rejection).

## Design decision (see `README.md`'s flagged decision 3)

Imports `validateWorkflowGraph` directly from `@devos/domain` into `apps/web` for instant, zero-round-trip feedback — the exact same real function `createProjectTypeWorkflow`/`updateProjectTypeWorkflow` already, separately, and non-negotiably re-enforces server-side on save (ADR-WD-004 satisfied by construction: the client's copy is informational, the server call is what actually can't be bypassed, and neither call site changes what the other already does). If this first-of-its-kind `apps/web` → `packages/domain` import drags in Node-specific code when actually attempted, fall back to a small new "validate without saving" endpoint wrapping the same function server-side instead — record which path was taken in this file's own completion note, not silently.

## Implementation

- A debounced (e.g. 300ms after the last edit) call to `validateWorkflowGraph(currentDraftGraph)`, rendering each returned `{ field, message }` inline near the relevant node/edge (or in a summary panel keyed by `field` when the node isn't easily locatable, e.g. a top-level `name`/`nodes` array-length issue).
- The existing save action (DEVOS-132) is disabled while any issue is present, mirroring WD-013 ("a workflow with a structural or security error cannot be published") — here, cannot be _saved_, since `ProjectTypeWorkflow` templates have no separate publish step (`README.md`'s corrected DEVOS-132 grounding).

## Out of scope

Any validation `validateWorkflowGraph` doesn't perform (there is no "security" check distinct from structural referential-integrity/per-node-type-config checks in the real function today — confirmed by reading it directly; DEVOS-131's own title mentions "+ security" per the source backlog's own aspirational framing, but the real function has exactly one validation category).

## Acceptance

A deliberately invalid graph (a duplicate node id; a `CONDITION` node with no `config.rule`; an edge pointing at an undeclared node id) shows the real error inline within one debounce cycle, with save disabled; fixing it clears the error and re-enables save — verified against the real, unmodified `validateWorkflowGraph`, not a client-side reimplementation of its rules.
