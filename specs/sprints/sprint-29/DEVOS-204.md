# DEVOS-204 — Regrouped sidebar navigation

**Priority:** P0 | **Estimate:** 1d
**Depends on:** DEVOS-203 (nav restyle applies on top of the new theme tokens).
**Depended on by:** Sprints 35 (Artifacts) and 36 (Integrations), which populate this story's two reserved-empty groups.

## Scope

Replace `apps/web/src/App.tsx`'s flat 14-item `NAV_ITEMS` list with a grouped sidebar, following `Design/DevOS.dc.html`'s mockup IA (`navGroups`, lines 845-850) wherever the mockup names a real, already-existing page, and making one explicit, disclosed placement decision for the 4 real pages the mockup's own groups don't cover.

## Real assumption (flagged per AGENTS.md §7 — no spec states this explicitly)

The mockup's nav groups only account for 10 of today's 14 real pages. This story places the remaining 4 as follows, since no source document specifies it:

- **Project Types** → `Platform` group (alongside Agents/Knowledge/Projects) — it is a platform-level configuration catalog (per-project-type workflow/agent templates), not a single workflow run.
- **Workflow Library** → `Workflows` group, filling the mockup's own "Definitions" slot (today's closest real equivalent to that mockup label).
- **Cost** and **Engineering Intelligence** → `Platform` group, as their own entries (not forced under the mockup's single unwired "Insights" placeholder, since a sidebar `List` entry here is one link per page, not a nested sub-menu).

If the user wants a different placement for any of these 4, it is a one-file, low-cost change to `NAV_ITEMS`'s new grouped shape — flag for confirmation at this story's own review, not a blocking assumption.

## Implementation

- `apps/web/src/App.tsx`: restructure `NAV_ITEMS` (currently a flat array, lines 45-60) into a grouped shape, e.g. `NAV_GROUPS: { label: string; items: { path: string; label: string }[] }[]`, and update the `<Drawer>`'s rendering to emit one `<List>`/`<ListSubheader>` per group instead of one flat `<List>`.
- Groups and their real, already-routed members:
  - **Overview**: Dashboard (`/`)
  - **Work**: Work Items (`/work-items`), Runs (`/runs`)
  - **Workflows**: Workflows (`/workflows`), Workflow Library (`/workflow-library`)
  - **Decisions**: Approvals (`/approvals`), Governance (`/governance`)
  - **Platform**: Organisations (`/organisations`), Projects (`/projects`), Project Types (`/project-types`), Agents (`/agents`), Knowledge (`/knowledge`), Cost (`/cost`), Engineering Intelligence (`/engineering-intelligence`)
- Add two new, deliberately **empty** groups under `Platform` (or as their own top-level groups, matching the mockup's flatter Platform placement): **Artifacts** and **Integrations** — group header rendered, zero items, with a short inline comment noting they populate in Sprints 35/36. Do not add any placeholder/dead link for either (unlike the mockup's own `id: null` stub pattern) — an empty group heading is acceptable scaffolding; a link to a page that doesn't exist is not.
- Do not add an "Administration" group or entry — deliberately excluded epic-wide (backlog §9).
- Preserve every existing route/path string exactly as-is; this story only changes the nav's visual grouping, not any route.

## Out of scope

Adding real links inside the Artifacts/Integrations groups (Sprints 35/36 own that). Any Administration nav entry. Any route change.

## Acceptance

Every one of the 14 existing routes remains reachable from the sidebar, now grouped as above. A real dev-server visual check confirms the grouped nav renders correctly in both light and dark mode (DEVOS-203's theme) with no dead links and the two reserved groups visibly present but empty. `pnpm --filter @devos/web typecheck lint build` green. Any existing test asserting on `NAV_ITEMS`'s flat shape (grep before starting) is updated to match the new grouped shape, not deleted.
