# DEVOS-140 — Policy authoring UI

**Priority:** P0 | **Estimate:** 3d
**Depends on:** DEVOS-139 (the org-scope create/publish path this form's "scope" selector calls).
**Depended on by:** DEVOS-141 (simulation is offered from the same draft-authoring surface, before publish).

## Scope

A real create/edit/publish policy form added to `GovernancePage.tsx` (today read-only), reusing the existing, unmodified `createPolicy`/`publishPolicy`/`createOrganisationPolicy` application functions — closing the "no authoring UI anywhere" gap, the same way `WorkflowsPage.tsx` (DEVOS-136) closed the equivalent gap for `WorkflowVersion`.

## Implementation

- New `apps/web/src/api-client.ts` functions: `createPolicy(projectId, input)` (`POST /projects/:projectId/policies`, wrapping the existing route), `createOrganisationPolicy(organisationId, input)`/`listPoliciesForOrganisation(organisationId)` (DEVOS-139's new routes), `publishPolicy(policyId)` (`POST /policies/:policyId/publish`, wrapping the existing route — confirmed no client wrapper exists yet, only server-side).
- A new "Author policy" form/section in `GovernancePage.tsx`: a scope toggle (this project / this project's organisation), a `key` field, and a rules editor. Given `PolicyDefinition.rules[]`'s real shape (`action`, `effect`, optional `condition` with `actorRole`/`resourceType`/`environment`/DEVOS-138's new `agentId`/`agentVersion`/`workflowId`/`workflowVersion`/`riskClass`), the editor is a real structured form (repeatable rule rows: action text field, effect dropdown, an optional-condition sub-form with one field per known condition key) — not a raw JSON textarea, matching this codebase's own established precedent (`WorkflowNodeInspector.tsx`'s structured `CONDITION.config.rule` editor, not a JSON blob) for authoring a structured domain value through a UI.
- A real "Publish" action, shown only for the policy's own creator/an OWNER, calling the existing, unmodified `publishPolicy`. A `DRAFT` policy can be revised (the existing `createPolicy`/`createOrganisationPolicy` versioning rule applies unchanged — attempting a second draft while one is already unpublished surfaces the existing `ValidationError` message directly).
- The existing read-only `Policies` list section gains the org-scoped list (fetched via `listPoliciesForOrganisation`) alongside the existing project-scoped one, visually distinguished (e.g. an "Organisation" vs "Project" label) so DEVOS-139's precedence is visible, not just functional.

## Out of scope

A visual policy-simulation/what-if surface (DEVOS-141's own UI, deferred to that task). Editing a `PUBLISHED` policy in place (immutable, per spec — revision is via a new draft version, unchanged).

## Acceptance

A real policy is created through the new form (project-scoped), a real organisation-scoped policy is created through the same form's scope toggle, both are published through the new "Publish" action — confirmed via a real running `apps/api` and a real Postgres query showing both new `PUBLISHED` rows with the correct `project_id`/`organisation_id` split. Attempting to create a second draft for an already-drafted key surfaces the existing server-side validation message in the UI, not a raw/unhandled error.
