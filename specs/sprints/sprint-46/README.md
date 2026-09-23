# Sprint 46 — Principal & Human Identity Foundation

**Source:** `specs/DEVOS-ACCESS-CONTROL-MODEL-BACKLOG.md` §5/§6.1 (candidate epic E29, Identity & Access Control Redesign).
**Conversion date:** 2026-09-23
**Status:** Converted and executed per explicit user authorization ("Proceed with sprint. Run through sprint fully without waiting for authorisation after each task. Stop once sprint is done", 2026-09-23), in direct response to a position report confirming the backlog's decisions were resolved but conversion/implementation still required separate authorization per `AGENTS.md` §35/§4.2.

## Goal

Give every human actor id this codebase already writes as a bare `text` string (`memberships.principal_id`, `audit_records.actor_id`) a real, durable `PRINCIPAL`+`HUMAN_PROFILE` row to resolve through, and start recording real login identities (`USER_IDENTITY`) from the existing generic OIDC provider — with **zero visible behavior change** to any existing route, use case, or test. This is the hard prerequisite every later sprint in this epic (47–51) depends on.

## Grounding (confirmed by direct code inspection and live Postgres verification at conversion/implementation time)

- `memberships.principal_id`/`audit_records.actor_id` are unconstrained `text` columns — no `PRINCIPAL` table has ever existed. `packages/domain/src/projects/membership.ts:10`, `packages/domain/src/audit/audit-record.ts:11`.
- `resolveMembership()` (`packages/application/src/projects/membership-access.ts`) is the single, real chokepoint: called from 66 files across `packages/application/src` — every project-scoped authorization check in this codebase already funnels through it.
- Only three real call sites ever mint a *new* `membership.principal_id`: `packages/application/src/projects/add-member.ts`, `packages/application/src/organisations/add-member.ts`, and `packages/application/src/organisations/create-organisation.ts` — all three create their `Membership` via `deps.memberships.create(...)`, and `create-project-with-clones.ts`'s own project-creation membership also goes through the same `createMembershipRepository(trx).create(...)` call. `packages/database/src/seed.ts` is the one exception: it inserts directly via raw `db.insertInto('memberships')`, bypassing the repository, per this codebase's own established seed-script convention.
- No email has ever been stored anywhere in this codebase's existing data — neither `memberships` nor `audit_records` has an email column — so DEVOS-284's own "keyed by email where resolvable" backfill genuinely resolves to `null` for every pre-existing row, disclosed rather than fabricated.
- `packages/identity/src/authentication/oidc-provider.ts`'s `createOidcAuthProvider` is already a real, generic OIDC/JWKS verifier; `apps/api/src/app.ts` selects it over `createLocalAuthProvider()` only when `AUTH_ISSUER_URL`/`AUTH_AUDIENCE` are both configured — true for zero existing tests, confirmed by grep.
- A real, live-verified finding (not assumed): `devos-agent-runtime`'s own `audit_records` rows are not consistently stamped `actor_type: 'SYSTEM'` — some carry `'USER'` instead, a pre-existing inconsistency in whatever callers write those records. DEVOS-284's backfill query originally only excluded `devos-agent-runtime` from its `memberships` branch, and the real migration run against this environment's own accumulated data proved the `audit_records` branch alone re-admitted it as a false "human." Found via direct Postgres inspection after the first migration run, fixed in the migration source, and the one incorrectly-created row corrected directly in the already-migrated database (see DEVOS-284's own "Actual results").

## In scope

- **DEVOS-284** — `PRINCIPAL`+`HUMAN_PROFILE` tables, migration `0045`, backfilling every distinct human actor id already referenced by `memberships`/`audit_records`.
- **DEVOS-285** — `USER_IDENTITY` table, migration `0046`, wired to the existing OIDC provider via a new best-effort, fire-and-forget hook in `apps/api/src/app.ts`, active only when a real OIDC provider is configured.
- **DEVOS-286** — `memberships.principal_id` resolves through real `PRINCIPAL` rows going forward: `createMembershipRepository.create()` now get-or-creates the backing `PRINCIPAL`+`HUMAN_PROFILE` row for every membership it writes, closing the gap DEVOS-284's own migration backfill only closed retroactively.
- **DEVOS-287** — Validation, documentation, and gap disclosure.

## Out of scope

Any change to `packages/domain/src/projects/authorization.ts`'s hardcoded `canX()` functions (Sprint 47's own job). Any Division/tenant-tier concept (resolved as unnecessary in the backlog's own §9.2). Any agent identity (`AGENT_PROFILE`, Sprint 48). Any job-role catalogue (Sprint 49). Any work-item assignment (Sprint 50). Any SSO admin console or per-provider branding (the backlog's own §4 exclusion).

## Task index

| ID        | Story                                                  | File           |
| --------- | ------------------------------------------------------- | -------------- |
| DEVOS-284 | `PRINCIPAL`+`HUMAN_PROFILE` tables, human backfill       | `DEVOS-284.md` |
| DEVOS-285 | `USER_IDENTITY` wired to the existing OIDC provider      | `DEVOS-285.md` |
| DEVOS-286 | `memberships.principal_id` resolves through real `PRINCIPAL` rows | `DEVOS-286.md` |
| DEVOS-287 | Validation, documentation, and gap disclosure            | `DEVOS-287.md` |
