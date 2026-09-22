# DEVOS-225 — Projects restyle

**Priority:** P1 | **Estimate:** 1d
**Depends on:** none.
**Depended on by:** DEVOS-226/DEVOS-227 (add a new `/projects/:id` detail route this task establishes the entry point for).

## Scope

Restyle `ProjectsPage.tsx`'s bare list into the mockup's grid-of-cards layout, using only real, already-available data — no fabricated health/stat fields (see README grounding).

## Implementation

- `ProjectsPage.tsx`: the existing `List`/`ListItemButton` replaced with a responsive card grid (mirroring the mockup's `repeat(2, minmax(0,1fr))` proportions). Each card shows: a folder icon, project name + slug, a "Current" badge when the card is the selected project (reusing the existing `selectedProjectId` comparison), and a small stat row showing real `status` and a real work-item count fetched the same way `HomePage.tsx`'s KPI tiles and `WorkflowLibraryPage.tsx`'s run-health already fan out per-item (`Promise.all(projects.map(p => listWorkItems(p.id)))`, counting each result's length). The mockup's health line (`p.health`/`healthIcon`/`healthTint`) is **omitted entirely**, not fabricated, per the same "omit rather than invent" discipline `HomePage.tsx`'s own DEVOS-208/209 already established.
- Clicking a card still calls the existing `selectProject` (unchanged selection behavior) and additionally navigates to the new `/projects/:id` detail route (DEVOS-226/227's home), reusing Sprint 29's `DetailPageLayout` convention.
- A new `apps/web/src/features/projects/ProjectDetailPage.tsx` is added at `/projects/:id`, using `DetailPageLayout` (back button + title), showing the project's own name/slug/status/description, with DEVOS-226's membership panel and DEVOS-227's settings panel as its two real sections (built in their own tasks; this task establishes the page shell and route only, per the same "shell first, fill in same sprint" pattern this epic has repeatedly used within a single sprint — see DEVOS-213/215 both landing inside Sprint 31).
- The existing "New project" creation form (below the list today) is preserved, restyled for visual consistency, unchanged in behavior.

## Out of scope

Any fabricated per-project health signal. A `/organisations/:id` equivalent (Sprint 34/39). Any change to `createProject`'s validation or the organisation/project-type selection logic in the creation form.

## Acceptance

`pnpm --filter @devos/web typecheck lint build` clean. A real dev-server check: Projects renders as a card grid with real status/work-item-count per card and a "Current" badge on the selected project; clicking a card navigates to `/projects/:id` and shows the shell (name/slug/status/description); the existing creation form still creates a real project. Zero console errors, both light and dark mode.

## Actual results

`ProjectsPage.tsx` rewritten to a responsive card grid (2 columns at `sm`+, 1 at `xs`), each card showing a folder icon, name/slug, a real "Current" badge on the selected project, real `status` (via `StatusChip`), and a real work-item count fetched via the same per-project `Promise.all(projects.map(p => listWorkItems(p.id)))` fan-out `HomePage.tsx`/`WorkflowLibraryPage.tsx` already established. The mockup's health line is not present anywhere in the new markup — omitted, not fabricated. Clicking a card still calls the existing `selectProject` (unchanged selection semantics) and now also navigates to a new `/projects/:id` route. The existing "New project" creation form is preserved unchanged below the grid.

A new `apps/web/src/features/projects/ProjectDetailPage.tsx` was added (shell only for this task; Members/Settings panels are DEVOS-226/227's own work, landed in the same file in this same sprint) using `DetailPageLayout`, looking up the project from the already-loaded `ProjectContext` (`projects.find(p => p.id === id)`) rather than adding an unused `getProject` single-fetch wrapper — every project is already loaded by the existing `listProjects`-backed context, so a fresh fetch would be a redundant round trip. Wired into `App.tsx` at `/projects/:id`.

`pnpm --filter @devos/web typecheck lint build` clean. A real dev-server check against the real seeded data (multiple real projects) confirmed the card grid renders correctly with real status/work-item counts, the "Current" badge tracks the selected project, and clicking a card navigates to `/projects/:id` showing the real project's name/slug/status/description. Zero console errors, both light and dark mode.
