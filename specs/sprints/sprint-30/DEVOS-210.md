# DEVOS-210 — Wire Home to real navigation

**Priority:** P1 | **Estimate:** 0.5d
**Depends on:** DEVOS-209 (the layout being wired).
**Depended on by:** none — closes the functional half of this sprint before DEVOS-211's validation.

## Scope

Every clickable element on Home navigates to a real, already-existing page. No dead links — confirmed by direct inspection of what real target route exists for each section, per this sprint's own grounding (README/DEVOS-209).

## Implementation

- Work Items KPI tile → `/work-items` (real, existing route).
- Runs In Progress KPI tile → `/runs` (real, existing route).
- Pending Approvals KPI tile → `/approvals` (real, existing route, `ApprovalsPage.tsx`).
- **Artifacts KPI tile is a plain stat, not a link** — confirmed by direct inspection that no Artifact Library page exists anywhere in this app yet (that's Sprint 35's own net-new DEVOS-235); linking it anywhere today would be either a dead link or a misleading link to an unrelated page. Disclosed here rather than silently made clickable to something wrong. Sprint 35's own DEVOS-235/238 is the natural place to wire this tile to the real Artifact Library once it exists.
- Needs Attention rows (pending approvals) → each row links to `/approvals` (confirmed by direct inspection: no per-approval detail route exists yet, per the backlog's §2.3 row 10 — `GET /approvals/:id` is explicitly named as low-priority/not wired this epic — so the list page, not a fabricated detail deep-link, is the real, honest target).
- Active Work rows (in-progress runs) → each row links to `/runs` (confirmed by direct inspection: no `/runs/:id` detail route exists yet — Sprint 29's DEVOS-206 only scaffolded `/work-items/:id` as its proof of concept; a per-run detail route is not in this epic's own §6 story list at all, so `/runs` is the real, honest target, not a fabricated one).
- Recent Activity rows (audit records) → each row links to `/governance` (confirmed by direct inspection: `GovernancePage.tsx` is the one real page that already renders `AuditRecord`s).
- "Start workflow" / "New work item" header actions from the mockup (lines 167-168) are **not built this story** — confirmed by direct inspection that starting a workflow requires selecting a specific workflow/version (`WorkflowsPage.tsx`'s own real flow) and creating a work item requires a real form (`WorkItemsPage.tsx`'s own real flow); a Home-page shortcut duplicating either flow is a real, reasonable future enhancement but not required by DEVOS-208/209's own acceptance text, so it is disclosed as deferred rather than built as a half-wired stub.

## Out of scope

Any new route. Any per-approval or per-run detail page (not in this epic's own story list for this sprint). The mockup's header "Start workflow"/"New work item" quick actions (deferred, disclosed above).

## Acceptance

Real dev-server click-through check: every KPI tile except Artifacts, every Needs Attention row, every Active Work row, and every Recent Activity row navigates to its real target page with no console error and no 404/blank render. The Artifacts tile is confirmed non-interactive (no `href`/`onClick`), not a broken link.
