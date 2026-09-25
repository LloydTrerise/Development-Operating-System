# Sprint 49 — Job Role Catalogue

**Source:** `specs/DEVOS-ACCESS-CONTROL-MODEL-BACKLOG.md` §5/§6.4 (candidate epic E29, Identity & Access Control Redesign).
**Conversion date:** 2026-09-25
**Status:** Converted and executed per explicit user authorization ("convert to specs and Proceed with sprint. Run through sprint fully without waiting for authorisation after each task. Stop once sprint is done", 2026-09-25), in direct response to a position report confirming Sprint 48 complete and Sprint 49 the recorded next item, per `AGENTS.md` §35/§4.2.

## Goal

Give every organisation a real, seeded job-role catalogue (`PO`/`BA`/`DEV`/`QA`), let a principal (human or agent) hold job roles at organisation scope, and let a project activate only the subset of held job roles that principal actually needs there — all explicitly distinct from, and never renamed to match, the existing agent workflow-role dispatch key (decision §9.5).

## Grounding (confirmed by direct code inspection at implementation time)

- No `JobRole`/`MembershipRole`-adjacent concept existed anywhere before this sprint. `MembershipRole` (`OWNER`/`MEMBER`/`ORGANISATION_ADMIN`, `packages/domain/src/projects/membership.ts`) is an *access*-role axis; the agent workflow-role dispatch key (`DISCOVERY`/`REQUIREMENTS`/`TECHNICAL_DESIGN`/`PLANNING`/`DEVELOPMENT`/`REVIEW`) is a *task-routing* key. Job roles are a third, orthogonal axis — a job-function label a principal holds.
- Sprint 47's `access_roles`/`permissions`/`role_permissions` catalogue (`packages/domain/src/access-control/access-role.ts`) was the closest structural precedent for a real, seeded, queryable catalogue table — job roles follow the same shape (plain `string` ids, no branded `JobRoleId` type, matching `AccessRole`'s own convention) but are deliberately a separate table family, not folded into `access_roles`, since job roles and access roles answer different questions ("what can this principal do" vs. "what job function does this principal perform").
- Sprint 46's `ensureAgentPrincipal`-style "one-time migration backfill + an ongoing real chokepoint" shape (DEVOS-295) is the precedent this sprint's own `ensureDefaultJobRolesForOrganisation` follows — wired into `createOrganisationRepository.create()`, the one real chokepoint every organisation-creation path shares (confirmed by `grep -rn "insertInto('organisations')"`, which found exactly two call sites: that repository and `seed.ts`'s own established bypass).
- The acceptance rule "a Dev+BA can act only as Dev on a project that only assigned them the Dev job role" (backlog §6.4, DEVOS-300) is enforced as a real, database-level composite foreign key — `project_member_job_roles(principal_id, job_role_id)` REFERENCES `principal_job_roles(principal_id, job_role_id)` — not just an application-layer check, though `assignProjectMemberJobRole` also pre-checks it for a clean `400` instead of a raw constraint-violation error.

## Design choice disclosed: one UI anchor, not two

The backlog's own acceptance text for DEVOS-301 names two things — "assign job roles to a principal" (organisation scope) and "a per-project subset picker" (project scope) — without naming where either should live. No org-wide "all principals in this organisation" listing exists anywhere in this codebase (`listOrganisationMembers` only returns org-level `ORGANISATION_ADMIN` rows, a much smaller pool than everyone who could hold a job role), so a standalone organisation-wide job-role management page would have nothing real to list its rows against. `ProjectDetailPage.tsx`'s existing Members panel is the one place in this codebase where individual principals already appear as concrete rows — both the organisation-wide grant/revoke action and the per-project active-subset toggle were built onto that same panel, per member row, rather than building a second, mostly-empty page. This is disclosed as a real design choice, not an oversight: a future sprint building real org-wide principal directory browsing would be the natural place to also add a dedicated job-role management page.

## Real bugs found and fixed during implementation

Two real bugs were found and fixed during this sprint's own live verification, not merely disclosed — full details in `DEVOS-302.md`:

1. **`audit_records.target_id` is a native Postgres `uuid` column; the four new job-role use cases originally wrote a composite `${principalId}:${jobRoleId}` string into it.** `principal_job_roles`/`project_member_job_roles` are genuinely composite-key-only join tables with no surrogate uuid id of their own — every existing audit-writing use case in this codebase (`add-member.ts`, `set-tool-capability-status.ts`, etc.) audits a real entity's own uuid primary key, a precedent this sprint's own design broke. Found via a real HTTP call returning a `DEVOS_INTERNAL_ERROR` masking the actual `invalid input syntax for type uuid` error (the API's generic 500 handler does not log the underlying cause — a separate, pre-existing, undisclosed observability gap, not fixed here as out of scope). Fixed by using the real, always-present `organisationId`/`projectId` uuid as `targetId` instead, mirroring `transferOrganisationOwnership`'s own identical "audit the scope entity when no dedicated row id exists" precedent — the specific principal/job-role pair stays fully captured in `metadata`.
2. **`job_roles.organisation_id`'s FK to `organisations.id` had no `ON DELETE CASCADE`**, breaking two existing e2e pilot tests' own cleanup code (`cost-budget-pilot.test.ts`, `knowledge-platform-marketplace-pilot.test.ts`, both hard-delete their own test organisations) — found while running this sprint's own required full `tests/e2e` suite, the identical class of gap Sprint 48 found for `agent_profiles.agent_id`. Fixed in migration `0051` and applied live via `ALTER TABLE` to the already-migrated real database; `principal_job_roles.job_role_id`'s FK to `job_roles.id` and `project_member_job_roles.project_id`'s FK to `projects.id` were both proactively given the same cascade in the same pass, before either could bite a future test the same way.

## In scope

- **DEVOS-299** — `job_roles`/`principal_job_roles` tables (migration `0051`), seeded per-organisation with `PO`/`BA`/`DEV`/`QA`; `packages/domain/src/job-roles/job-role.ts` defines `JobRole`/`JobRoleRepository`/`PrincipalJobRole`/`PrincipalJobRoleRepository`; `packages/database/src/repositories/job-roles.ts`/`principal-job-roles.ts` implement them plus the real, ongoing `ensureDefaultJobRolesForOrganisation()` chokepoint wired into `createOrganisationRepository.create()`.
- **DEVOS-300** — `project_member_job_roles` table (migration `0052`), the per-project active subset, composite-FK-constrained to `principal_job_roles` (`ON DELETE CASCADE` — revoking a job role at organisation scope also deactivates it everywhere it was active); `ProjectMemberJobRole`/`ProjectMemberJobRoleRepository` in the same domain file; `packages/database/src/repositories/project-member-job-roles.ts` implements it.
- **DEVOS-301** — `packages/application/src/job-roles/` (six use cases: list catalogue, list a principal's held roles, assign/remove at organisation scope, assign/remove the per-project subset, plus a `getProjectJobRolesOverview` aggregate for the UI); seven new routes in `apps/api/src/routes/job-roles.ts`; six new client wrappers in `apps/web/src/api-client.ts`; a real Job Roles UI on `ProjectDetailPage.tsx`'s existing Members panel (see design-choice note above).
- **DEVOS-302** — Validation, documentation, and gap disclosure, including this sprint's own required real end-to-end proof.

## Out of scope

Work item assignment/hierarchy (Sprint 50, `WORK_ITEM_ASSIGNMENT`). Letting an organisation define its own job-role set beyond the seeded four (no route creates/renames/retires a `JobRole` — the domain model supports it, the API surface does not yet). A standalone organisation-wide job-role management page (see design-choice note above — a future sprint's call, not silently built here). Any change to the existing agent workflow-role dispatch key or to `packages/policy`'s ABAC engine — both confirmed unrelated, per the epic's own `AGENTS.md` §4/§3 boundaries.

## Task index

| ID        | Story                                                     | File           |
| --------- | ---------------------------------------------------------- | -------------- |
| DEVOS-299 | `JOB_ROLE`/`PRINCIPAL_JOB_ROLE` tables, seeded catalogue    | `DEVOS-299.md` |
| DEVOS-300 | `PROJECT_MEMBER_JOB_ROLE` (per-project subset)              | `DEVOS-300.md` |
| DEVOS-301 | UI: assign job roles to a principal; per-project subset picker | `DEVOS-301.md` |
| DEVOS-302 | Validation, documentation, and gap disclosure               | `DEVOS-302.md` |
