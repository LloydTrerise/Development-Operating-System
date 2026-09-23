# DEVOS-288 — `ACCESS_ROLE`/`PERMISSION`/`ROLE_PERMISSION` tables, seeded

**Priority:** P1
**Depends on:** Sprint 46 (real `PRINCIPAL` rows).
**Depended on by:** DEVOS-289 (catalogue-driven `canX()`), DEVOS-290 (`ORGANISATION_ADMIN` role).

## Scope

New tables seeded with exactly today's `OWNER`/`MEMBER` as two `PROJECT`-scope access roles, and a permission set that reproduces every existing `canX()` function's current grant exactly.

## Implementation

Migration `0047_access_roles.ts` creates three tables (`access_roles`: `id`/`scope_type`/`key`/`name`/`created_at`; `permissions`: `id`/`key`/`name`/`created_at`; `role_permissions`: `access_role_id`/`permission_id` composite PK) and seeds them inline (in the migration itself, not `packages/database/src/seed.ts`, since this is baseline reference data every environment needs, not optional demo data):

- Two access roles: `PROJECT:OWNER` and `PROJECT:MEMBER` (`scope_type: 'PROJECT'`).
- Nine permissions, one per existing `canX()` function: `project.manage_members`, `project.update`, `organisation.update`, `approval.decide`, `policy.publish`, `integration.register`, `agent.publish`, `workflow.publish`, `tool_capability.manage`.
- All nine granted to `PROJECT:OWNER`; none to `PROJECT:MEMBER`.

`packages/domain/src/access-control/access-role.ts` defines the domain types (`AccessRole`, `Permission`, `RolePermission`, `AccessControlRepository`) and `AccessRoleScopeType = 'PROJECT' | 'ORGANISATION'` (the `'ORGANISATION'` value is unused until DEVOS-290, included now so the column/type doesn't need a second migration). `packages/database/src/repositories/access-control.ts` implements the repository against the three real tables.

## Out of scope

Wiring the catalogue into `authorization.ts` (DEVOS-289's own job — this task only builds and seeds the tables).

## Acceptance

`pnpm --filter @devos/database typecheck build` clean. Real Postgres confirms the seed: 3 access roles, 9 permissions, `PROJECT:OWNER` granted all 9, `PROJECT:MEMBER` granted 0.

## Actual results

Implemented as planned. Live-verified against real Postgres after running the migration:

```
id                                | scope_type | key    | name
PROJECT:MEMBER                    | PROJECT    | MEMBER | Project Member
PROJECT:OWNER                     | PROJECT    | OWNER  | Project Owner

permissions: count = 9
role_permissions grouped by access_role_id: PROJECT:OWNER = 9
```

(The `ORGANISATION:ORGANISATION_ADMIN` row shown in later queries is added by DEVOS-290's own migration `0048`, not this one.) `pnpm --filter @devos/database typecheck build` clean; `pnpm turbo run typecheck lint test build` (see DEVOS-294) confirms zero regression across the monorepo.
