# DEVOS-235 — Artifact Library page

**Priority:** P0
**Source:** `specs/DEVOS-UI-UX-REDESIGN-BACKLOG.md` §6.7

## Acceptance summary

New `features/artifacts/ArtifactLibraryPage.tsx` (per `ui-spec.txt` §19): search, filter by type/status/project/author, backed by `GET /projects/:id/artifacts`. New "Artifacts" nav entry (reserved in Sprint 29) now populated.

## Scope

- New `apps/web/src/features/artifacts/ArtifactLibraryPage.tsx`:
  - `listArtifacts(selectedProjectId)` on mount/project-change, mirroring every other project-scoped list page's data-fetch shape.
  - A `Paper`/`PanelHeader` summary table (mirroring `WorkItemsPage.tsx`'s DEVOS-212 dense-table convention): name, type, status, created. Row click navigates to `/artifacts/:id`.
  - A search `TextField` filtering by name substring (client-side, real data only).
  - Data-derived type and status filter chips (the real distinct `type`/`status` values present in the loaded data, never a hardcoded enum — same discipline as `WorkItemsPage.tsx`'s DEVOS-212 status chips).
  - A "New artifact" creation form (`artifactType`, `name`, `content`, optional `contentType`) calling `createArtifact`, mirroring `AgentsPage.tsx`'s own creation-form convention, then refreshing the list.
  - A disclosed note (in the page itself, not just this spec) that cross-project and author filtering (`ui-spec.txt` §19) are not built: the page is already scoped to the globally-selected project (the same convention every other project-scoped page already uses), and the `Artifact` DTO carries no `createdBy` field to filter by (only `ArtifactVersion` does).
- `apps/web/src/App.tsx`: add the `/artifacts` route; populate the previously-empty "Artifacts" nav group with a single `{ to: '/artifacts', label: 'Artifacts' }` entry.

## Out of scope

Export (no supported-representation-generation capability exists anywhere in this codebase). Cross-project search, author filtering. Any change to `listArtifacts`/`createArtifact` semantics.

## Validation

`pnpm --filter @devos/web typecheck lint build`. Manual verification against a real running dev server (Playwright) with the real seeded "DevOS POC" project: list renders real artifacts, search/filter chips narrow the table correctly, a real artifact created through the form appears in the list, row click navigates to the new Viewer.
