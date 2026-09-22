# DevOS UI/UX Redesign & Full Functional Coverage Backlog

**Document:** E28 (UI/UX Redesign & Full Functional Coverage) Backlog & Sprint Plan
**Version:** 3.0 — supersedes v2.0 (which added net-new UI for already-existing backend routes) and v1.0 (visual-redesign-only scope). Revised again per explicit user decision to also build backend-plus-UI for the `ui-spec.txt` areas that had zero backend route, with one deliberate, user-confirmed exception (§2.4).
**Status:** Proposed — not yet approved. This document is scoping only, per `AGENTS.md` §35/§4.2. It does not authorize conversion to `specs/sprints/sprint-29/` (or any later sprint) or any implementation.
**Predecessor:** v2.0 and v1.0 of this same document. Neither was approved or converted, so no completed work is being revised.
**Task-ID authority:** Continues the real, continuous numbering used by `specs/sprints/sprint-01`–`sprint-28` and every prior backlog document (`DEVOS-001`–`DEVOS-202`), starting at `DEVOS-203`.

---

## 1. Purpose

v1.0 of this document scoped a visual/IA reskin of the 14 pages that already exist, explicitly excluding any area with no existing UI at all. The user has since asked for a larger outcome: **marry `ui-spec.txt`'s full 53-section specification with the `DevOS.dc.html` mockup, and ensure that by the end of this epic every real backend capability in the platform is reachable through the UI** — not only restyled, but built where no UI exists today at all.

To make that concrete rather than aspirational, a full audit was run (per `AGENTS.md` §7/§8 — grounded in the real code, not assumed) of every one of the 91 HTTP routes in `apps/api/src/routes/` against every page and API-client call site in `apps/web/src`. §2.3 below is the result. This document's sprint plan (§6) is built directly from that audit: every route the audit marked "N" (no UI at all) or "P" (partial) that represents a real, intended user capability gets a story; every route already marked "C" (covered) only gets touched by the visual-restyle stories carried over from v1.0.

The audit also found five `ui-spec.txt`-named areas with **no backend route at all**: Notifications, cross-entity Search, a Command Palette, a true Administration surface (user/role/tool-capability management, system health beyond one check), and organisation-level membership. A second grounding pass (§2.4) examined each for reusable backend primitives before any story was written for them. Four are well-bounded extensions of infrastructure that already exists (organisation-level membership mirrors the fully-built project-membership pattern with zero schema change; tool enable/disable only needs a toggle route since enforcement already works; system health is a new read-side aggregation; cross-entity search extends a Postgres full-text pattern already proven in Sprint 25; notifications consumes a transactional outbox-event mechanism that already exists end-to-end but has never been read by anything). These four are included in this epic (§6.12–§6.19).

The fifth — **real user identity, invite/suspend, and configurable role/permission management** — is deliberately excluded (§9, user-confirmed). There is no `User` table anywhere in the database; `Principal` is a disclosed local-dev stand-in that trusts any bearer token with zero credential verification; authorization everywhere is a hardcoded `role === 'OWNER'` check, not a configurable role system. Building this properly means designing real identity/credential persistence and likely redesigning the auth boundary — a security-critical undertaking larger than the rest of this epic combined, and not something to bundle into UI/UX work. It is named here as a candidate future epic, not silently dropped.

---

## 2. Grounding

### 2.1 The design artifacts (unchanged from v1.0, carried forward)

See v1.0 §2.1 for full detail. Summary: `DevOS.dc.html` implements 7 of ui-spec.txt's ~14 IA areas as full mockup screens (Home, Work Items, Runs, Approvals, Projects, Governance, Workflow Designer); the rest are unwired nav-label stubs in the mockup itself. `nocturne.css` is missing several tokens the mockup references (status tints, surface/text scale) that must be authored. `Design/uploads/ui-spec.txt` is byte-identical to `Analysis/DevOS_13_UI_UX_Specification_v1.0.docx` (confirmed by matching MD5 hash) and remains the authoritative IA/content reference.

### 2.2 The existing `apps/web` application (unchanged from v1.0, carried forward)

See v1.0 §2.2 for full detail. Summary: Vite + React 19 + TypeScript, React Router v7, MUI v7 + Emotion, `@xyflow/react`. 14 flat page components, one central `api-client.ts` (1069 lines), a flat single-level nav, an MUI theme with no custom status-color tokens, and a documented-but-unimplemented `features/` target folder structure.

**One correction to v1.0's own grounding, found during this audit:** v1.0 assumed the app has no dynamic/detail routes and inferred page-level master-detail state handles this. The audit confirms this precisely: `App.tsx` truly has zero parameterized routes (`/runs/:id`, `/agents/:id`, etc. do not exist) — every page is a flat top-level path, and any "detail view" that exists today is an in-page panel/accordion, not a routed view. This matters for §6's new stories: net-new detail surfaces (Artifact Viewer, Agent detail, etc.) need a decision on whether to introduce real detail routes for the first time or continue the existing in-page-panel convention (raised in §10).

### 2.3 Backend-to-UI coverage audit (new in v2.0)

Full audit of all 91 routes across 19 route files in `apps/api/src/routes/` against `apps/web/src/api-client.ts` and every page/component call site. Full per-route detail is preserved in the audit record this document is built from; this section summarizes by verdict and groups the real gaps by area.

