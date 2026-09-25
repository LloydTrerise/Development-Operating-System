# DEVOS-300 — `PROJECT_MEMBER_JOB_ROLE` (per-project subset)

**Priority:** P1
**Depends on:** DEVOS-299 (`job_roles`/`principal_job_roles`).
**Depended on by:** DEVOS-301 (UI/routes).

## Scope

The per-project *active* subset of job roles a principal already holds at organisation scope — FK-constrained to only job roles the principal already holds, matching the source document's rule exactly (a Dev+BA can act only as Dev on a project that only assigned them the Dev job role).

## Implementation

Migration `0052_project_member_job_roles.ts` creates `project_member_job_roles` (`project_id` uuid FK→`projects.id`; `principal_id`/`job_role_id` text; `created_at`), primary key `(project_id, principal_id, job_role_id)`, with a composite foreign key `(principal_id, job_role_id)` REFERENCES `principal_job_roles(principal_id, job_role_id)` — the real, database-enforced form of the source document's rule, `ON DELETE CASCADE` (revoking a job role at organisation scope also deactivates it from every project it was active on, the correct real-world semantics).

No FK ties `project_id`'s organisation to `job_role_id`'s organisation directly (Postgres cannot express a three-table conditional FK) — `packages/application/src/job-roles/assign-project-member-job-role.ts` checks that the project's `organisationId` matches the job role's `organisationId` before inserting, the same class of application-layer cross-check this codebase already relies on elsewhere (e.g. `addMember` rejecting `ORGANISATION_ADMIN` at project scope).

`ProjectMemberJobRole`/`ProjectMemberJobRoleRepository` are defined in the same `packages/domain/src/job-roles/job-role.ts` file as DEVOS-299's types. `packages/database/src/repositories/project-member-job-roles.ts` implements the repository.

## Out of scope

Routes/UI (DEVOS-301).

## Acceptance

`pnpm --filter @devos/domain build`; `pnpm --filter @devos/database typecheck build` clean. Attempting to activate a job role a principal does not hold at organisation scope is rejected — both at the application layer (`assignProjectMemberJobRole` throws a `ValidationError`, confirmed by `packages/application/tests/job-roles.test.ts`) and, if that pre-check were ever bypassed, at the database layer by the composite FK itself.

## Actual results

Implemented as planned. `pnpm --filter @devos/domain build` and `pnpm --filter @devos/database typecheck build` both clean. `packages/application/tests/job-roles.test.ts` includes a real test ("activates a project subset only for job roles the principal already holds") proving the rejection path, plus a real test ("removes a held job role and cascades it out of every project it was active on") proving the `ON DELETE CASCADE` semantics via an in-memory fake that mirrors the real FK's cascade behavior. Live verification against real Postgres (confirming the real FK itself rejects an ungated insert, not just the application-layer pre-check) is recorded in `DEVOS-302.md`.
