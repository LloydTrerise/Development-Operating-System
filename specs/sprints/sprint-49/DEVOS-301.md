# DEVOS-301 — UI: assign job roles to a principal; per-project subset picker

**Priority:** P1
**Depends on:** DEVOS-299, DEVOS-300.
**Depended on by:** DEVOS-302 (validation).

## Scope

Real routes and a real UI for both halves of the job-role model: granting/revoking a job role at organisation scope, and activating/deactivating the per-project subset. Mirrors existing membership-management UI conventions (`ProjectDetailPage.tsx`'s Members panel, `OrganisationsPage.tsx`'s transfer-ownership/admin-add flows).

## Design choice: one UI anchor, not two (disclosed)

See `README.md`'s own "Design choice disclosed" section for the full reasoning: no org-wide "list every principal in this organisation" capability exists anywhere in this codebase, so both the organisation-wide grant/revoke action and the per-project subset toggle were built onto `ProjectDetailPage.tsx`'s existing Members panel, per member row, rather than a second, mostly-empty organisation-wide page.

## Implementation

**Application layer** (`packages/application/src/job-roles/`):

- `deps.ts` — `JobRoleUseCaseDeps` (carries both `organisations` and `projects`, since job roles span both scopes).
- `list-job-roles-for-organisation.ts` — the seeded catalogue; any principal with standing in the organisation can view it (mirrors `listOrganisationMembers`'s read gate via `resolveOrganisationMembership`).
- `list-principal-job-roles.ts` — a specific principal's held job roles, resolved against the catalogue.
- `assign-principal-job-role.ts` / `remove-principal-job-role.ts` — gated to `canManageMembers` at organisation scope (an `ORGANISATION_ADMIN`), matching `addOrganisationMember`'s own bar, since holding a job role is itself an access grant DEVOS-300 can later activate. `assign` validates the job role belongs to the target organisation.
- `assign-project-member-job-role.ts` / `remove-project-member-job-role.ts` — gated to `canManageMembers` at project scope (an `OWNER`, or an org admin via `resolveMembership`'s fallback). `assign` validates the job role belongs to the project's own organisation and that the target principal already holds it (a clean `ValidationError` ahead of the real database FK).
- `get-project-job-roles-overview.ts` — one aggregate call for the whole Members panel: the org catalogue, plus per-current-project-member held/active job-role ids. Deliberately a single aggregate rather than a per-member fetch — `ApprovalsPage.tsx`'s own long-disclosed, still-unfixed N+1 evidence-fetch loop (Sprint 35 DEVOS-238, carried unresolved across Sprints 39/43/44) is exactly the shape this avoids repeating for a brand-new feature. Uses `PrincipalJobRoleRepository`'s optional `listForPrincipals` batch method when wired (the real `apps/api` wiring), falling back to one call per member otherwise (every test fake that omits it).

**API layer**: `apps/api/src/dto/job-role.ts` (DTOs/body parsing); `apps/api/src/routes/job-roles.ts` — seven routes:

- `GET /organisations/:organisationId/job-roles` — catalogue.
- `GET`/`POST`/`DELETE /organisations/:organisationId/principals/:principalId/job-roles[/:jobRoleId]` — organisation-scope grant/revoke.
- `GET /projects/:projectId/job-roles` — the aggregate overview.
- `POST`/`DELETE /projects/:projectId/members/:principalId/job-roles[/:jobRoleId]` — per-project subset activate/deactivate.

Wired into `apps/api/src/app.ts` via a new `jobRoleDeps` (sharing `organisations`/`projects`/`memberships`/`auditRecords` instances with `organisationDeps`/`projectDeps`, mirroring `auditDeps.organisations`'s own established "separate instance, same real `database.db`" precedent).

**Web layer**: six new client wrappers in `apps/web/src/api-client.ts` (`listOrganisationJobRoles`, `assignPrincipalJobRole`, `removePrincipalJobRole`, `getProjectJobRolesOverview`, `assignProjectMemberJobRole`, `removeProjectMemberJobRole`). `ProjectDetailPage.tsx`'s Members panel gains, per member row: a chip per held job role (colored/filled when active on this project, outlined when held but inactive; clicking a chip toggles project activation; its `×` revokes the organisation-wide grant entirely) plus a "+ Grant job role" `Select` limited to the organisation's own catalogue minus what's already held.

## Out of scope

A standalone organisation-wide job-role management page (see design-choice note above). Letting an organisation define its own job-role set beyond the seeded four.

## Acceptance

`pnpm --filter @devos/application typecheck lint test build`; `pnpm --filter @devos/api typecheck lint test build`; `pnpm --filter @devos/web typecheck lint test build` all clean. New tests: `packages/application/tests/job-roles.test.ts` (8 cases covering every use case, including the ForbiddenError/ValidationError gates); a new `describe('job role routes (DEVOS-299/300/301)', ...)` block in `apps/api/tests/app.test.ts` exercising the full grant → activate → deactivate → revoke lifecycle through the real HTTP router; 6 new cases in `apps/web/tests/api-client.test.ts`.

## Actual results

Implemented as planned. All package-scoped gates green (`@devos/domain`, `@devos/database`, `@devos/application`, `@devos/api`, `@devos/web`). Full monorepo validation `pnpm turbo run typecheck lint test build --filter='!@devos/e2e-tests'` **76/76 green**, matching Sprint 48's own baseline exactly — see `DEVOS-302.md` for the full record and this sprint's own required real end-to-end proof.
