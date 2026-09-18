# DEVOS-136 — Extend the canvas to per-project workflow editing

**Priority:** P0 | **Estimate:** 2d (+ the new draft-version primitive this task's own scope requires — see below)
**Depends on:** None (Sprint 13 complete). Executed **first** in Sprint 14 — see `README.md`'s disclosed task-order correction.
**Depended on by:** DEVOS-133, DEVOS-135 (both need the new draft-version primitive this task introduces).

## Scope

The same canvas/palette/inspector from Sprint 13 also edits a real project's own cloned `WorkflowDefinition`/`WorkflowVersion` (not only `ProjectType` templates) — closing the other half of the "zero UI for `WorkflowVersion`" gap `specs/architecture/organisations-and-project-types.md` §2 already confirmed.

## Real gap this task must close first (see `README.md`'s grounding)

No mechanism exists to create a new draft version of an already-`PUBLISHED` `WorkflowDefinition` — every real workflow in this codebase is created already-`PUBLISHED` and can never get a second version today. This task adds it, mirroring `packages/application/src/policy/create-policy.ts`'s already-proven pattern exactly (not inventing a new one):

- New `packages/application/src/workflows/create-new-workflow-version.ts`: `createNewWorkflowVersion(deps, principalId, workflowId)` — resolves the definition + membership (same checks `requireDraftVersion` already does), fetches the latest version via `workflowVersions.getLatestForDefinition`, throws `ValidationError` if it's already `DRAFT` ("already has an unpublished draft" — the direct mirror of `createPolicy`'s identical check), else creates version `latest.version + 1` with `status: 'DRAFT'`, `definition` copied verbatim from the latest version (a real starting point to edit from, not a blank graph — matching how an author actually experiences "revising" a workflow), via the existing, unmodified `workflowVersions.create()` repository method (no new repository method needed). Adds an audit record (`workflow.version.drafted`), mirroring DEVOS-115's existing convention.
- New route: `POST ${prefix}/workflows/:workflowId/versions` (`apps/api/src/routes/workflows.ts`) — a natural REST fit alongside the existing `GET` on the same collection path.
- New `apps/web/src/api-client.ts` function: `createWorkflowVersionDraft(workflowId)`.

## Other new `api-client.ts` functions needed (wrapping already-existing, unmodified backend routes)

`getWorkflowDefinition(workflowId)` (`GET /workflows/:workflowId`), `listWorkflowVersions(workflowId)` (`GET /workflows/:workflowId/versions`), `getWorkflowVersionByNumber(workflowId, version)` (`GET /workflows/:workflowId/versions/:version`), `updateDraftWorkflow(workflowId, graph)` (`PATCH /workflows/:workflowId`), `validateDraftWorkflow(workflowId)` (`POST /workflows/:workflowId/validate`), `publishWorkflowVersion(workflowId)` (`POST /workflows/:workflowId/publish`), `listAgents(projectId)` (`GET /projects/:projectId/agents` — already real server-side, confirmed by this sprint's own grounding; needed so a real project's own `AGENT_TASK` nodes populate `agentRef` from the project's real agents, not a type's templates).

## Implementation

- A new page/section (e.g. a "Workflow" detail view reachable from a project's workflow list) renders the same `WorkflowPalette`/`WorkflowCanvas`/`WorkflowNodeInspector` components Sprint 13 built, now bound to a real `WorkflowVersion`'s `definition` instead of a `ProjectTypeWorkflow` template's.
- If the workflow's latest version is `PUBLISHED` (immutable), the UI offers a real "Start new draft" action calling the new `createWorkflowVersionDraft` — only once a `DRAFT` version exists does the canvas become editable, matching the real, unchanged `requireDraftVersion` server-side guard exactly (no client-side illusion of editability the server would reject).
- Save calls the real `updateDraftWorkflow` (PATCH), reusing DEVOS-131's real-time `validateWorkflowGraph` check unchanged for inline feedback before ever hitting the network.
- A real "Publish" action calls `publishWorkflowVersion` — the same real, immutable-version-creating path every existing workflow (seeded or cloned) already goes through, completely unchanged.

## Out of scope

`ProjectType` template editing (Sprint 13, unchanged). Version diff/preview/library UI (DEVOS-133/134/135 — this task only makes a single version editable/publishable).

## Acceptance

A real project's own already-`PUBLISHED` `WorkflowDefinition` gets a real new `DRAFT` version created via the new endpoint; the canvas renders and edits that draft's real graph (including `AGENT_TASK` nodes populated from the project's own real `Agent` list); saving calls the real, unmodified `updateDraftWorkflow`; publishing calls the real, unmodified `publishWorkflowVersion`, producing a real second immutable version — confirmed by a real query against real Postgres.