**Covered (no action needed beyond visual restyle):** Organisations list/create, Projects list/create, Project Types full CRUD + workflow/agent template editors, Work Items list/create, Workflows full lifecycle (draft/validate-client-side/version/diff/publish/runs), Workflow Runs start/poll/task-drill-down (task timeline, per-task agent execution with context manifest, per-task tool invocations — genuinely covered, not list-only), Agents list/create/publish/versions/quality, Knowledge Sources list/create/edit/archive/references/**share** (publish side only), Policies full CRUD/publish/simulate, Approvals list/approve/reject, Audit (project + organisation, with client-side filter/export), Cost (project + organisation), Engineering Intelligence (project + organisation + slowest-workflows), Release Readiness, Health.

**Confirmed gaps — real, already-built backend capability with no UI at all, ranked by how complete the backend side is:**

| # | Capability | Routes | Backend completeness | Current UI |
| --- | --- | --- | --- | --- |
| 1 | **Artifact library/viewer/version-history/diff/provenance** | `GET/POST /projects/:id/artifacts`, `GET /artifacts/:id`, `GET /artifacts/:id/versions`, `GET /artifacts/:id/versions/:v`, `GET /artifact-versions/:id`, `GET /artifacts/:id/provenance` | Full CRUD + provenance use-cases exist; 3 of 7 not even client-wrapped | Only a per-run accordion (name/type/status) and a hardcoded version-1 evidence fetch — no library, no viewer, no version history, no diff, no provenance |
| 2 | **Integration CRUD** (DEVOS-194) | `GET/POST /projects/:id/integrations` | Full use-cases exist, routed | Zero — not even a client wrapper |
| 3 | **Agent marketplace** (DEVOS-177/178) | `POST /agents/:id/versions/:v/share`, `GET /organisations/:id/shared-agents`, `POST /organisations/:id/shared-agents/:versionId/install` | Full use-cases exist, routed | Zero |
| 4 | **Knowledge marketplace, consume side** (DEVOS-188/189) | `GET /organisations/:id/shared-knowledge-sources`, `POST /organisations/:id/shared-knowledge-sources/:id/install` | Full use-cases exist, routed, **client wrappers already written** | Wrappers exist but zero call sites — share (publish) side already has UI |
| 5 | **Project membership management** | `GET/POST /projects/:id/members`, `PATCH/DELETE /projects/:id/members/:userId` | Full CRUD exists | Zero — ProjectsPage is create/list/select only |
| 6 | **Work item update** | `PATCH /work-items/:id` (and `GET /work-items/:id`) | Exists | Zero — no status/priority/description edit anywhere |
| 7 | **Run-scoped approval visibility** | `GET /runs/:id/approvals` | Exists | Zero — a run awaiting approval isn't linked from its own RunCard; only the flat project-wide Approvals/Governance list shows it |
| 8 | **Start run from a specific (non-latest) workflow version** | `POST /workflow-versions/:id/runs` | Exists | Zero |
| 9 | **Organisation / Project settings (rename)** | `PATCH /organisations/:id`, `GET /organisations/:id`, `PATCH /projects/:id`, `GET /projects/:id` | Exists | Zero |
| 10 | Minor single-entity detail routes where the list view already carries the needed fields (low priority) | `GET /project-types/:id`, `GET /workflows/:id`, `GET /agents/:id`, `GET /knowledge-sources/:id`, `GET /policies/:id`, `GET /approvals/:id`, `GET /me` | Exist | Not wired; folded into the relevant area's restyle story rather than given dedicated stories, except Agent/Knowledge-source detail which get a real single-item view (§6.7/§6.6) since ui-spec.txt §15/§16/§17 explicitly call for one |

**Two corrections to this session's own prior suspicions, confirmed NOT gaps by the audit:** task-level drill-down in Runs is fully covered (not list-only), and DEVOS-199/200's approval reliability-reduction evidence is genuinely rendered in `GovernancePage.tsx` (not merely an API field).

**Named in `ui-spec.txt` but with no backend route at all as of the v2.0 audit:** Notifications, a cross-entity/full-text Search, a global Command Palette, a consolidated Administration surface (user invite/suspend, role/permission configuration, tool/capability enable-disable, system health beyond `/health`), and organisation-level membership (only project-level membership exists). §2.4 grounds each of these five against real, reusable backend primitives.

### 2.4 Backend primitives for the five previously-excluded areas (new in v3.0)

Grounded by direct code inspection, sized by comparison to two real completed sprints (Sprint 27 — GitLab adapter + first Integration route, ~1080 lines of real code across ~11 files; Sprint 22+23 combined — agent versioning + marketplace, ~3026 lines across 44 files).

| Area | Reusable primitive already real today | What's genuinely missing | Size vs. a completed sprint |
| --- | --- | --- | --- |
| **Organisation-level membership** | `Membership.projectId` is already nullable by design (`packages/domain/src/projects/membership.ts:9`, migration `0003_memberships.ts`); `createOrganisation()` already creates an org-level `OWNER` membership for the creator; `resolveOrganisationMembership()` already resolves org-vs-project membership; the full CRUD pattern (`add-member.ts`/`remove-member.ts`/`change-member-role.ts`/`list-members.ts`) already exists at project scope as a direct template | Four mirrored use-cases, a couple of repository query methods, 4 new routes (`GET/POST /organisations/:id/members`, `PATCH/DELETE /organisations/:id/members/:userId`) | **Small** — smaller than a single Sprint 27 task; zero new schema, zero new domain concept |
| **Tool capability enable/disable** | `ToolCapability.status: 'ACTIVE' \| 'DISABLED'` already exists (`packages/domain/src/tools/tool-capability.ts:31`); enforcement already works today (`invoke-tool.ts:338` already rejects a non-`ACTIVE` capability) | `registerCapability()` always hardcodes `ACTIVE` at creation with no path to `DISABLED`; no repository method, use-case, or route to toggle status | **Small** — the hard part (enforcement) is already done; only a toggle path is missing |
| **System health aggregation** | `/health` already checks database connectivity; `Integration.status` exists as a static config flag | No live per-integration/per-capability health signal, no aggregation route beyond the single DB check | **Small-medium** — new read-side aggregation logic, no new persistence |
| **Cross-entity search + Command Palette** | DEVOS-187 (Sprint 25) already built a real Postgres full-text pattern (`to_tsvector`/`plainto_tsquery`/`ts_rank`) for knowledge sources (`packages/database/src/repositories/knowledge-sources.ts:96-112`), disclosed at the time as an acceptable sequential scan at POC scale; `resolveMembership()` already provides the permission-filtering primitive to reuse per entity type | No search route exists for any entity; the pattern needs extending to 5-6 more tables, a new aggregating use-case fanning out across them, and (for real performance, closing DEVOS-187's own disclosed gap) GIN indexes added via migration. The Command Palette itself needs no new backend beyond Search — every other palette action (open project/workflow/approval/etc.) already has a real route. | **Medium-large** for Search; the Command Palette is pure frontend once Search exists |
| **Notifications** | A full transactional outbox-event mechanism already exists end-to-end: migration `0011_outbox_events.ts`, domain port `packages/domain/src/events/outbox-event.ts`, repository, and a drain function `publishPendingEvents()`; `EventEnvelope`/`EventType` in `packages/contracts/src/events.ts` already catalogs almost exactly the trigger list `ui-spec.txt` §29 names (`ApprovalRequested`, `WorkflowRunFailed`, etc.); events are already written transactionally today from `task-queue.ts` and other repositories | `publishPendingEvents()`'s only sink is a console logger and it is **never called from any app** — real but entirely dormant infrastructure. No `Notification` entity/table exists. Needed: the table/migration, a materialization use-case turning relevant outbox events into per-recipient notification rows (recipient rule, confirmed by the user 2026-09-21: **all project members of any role, plus the specific approval assignee for approval-related events**, mirroring existing membership resolution), routes, and finally wiring the drain loop into a real running process for the first time | **Large** — but this is completing already-shipped, intentionally-built infrastructure, not inventing a new subsystem from nothing |
| **Real user identity / invite / suspend / configurable roles** *(excluded — see §1/§9)* | None. No `User` table exists anywhere; `Principal` is `{id, email?}` with zero persistence, derived by trusting any bearer token (`packages/identity/src/authentication/local-provider.ts`, an explicitly-disclosed dev stand-in); every authorization check in `packages/domain/src/projects/authorization.ts` is a hardcoded `role === 'OWNER'` literal, not a configurable permission system | Real identity/credential persistence, a real invite mechanism, and a real configurable role/permission model — plus, almost unavoidably, a redesign of the auth boundary itself | **Larger than the rest of this epic combined** — a security-critical undertaking, not UI/UX work |

---

## 3. Delivery Principles

Carried forward unchanged from v1.0 (theme not rewrite; one MUI theme variant; author missing tokens once; mechanical folder migration; additive nav regroup; no regressions; demonstrable each sprint) — see v1.0 for full text. Two additions for v2.0's expanded scope:

- **Every net-new UI story wires a real, already-existing backend route.** No story in §6 invents a new endpoint, request/response shape, or business rule. Where a client wrapper doesn't exist yet (Artifacts, Integrations, Agent marketplace), the story adds the wrapper against the route's real, already-defined contract — never a guessed shape.
- **Net-new detail surfaces follow one consistent routing convention, decided once (§10) and applied everywhere**, rather than each sprint inventing its own pattern for "how do you get to a detail view" (in-page panel vs. a real `/entity/:id` route).

---

## 4. Priority Model (unchanged)

| Priority | Meaning |
| --- | --- |
| P0 | Blocks the epic's own stated outcome entirely |
| P1 | Required for a credible, demonstrable MVP of the epic |
| P2 | Real value, deferrable to a later sprint without blocking the epic's own acceptance |

---

## 5. Epic Map

| Sprint | Outcome | Priority |
| --- | --- | --- |
| 29 | Foundation: Nocturne MUI theme, regrouped nav shell, `features/` folder migration, detail-routing convention decided and scaffolded | P0 |
| 30 | Real Home dashboard (net-new) | P0 |
| 31 | Restyle Work Items + Runs; close work-item-update and run-scoped-approval gaps | P1 |
| 32 | Restyle Approvals + Governance | P1 |
| 33 | Restyle Workflow Designer/Workflows/Workflow Library + Projects; close start-run-from-version, project-membership, and org/project-settings gaps | P1 |
| 34 | Restyle remaining pages (Organisations, Project Types, Agents, Knowledge Sources, Cost, Engineering Intelligence); add Agent detail and Knowledge Source detail views | P1 |
| 35 | **Artifact Library & Viewer** (net-new — largest confirmed gap) | P0 |
| 36 | **Integrations page** (net-new, DEVOS-194 routes) | P1 |
| 37 | **Agent Marketplace** (net-new — browse/install org-shared agent versions) | P2 |
| 38 | **Knowledge Marketplace, consume side** (net-new — browse/install org-shared knowledge sources) | P2 |
| 39 | Organisation-level membership + tool capability enable/disable + system health aggregation (backend + UI) | P1 |
| 40 | Cross-entity search (backend): generalized full-text pattern + aggregating search route | P1 |
| 41 | Cross-entity search UI + global Command Palette | P1 |
| 42 | Notifications (backend): entity, event-consumption/materialization, routes | P1 |
| 43 | Notifications UI | P1 |
| 44 | Full-epic re-audit, nav finalization, validation, and close-out | P0 |

---

## 6. Product Backlog

### 6.1 Sprint 29 — Theme, Navigation, Folder & Routing Foundation

| ID | Story | Pri | Acceptance summary |
| --- | --- | --- | --- |
| DEVOS-203 | Nocturne MUI theme | P0 | Same as v1.0 DEVOS-203: `theme.ts` gains the Nocturne palette/typography/shape variant plus the authored status-tint set, for light and dark mode; `StatusChip.tsx` resolves colors from the new tokens. |
| DEVOS-204 | Regrouped sidebar navigation | P0 | Same as v1.0 DEVOS-204, extended to reserve (but not yet populate with content) two new top-level groups this epic will fill in later sprints: "Artifacts" and "Integrations" under Platform. No route exists for either yet — the nav entries are added only once their sprint (35/36) ships; this story just confirms the grouped shape accommodates them without later rework. |
| DEVOS-205 | `features/` folder migration | P1 | Same as v1.0 DEVOS-205: mechanical move to the documented `features/{area}/` structure, import-path-only changes. |
| DEVOS-206 | Decide and scaffold the detail-routing convention | P0 | Per §2.2's correction, the app has zero parameterized routes today. This story picks one convention (recommended: introduce real `/entity/:id` routes for genuinely new detail surfaces going forward — Artifact Viewer, Agent detail, Knowledge Source detail — while leaving existing in-page panels, e.g. Runs' task drill-down, exactly as they are) and adds the routing scaffolding (route pattern, a shared detail-page layout shell) that later sprints reuse, without yet adding any actual detail page content. |
| DEVOS-207 | Validation, documentation, and gap disclosure | P1 | Full monorepo validation green; full real `tests/e2e` suite green; dev-server visual check across light/dark mode and grouped nav. |

### 6.2 Sprint 30 — Home Dashboard (net-new)

| ID | Story | Pri | Acceptance summary |
| --- | --- | --- | --- |
| DEVOS-208 | Home dashboard data | P0 | Real `features/home/HomePage.tsx` backed by real existing endpoints (work items, runs, approvals, integrations-health once Sprint 36 exists — until then, omit that tile rather than fabricate it). |
| DEVOS-209 | Home dashboard layout | P0 | Mockup's Home layout: KPI tiles, needs-attention, active work, recent activity, system health — Nocturne-themed. |
| DEVOS-210 | Wire Home to real navigation | P1 | Click-throughs navigate to real pages/detail views; no dead links. |
| DEVOS-211 | Validation, documentation, and gap disclosure | P1 | Full validation green; any mockup widget with no real backing data explicitly omitted and disclosed, never fabricated. |

### 6.3 Sprint 31 — Work Items & Runs: Restyle + Gap Closure

| ID | Story | Pri | Acceptance summary |
| --- | --- | --- | --- |
| DEVOS-212 | Work Items restyle | P1 | Dense-table layout, stage-progress bars, filter chips, on existing real data/logic. |
| DEVOS-213 | Work item detail & edit | P0 | Closes the `GET`/`PATCH /work-items/:id` gap: a real detail view (using Sprint 29's routing convention) lets a user change status/priority/description, with the same validation the backend already enforces — no new business rule invented. |
| DEVOS-214 | Runs restyle | P1 | Mockup's Runs layout (pipeline header, task list, task-detail tabs) on existing real data/logic; large page may be split into sub-components under `features/runs/` as part of this story. |
| DEVOS-215 | Run-scoped approval visibility | P0 | Closes the `GET /runs/:id/approvals` gap: a run's own card/detail surfaces its pending or resolved approval directly, linking to the full Approval detail rather than requiring a separate trip to the Approvals page. |
| DEVOS-216 | Cross-check existing e2e/UI coverage | P1 | Every existing test touching Work Items/Runs re-run; any markup-dependent assertion updated and disclosed. |
| DEVOS-217 | Validation, documentation, and gap disclosure | P1 | Full validation green; full real `tests/e2e` suite green. |

### 6.4 Sprint 32 — Approvals & Governance Restyle

| ID | Story | Pri | Acceptance summary |
| --- | --- | --- | --- |
| DEVOS-218 | Approvals restyle | P1 | Mockup's split-pane Approval Centre layout on existing real data/logic. |
| DEVOS-219 | Governance restyle | P1 | Mockup's 3-panel Governance layout on existing real data/logic; reliability-reduction evidence display (already real, per §2.3) is preserved and restyled, not rebuilt. |
| DEVOS-220 | Cross-check existing e2e/UI coverage | P1 | Same discipline as DEVOS-216, scoped to Approvals/Governance. |
| DEVOS-221 | Validation, documentation, and gap disclosure | P1 | Full validation green; full real `tests/e2e` suite green. |

### 6.5 Sprint 33 — Workflows/Designer & Projects: Restyle + Gap Closure

| ID | Story | Pri | Acceptance summary |
| --- | --- | --- | --- |
| DEVOS-222 | Workflow Designer restyle | P1 | Node palette/canvas/inspector visual language on unchanged React Flow behavior. |
| DEVOS-223 | Workflows + Workflow Library restyle | P1 | New theme's table/card patterns. |
| DEVOS-224 | Start run from a specific workflow version | P2 | Closes `POST /workflow-versions/:id/runs`: the Workflow Library's version history gains a "Run this version" action alongside its existing clone action. |
| DEVOS-225 | Projects restyle | P1 | Mockup's Projects grid-of-cards layout on existing real data/logic. |
| DEVOS-226 | Project membership management | P0 | Closes all 4 member routes: a real members panel (per-project, reachable from the Projects area) lists members, invites/adds one, changes a role, and removes one — using the backend's existing validation/authorization exactly as-is. |
| DEVOS-227 | Organisation & Project settings | P1 | Closes `GET`/`PATCH /organisations/:id` and `/projects/:id`: a lightweight settings panel (rename only, matching what the routes actually support — no new fields invented) on each area. |
| DEVOS-228 | Validation, documentation, and gap disclosure | P1 | Full validation green; full real `tests/e2e` suite green. |

### 6.6 Sprint 34 — Remaining Pages: Restyle + Detail Views

| ID | Story | Pri | Acceptance summary |
| --- | --- | --- | --- |
| DEVOS-229 | Organisations + Project Types restyle | P2 | New theme's table/card patterns, no mockup screen exists so layout follows the design system's general rules. |
| DEVOS-230 | Agents restyle + Agent detail view | P1 | `AgentsPage.tsx` restyled; closes `GET /agents/:id` with a real detail view (per ui-spec.txt §15/§16: identity, role, status, version, capabilities, knowledge access, tools, policies) using Sprint 29's routing convention. |
| DEVOS-231 | Knowledge Sources restyle + detail view | P1 | `KnowledgeSourcesPage.tsx` restyled; closes `GET /knowledge-sources/:id` with a real detail view (status, permissions, freshness, per ui-spec.txt §17). |
| DEVOS-232 | Cost + Engineering Intelligence restyle | P2 | New theme's table/card patterns. |
| DEVOS-233 | Validation, documentation, and gap disclosure | P1 | Full validation green; full real `tests/e2e` suite green. |

### 6.7 Sprint 35 — Artifact Library & Viewer (net-new, largest gap)

| ID | Story | Pri | Acceptance summary |
| --- | --- | --- | --- |
| DEVOS-234 | Artifact API client completion | P0 | Adds the 3 currently-unwrapped client functions (`createArtifact`, `getArtifactForPrincipal`, `listArtifactVersions`) plus `getArtifactProvenance`, against their existing, unchanged route contracts. |
| DEVOS-235 | Artifact Library page | P0 | New `features/artifacts/ArtifactLibraryPage.tsx` (per ui-spec.txt §19): search, filter by type/status/project/author, backed by `GET /projects/:id/artifacts`. New "Artifacts" nav entry (reserved in Sprint 29) now populated. |
| DEVOS-236 | Artifact Viewer | P0 | Real detail view (Sprint 29's routing convention) per ui-spec.txt §20: header (type/version/status), content, metadata, provenance (via DEVOS-234's new wrapper), relationships. |
| DEVOS-237 | Artifact version history & diff | P1 | Uses `listArtifactVersions`/`GET /artifacts/:id/versions/:v`: a version list plus a diff between two versions where the content type supports it (text-based artifacts at minimum), per ui-spec.txt §19/§20. |
| DEVOS-238 | Replace hardcoded version references with real navigation | P1 | RunsPage's hardcoded version-1 evidence fetch and Approvals' evidence-name-only resolution both link through to the real Artifact Viewer instead, closing the "partial" verdicts the audit found for `GET /artifacts/:id/versions/:v` and `GET /artifact-versions/:id`. |
| DEVOS-239 | Validation, documentation, and gap disclosure | P1 | Full validation green; full real `tests/e2e` suite green. |

### 6.8 Sprint 36 — Integrations Page (net-new)

| ID | Story | Pri | Acceptance summary |
| --- | --- | --- | --- |
| DEVOS-240 | Integrations API client | P0 | Adds `listIntegrations`/`createIntegration` wrappers against DEVOS-194's existing, unchanged route contracts (zero wrapper exists today). |
| DEVOS-241 | Integrations page | P0 | New `features/integrations/IntegrationsPage.tsx` (per ui-spec.txt §24): list of configured integrations (type, health/status as the route's DTO actually provides — no fabricated health-check UI beyond what the backend returns) plus a register-new-integration form matching the route's real request shape. New "Integrations" nav entry (reserved in Sprint 29) now populated. |
| DEVOS-242 | Home dashboard integration-health tile | P2 | Now that Integrations exists, Sprint 30's deliberately-omitted health tile (DEVOS-208) is added for real. |
| DEVOS-243 | Validation, documentation, and gap disclosure | P1 | Full validation green; full real `tests/e2e` suite green. |

### 6.9 Sprint 37 — Agent Marketplace (net-new)

| ID | Story | Pri | Acceptance summary |
| --- | --- | --- | --- |
| DEVOS-244 | Agent marketplace API client | P0 | Adds wrappers for `POST /agents/:id/versions/:v/share`, `GET /organisations/:id/shared-agents`, `POST /organisations/:id/shared-agents/:versionId/install` against their existing, unchanged route contracts. |
| DEVOS-245 | Agent marketplace UI | P0 | Within the Agents area: a "Share" action on a published agent version (wiring the share route for the first time in the UI), and a browse/install view for organisation-shared versions, per ui-spec.txt §15's agent-catalogue framing. |
| DEVOS-246 | Validation, documentation, and gap disclosure | P1 | Full validation green; full real `tests/e2e` suite green. |

### 6.10 Sprint 38 — Knowledge Marketplace, Consume Side (net-new)

| ID | Story | Pri | Acceptance summary |
| --- | --- | --- | --- |
| DEVOS-247 | Wire the already-written but never-called client functions | P0 | `listSharedKnowledgeSources`/`installKnowledgeSource` already exist in `api-client.ts` with zero call sites — this story is UI-only, no new client code needed. |
| DEVOS-248 | Knowledge marketplace UI | P0 | Within the Knowledge area: a browse/install view for organisation-shared knowledge sources, alongside the existing share (publish-side) action, per ui-spec.txt §17. |
| DEVOS-249 | Validation, documentation, and gap disclosure | P1 | Full validation green; full real `tests/e2e` suite green. |

### 6.12 Sprint 39 — Organisation Membership, Tool Capability Control & System Health

| ID | Story | Pri | Acceptance summary |
| --- | --- | --- | --- |
| DEVOS-254 | Organisation-level membership backend | P1 | Mirrors `packages/application/src/projects/{add-member,remove-member,change-member-role,list-members}.ts` at organisation scope (`projectId: null`), reusing `resolveOrganisationMembership()` for the requester check and the existing `canManageMembers`-style authorization pattern. New routes: `GET/POST /organisations/:id/members`, `PATCH/DELETE /organisations/:id/members/:userId`. Zero schema change (`Membership.projectId` is already nullable). |
| DEVOS-255 | Organisation-level membership UI | P1 | An organisation-scoped members panel (list/add/change-role/remove), styled consistently with Sprint 33's project membership UI (DEVOS-226). |
| DEVOS-256 | Tool capability enable/disable backend | P1 | Adds a repository method and `setToolCapabilityStatus` use-case that can transition a `ToolCapability.status` to `DISABLED` (enforcement already exists and is unchanged), plus a `PATCH` route, OWNER-gated consistent with existing authorization checks. |
| DEVOS-257 | Tool capability enable/disable UI | P1 | A capabilities view (within Project Types, where capabilities are already surfaced) listing registered tool capabilities with an enable/disable toggle wired to DEVOS-256's new route. |
| DEVOS-258 | System health aggregation backend | P1 | Extends beyond the existing single-database `/health` check to aggregate real, already-available signals — per-integration `status`, per-capability `status` — into one richer health route or DTO. No new live heartbeat mechanism invented beyond what existing fields already track. |
| DEVOS-259 | System health UI | P1 | Home dashboard's system-health tile (deliberately using only real data since DEVOS-208) is wired to DEVOS-258's real aggregated data. |
| DEVOS-260 | Validation, documentation, and gap disclosure | P1 | Full monorepo validation green; full real `tests/e2e` suite green. |

### 6.13 Sprint 40 — Cross-Entity Search (Backend)

| ID | Story | Pri | Acceptance summary |
| --- | --- | --- | --- |
| DEVOS-261 | Generalize the Postgres full-text search pattern | P1 | Extends DEVOS-187's `to_tsvector`/`plainto_tsquery`/`ts_rank` pattern (`packages/database/src/repositories/knowledge-sources.ts:96-112`) to work items, artifacts, workflows, and agents, each as its own repository method. Adds GIN indexes via migration on each newly-searchable column, closing DEVOS-187's own disclosed sequential-scan limitation for every table this story touches (knowledge sources' existing search is left as-is unless indexing it is trivial to include). |
| DEVOS-262 | Cross-entity search aggregator use-case + route | P0 | A new use-case fans out across DEVOS-261's per-entity search methods within a project scope, filtering by `resolveMembership()` exactly as every other project-scoped use-case already does — no new permission model invented. New `GET /projects/:id/search?q=...` route. |
| DEVOS-263 | Validation, documentation, and gap disclosure | P1 | Full monorepo validation green; full real `tests/e2e` suite green. |

### 6.14 Sprint 41 — Cross-Entity Search UI & Global Command Palette

| ID | Story | Pri | Acceptance summary |
| --- | --- | --- | --- |
| DEVOS-264 | Search UI | P0 | The top-bar search input already present in the mockup's app shell (currently non-functional) is wired to DEVOS-262's real route, with results grouped by entity type per `ui-spec.txt` §27, respecting the caller's permissions (already enforced server-side). |
| DEVOS-265 | Global Command Palette | P1 | A ⌘K-triggered palette (`ui-spec.txt` §28: open project, search work, start workflow, open approval, open artifact, open run, jump to agent, open integration, view recent activity) — pure frontend, since every target action already has a real route by this point in the epic. Keyboard-accessible per the spec's own requirement. |
| DEVOS-266 | Validation, documentation, and gap disclosure | P1 | Full monorepo validation green; full real `tests/e2e` suite green. |

### 6.15 Sprint 42 — Notifications (Backend)

| ID | Story | Pri | Acceptance summary |
| --- | --- | --- | --- |
| DEVOS-267 | Notification entity, table, and migration | P0 | A new `notifications` table (recipient principal id, type, reference to the triggering entity, read/unread state, timestamp) and matching domain entity/repository, following this codebase's existing entity/repository/migration conventions exactly. |
| DEVOS-268 | Event-consumption and notification materialization | P0 | Wires `publishPendingEvents()` (currently dead code, `packages/database/src/repositories/publish-events.ts`) into a real consumer loop for the first time, with a new sink that materializes relevant `EventEnvelope`s (`ApprovalRequested`, `WorkflowRunFailed`, `WorkflowRunCompleted`, etc. — the exact `ui-spec.txt` §29 trigger list, all of which already exist in `packages/contracts/src/events.ts`) into per-recipient `Notification` rows. Recipient rule (confirmed by the user 2026-09-21): all project members of any role, plus, where applicable, the specific approval assignee — reusing existing membership resolution, not a new authorization concept. |
| DEVOS-269 | Notification routes | P1 | `GET /notifications` (for the current principal), `PATCH /notifications/:id/read`. |
| DEVOS-270 | Validation, documentation, and gap disclosure | P1 | Full monorepo validation green; full real `tests/e2e` suite green; a real end-to-end proof that a real triggering event (e.g. a real approval request) produces a real notification row for the right recipient. |

### 6.16 Sprint 43 — Notifications UI

| ID | Story | Pri | Acceptance summary |
| --- | --- | --- | --- |
| DEVOS-271 | Notification bell and list | P0 | Header notification bell (already present as a static badge in the mockup) wired to DEVOS-269's real routes; each notification deep-links to its real target (approval/run/artifact/integration) per `ui-spec.txt` §29's action-mapping table. |
| DEVOS-272 | Validation, documentation, and gap disclosure | P1 | Full monorepo validation green; full real `tests/e2e` suite green. |

### 6.17 Sprint 44 — Full-Epic Re-Audit, Nav Finalization & Close-Out

| ID | Story | Pri | Acceptance summary |
| --- | --- | --- | --- |
| DEVOS-273 | Re-run the full route-to-UI audit | P0 | Every backend route across the whole application (the original 91 plus every route added by Sprints 35–42) is re-verified; every "N"/"P" verdict this document committed to closing now shows "C" (or an explicitly disclosed, deliberate exception). |
| DEVOS-274 | Nav & IA finalization | P0 | Every nav entry added across Sprints 29–43 (Artifacts, Integrations, marketplace entries, Search, Notifications bell) confirmed live and correctly grouped; no dangling/unwired nav stub remains anywhere in the app. |
| DEVOS-275 | Full monorepo + e2e validation | P0 | `pnpm turbo run typecheck lint test build` green across the whole epic's changes; full real `tests/e2e` suite green. |
| DEVOS-276 | Final documentation and disclosure of the one deliberately excluded gap | P1 | Explicit written record that real user identity, invite/suspend, and configurable role/permission management (§1/§2.4/§9) remains unbuilt by deliberate, user-confirmed decision — not oversight — and is a candidate future epic starting with identity/auth design. |

---

## 7. Dependencies

- Sprint 29 is a hard prerequisite for every later sprint (theme, nav shell, folder locations, and the detail-routing convention must exist first).
- Sprint 30 has no dependency on Sprints 31–38.
- Sprints 31–34 (restyle + gap closure on existing pages) have no dependency on Sprints 35–38 (net-new areas) and could be reordered or run in parallel by area.
- Sprint 36 (Integrations) should land before DEVOS-242 (Home's integration-health tile), which is why that story is placed inside Sprint 36 rather than Sprint 30.
- Sprint 39 (org membership/tool control/system health) has no dependency on Sprints 35–38 and could run earlier or in parallel.
- Sprint 40 (search backend) must precede Sprint 41 (search UI + Command Palette) — the palette's "search work" action and the search results view both need the real route to exist first.
- Sprint 42 (notifications backend) must precede Sprint 43 (notifications UI) for the same reason.
- Sprints 39–43 have no dependency on Sprints 31–38 and could be reordered relative to them.
- Sprint 44 depends on every prior sprint in this document being complete — it is the epic's own closing audit, not an independent deliverable.
- Sprints 29–38 require no backend/API change — every story in them wires an already-existing, already-tested route. Sprints 39–43 are the exception: each requires real, disclosed backend work (§2.4), but every one of them extends an already-existing primitive (a nullable column, an existing status enum, an existing full-text pattern, an existing but dormant event mechanism) rather than inventing a new subsystem — this is what distinguishes them from the one area (real user identity) deliberately excluded in §9.

## 8. Definition of Done

- Every acceptance-summary cell in §6 is independently verified against a real running `apps/web` dev build, not asserted from code review alone.
- Every new backend story in Sprints 39/40/42 is independently, really verified against real Postgres/real running processes, per this codebase's own established convention (e.g. DEVOS-201's direct-Postgres-query verification pattern) — not asserted from code review alone.
- The Sprint 44 re-audit (DEVOS-273) is the epic's actual proof of "every functionality represented through the UI" — not a narrative claim.
- Full monorepo `pnpm turbo run typecheck lint test build` stays green throughout (excluding `@devos/e2e-tests` only where this repo's own existing Windows-timing caveats already apply).
- `DEVOS-BUILD-STATE.md`/`DEVOS-ROADMAP.md` are updated only on the user's explicit approval of each step, per `AGENTS.md` §18/§19 — this document does not authorize touching either.

## 9. What NOT to build in this epic

- **Real user identity, invite/suspend, and configurable role/permission management** (§1/§2.4). Deliberately excluded per explicit user decision: there is no `User` table, no credential verification, and no configurable role model anywhere in this codebase today — building this properly means designing real identity/auth, a security-critical undertaking larger than the rest of this epic combined, not UI/UX work. Named here as a candidate future epic that would need to start with identity/auth design, not silently built or silently dropped.
- Any change to an existing route's request/response contract. Every net-new UI story in §6.7–§6.10 wires an existing, already-tested contract exactly as it stands.
- Any new authorization/permission model beyond what already exists (`role === 'OWNER'` checks, `resolveMembership`/`resolveOrganisationMembership`). Sprints 39/40/42's new backend stories reuse these exactly as-is.
- Replacing MUI with a different component library, or importing `nocturne.css` as a second styling system.
- The dead, low-priority single-entity GET routes noted in §2.3 row 10 where an existing list view already carries the needed fields (`GET /project-types/:id`, `GET /workflows/:id` definition, `GET /policies/:id`, `GET /approvals/:id`, `GET /me`) — closing these has no user-visible benefit over what already renders today.
- `POST /workflows/:id/validate` (server-side validation) staying dead code — the client-side graph validation already in `WorkflowsPage.tsx` is functionally equivalent for the workflow designer's own purposes; re-wiring the server-side route is real but low-value work, deferred rather than bundled into this epic without a specific reason to prefer it.
- Any part of a future epic beyond this one.

---

## 10. Decisions Already Made By The User

Recorded here for traceability, per `AGENTS.md` §7, so this document's shape is auditable against what was actually asked for rather than assumed:

1. **Implementation approach:** new MUI theme (not adopting `nocturne.css` directly).
2. **Screen scope:** all existing pages get restyled, not only the mockup's 7.
3. **Navigation:** regroup the sidebar now, per the mockup's IA.
4. **Folder structure:** migrate to the documented `features/` layout as part of this epic.
5. **Detail-routing convention (Sprint 29, DEVOS-206):** introduce real parameterized routes for net-new detail surfaces; leave existing in-page panels (e.g. Runs' task drill-down) untouched.
6. **The five backend-less areas:** build backend + UI for four of them now (organisation membership, tool enable/disable, system health, search/Command Palette, notifications — Sprints 39–43).
7. **The fifth (user identity/invite/roles):** excluded from this epic entirely, per its security-critical size and the absence of any real identity foundation to build on (§2.4/§9) — a candidate future epic.
8. **Sprint ordering (2026-09-21):** as proposed — restyle-first. The epic map in §5/§6 runs in its written order: 29 → 30 → 31–34 (restyle + gap closure) → 35–38 (net-new UI on existing routes) → 39–43 (backend-plus-UI for the four included gap areas) → 44.
9. **Notification recipient rule (DEVOS-268, 2026-09-21):** not the originally proposed "project OWNERs plus the specific approval assignee." Confirmed instead as **all project members of any role, plus the specific approval assignee for approval-related events**. §2.4's Notifications row and DEVOS-268's acceptance summary above are both updated to reflect this.

## 11. Open Decisions For The User

Both decisions below are now resolved (§10 items 8–9). This section is kept for traceability of what was asked and answered.

1. ~~**Sprint count, split, and ordering.**~~ Resolved 2026-09-21 — restyle-first, as proposed (§10 item 8).
2. ~~**Notification recipient rule (DEVOS-268).**~~ Resolved 2026-09-21 — all project members plus the specific approval assignee, not OWNERs-only (§10 item 9).
3. **Scope approval for what's proposed.** Still open: if any individual story's boundary in §6 is wrong, say so now rather than after Sprint 29 begins.
4. Per `AGENTS.md` §35/§4.2, converting whichever sprint(s) are approved into `specs/sprints/sprint-29/` (and so on) task files, and any implementation, still requires explicit separate approval — not yet given.
