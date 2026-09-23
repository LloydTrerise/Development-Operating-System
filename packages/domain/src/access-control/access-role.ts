/**
 * DEVOS-288 (Sprint 47, `specs/DEVOS-ACCESS-CONTROL-MODEL-BACKLOG.md` §6.2):
 * the real `ACCESS_ROLE`/`PERMISSION`/`ROLE_PERMISSION` catalogue backing
 * `packages/domain/src/projects/authorization.ts`'s catalogue-driven
 * `canX()` functions (DEVOS-289) — a real, queryable source of truth for
 * "what can this role do," not a second, parallel hardcoded copy.
 *
 * `scopeType` distinguishes the two roles seeded by this sprint's own
 * migration (`PROJECT`: `OWNER`/`MEMBER`, reproducing today's grants exactly)
 * from `ORGANISATION_ADMIN` (DEVOS-290, migration `0048`) — a Division tier
 * was explicitly resolved as unnecessary (backlog §9.2), so these two values
 * are the full set this epic ever introduces.
 */
export const accessRoleScopeTypes = ['PROJECT', 'ORGANISATION'] as const;
export type AccessRoleScopeType = (typeof accessRoleScopeTypes)[number];

export interface AccessRole {
  id: string;
  scopeType: AccessRoleScopeType;
  key: string;
  name: string;
  createdAt: string;
}

export interface Permission {
  id: string;
  key: string;
  name: string;
  createdAt: string;
}

export interface RolePermission {
  accessRoleId: string;
  permissionId: string;
}

export interface AccessControlRepository {
  listAccessRoles: () => Promise<AccessRole[]>;
  listPermissions: () => Promise<Permission[]>;
  listRolePermissions: () => Promise<RolePermission[]>;
}
