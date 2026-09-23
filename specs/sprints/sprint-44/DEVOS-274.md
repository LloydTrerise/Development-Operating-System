# DEVOS-274 — Nav & IA finalization

**Priority:** P0
**Acceptance summary (from backlog §6.17):** Every nav entry added across Sprints 29–43 (Artifacts, Integrations, marketplace entries, Search, Notifications bell) confirmed live and correctly grouped; no dangling/unwired nav stub remains anywhere in the app.

## Method

`apps/web/src/App.tsx`'s `NAV_GROUPS` constant (the sidebar's own single source of truth, established DEVOS-204) was checked one nav item at a time against the `<Routes>` block in the same file, confirming each `to` path has a matching top-level `<Route path>` rendering a real page component (not a placeholder). The two top-bar items outside `NAV_GROUPS` (`GlobalSearch`, `NotificationBell` — both live in the `AppBar`, not the drawer, per their own sprints' mockup-placement decisions) were checked separately.

## Actual results

**7 nav groups, 18 leaf items, all live, all correctly grouped — zero dangling stubs.**

| Group | Items | Route confirmed |
| --- | --- | --- |
| Overview | Home | `/` → `HomePage` |
| Work | Work Items, Runs | `/work-items` → `WorkItemsPage`; `/runs` → `RunsPage` |
| Workflows | Workflows, Workflow Library | `/workflows` → `WorkflowsPage`; `/workflow-library` → `WorkflowLibraryPage` |
| Decisions | Approvals, Governance | `/approvals` → `ApprovalsPage`; `/governance` → `GovernancePage` |
| Platform | Organisations, Projects, Project Types, Agents, Agent Marketplace, Knowledge, Knowledge Marketplace, Cost, Engineering Intelligence | all 9 confirmed against their own `<Route>` |
| Artifacts | Artifacts | `/artifacts` → `ArtifactLibraryPage` |
| Integrations | Integrations | `/integrations` → `IntegrationsPage` |

Every nav-linked route resolves to a real, non-placeholder page component (verified by import — all 18 page components are real files under `apps/web/src/features/`, none is a stub). Six additional parameterized detail routes exist (`/projects/:id`, `/work-items/:id`, `/agents/:id`, `/knowledge/:id`, `/runs/:id`, `/artifacts/:id`) that are deliberately **not** in the nav — reached by row-click from their own list page, per the `/{area}/:id` convention established Sprint 29 (DEVOS-206) and used consistently since. This is by design, not a gap: none of `/{area}/:id`'s own list pages are missing a link into it.

**Top-bar items** (outside the drawer, per each one's own mockup-placement precedent): `GlobalSearch` (Sprint 41, next to the project selector) and `NotificationBell` (Sprint 43, next to the theme toggle) both confirmed present and imported in `App.tsx`'s `AppBar`. `CommandPalette` (Sprint 41) is mounted at the `App` root, triggered by `Ctrl+K`/`Cmd+K`, not a nav item by design (a global overlay, not a page).

**No orphaned nav-adjacent naming found**: `Agents`/`Agent Marketplace` and `Knowledge`/`Knowledge Marketplace` are deliberately two separate leaf items each (own-project view vs. cross-project marketplace), not a single collapsed entry — matches how Sprints 37/38 built them and how the mockup's own IA never named a marketplace concept to begin with (both marketplace pages are additions beyond the mockup's literal 7 screens, per §1's own stated goal of full functional coverage over literal mockup fidelity).

**Conclusion: zero changes required.** DEVOS-274's acceptance criterion is already met by the state Sprints 29–43 left behind; this task's own contribution is the independent re-verification above, not new code.
