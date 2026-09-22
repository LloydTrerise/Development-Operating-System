# DEVOS-229 — Organisations + Project Types restyle

**Priority:** P2
**Source:** `specs/DEVOS-UI-UX-REDESIGN-BACKLOG.md` §6.6

## Acceptance summary

New theme's `Paper`/`PanelHeader` table/card patterns on both pages; no mockup screen exists for either, so layout follows the design system's own already-established general rules (see `README.md` grounding), not a named mockup.

## Scope

- `apps/web/src/features/organisations/OrganisationsPage.tsx`: wrap the existing organisation list in a bordered `Paper` panel with a local `PanelHeader`. Add a `StatusChip` for each organisation's real `status` field (present on the domain type, unused by the page today). Keep `OrganisationRow`'s existing inline expand-in-place settings affordance (DEVOS-227) and the "New organisation" form unchanged in behavior.
- `apps/web/src/features/project-types/ProjectTypesPage.tsx`: wrap the list and the selected-type detail section in bordered `Paper` panels with local `PanelHeader`s. Keep `ProjectTypeWorkflowsEditor`/`ProjectTypeAgentsEditor` untouched internally — restyle only wraps them.

## Out of scope

A `/organisations/:id` detail route. Any change to `updateOrganisation`/`createOrganisation`/`createProjectType`/`updateProjectType` call sites' logic. Any change to `ProjectTypeWorkflowsEditor.tsx`/`ProjectTypeAgentsEditor.tsx`.

## Validation

`pnpm --filter @devos/web typecheck lint build`. Manual verification against a real running dev server (Playwright): both pages render with the new panel styling, zero console errors, existing create/edit/toggle-status actions still work.
