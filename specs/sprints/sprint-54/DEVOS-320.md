# DEVOS-320 — Access-role gating

**Priority:** P1
**Depends on:** None new — reuses E29's existing access-role catalogue (Sprint 47/51).
**Depended on by:** DEVOS-321 (every write use case is gated by this decision).

## Scope

Managing an organisation's provider list is gated to `OWNER`/`ORGANISATION_ADMIN` only (backlog §9.4), reusing E29's existing organisation-admin write gate if it fits directly; a new narrow permission only if it doesn't, decided and disclosed during implementation.

## Design decision (disclosed, not a new permission)

`resolveOrganisationAdminMembership` (org-level-only, no project-level fallback, Sprint 51/DEVOS-309) + `canUpdateOrganisation` (`organisation.update` permission, seeded to `OWNER`/`ORGANISATION_ADMIN` by migrations `0047`/`0048`) is reused directly, unchanged — the exact same pair `updateOrganisation.ts` already uses. Considered and rejected: reusing `canManageMembers` (`project.manage_members`) instead, the pair Sprint 49's job-role grant/revoke use cases use — rejected because that permission's own precedent is specifically for _granting standing to a principal_ (adding a member, assigning a held job role), whereas configuring an organisation's LLM provider list is an org-_settings_ change with no principal-targeting shape at all, the same category `updateOrganisation` (rename, budget, status) already occupies. No new migration, no new permission key, no new seed row — `canUpdateOrganisation` already grants exactly `OWNER`/`ORGANISATION_ADMIN` today.

Every write use case in DEVOS-321 (create/update/delete/reorder an organisation's LLM providers) calls `resolveOrganisationAdminMembership` + `canUpdateOrganisation` in that order, identically to `updateOrganisation.ts`'s own three lines. The read use case (list) uses the broader `resolveOrganisationMembership` (any standing in the organisation, direct or via a project within it) — mirroring `listJobRolesForOrganisation`'s own identical read-access precedent — since `credentialReference` is a reference name, not a secret (confirmed by this sprint's README grounding), and every other org-wide-visibility read in this codebase (cost/audit/engineering reports, job-role catalogue, policy/workflow listing) already uses this same broader gate.

## Out of scope

Any new `PERMISSION`/`ROLE_PERMISSION` row. Any change to `hasProjectPermission`'s catalogue.

## Acceptance

Covered by DEVOS-321's own use-case tests (a `MEMBER`/non-admin request to any write route is rejected with `ForbiddenError`; a request from a principal with no standing in the organisation at all is rejected with `NotFoundError`, matching every other organisation-admin-gated use case's own existing behavior) and DEVOS-322's live verification against real Postgres.

## Actual results

Implemented as planned, folded directly into DEVOS-321's use cases (no separate code path — this task's own output is the design decision itself, applied consistently across every write use case). See `DEVOS-321.md`/`DEVOS-322.md`.
