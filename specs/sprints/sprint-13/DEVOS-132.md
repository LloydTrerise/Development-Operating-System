# DEVOS-132 — Wire the canvas to the real `ProjectTypeWorkflow` create/update API

**Priority:** P0 | **Estimate:** 2d
**Depends on:** DEVOS-128–131.

## Scope (corrected from the source backlog document — see `README.md`'s grounding)

The source backlog document's own acceptance summary for this task describes wiring to "the existing, already-implemented `WorkflowVersion` draft → validate → publish API." That lifecycle has no equivalent for a `ProjectTypeWorkflow` **template** (`ProjectTypeWorkflowRepository` has only `create`/`update` — no version, no draft/validate/publish concept exists for a template at all, confirmed by reading the interface directly). Since this sprint's canvas edits templates (DEVOS-128's own acceptance criterion), this task's real scope is: the canvas reads and writes through the existing, already-implemented `listProjectTypeWorkflows`/`createProjectTypeWorkflow`/`updateProjectTypeWorkflow` API (`apps/web/src/api-client.ts`, already called by the table editor this sprint replaces) — not the `WorkflowVersion` endpoints, which remain Sprint 14's own DEVOS-136 scope exactly where the source backlog document already, correctly, places them ("Extend the canvas to per-project workflow editing... closing the other half of the 'zero UI for `WorkflowVersion`' gap").

## Implementation

- The canvas's save action calls the same `createProjectTypeWorkflow`/`updateProjectTypeWorkflow` functions `ProjectTypeWorkflowsEditor.tsx`'s existing `handleSave` already calls (DEVOS-128 keeps this wiring, just swaps the editing surface) — no new API client function and no new backend route are needed for template create/update itself.
- A real save error (the server's own `ValidationError`, e.g. if DEVOS-131's client-side check somehow missed something, or a genuine race with another editor) surfaces the same way `handleSave`'s existing `submitError` state already does today — unchanged behavior, now surfaced from the canvas UI instead of the table form.

## Out of scope

Per-project `WorkflowVersion` draft/validate/publish UI (Sprint 14, DEVOS-136) — no new API client function for `GET/PATCH /workflows/:workflowId`, `POST /workflows/:workflowId/validate`, or `POST /workflows/:workflowId/publish` is added by this task.

## Acceptance

A brand-new `ProjectTypeWorkflow` template is authored entirely through the visual canvas (palette → inspector → real-time validation clean) and saved through the real, unmodified `createProjectTypeWorkflow` call, confirmed by a real query against real Postgres; an existing template's graph is edited on the canvas and saved through the real, unmodified `updateProjectTypeWorkflow` call, confirmed the same way.
