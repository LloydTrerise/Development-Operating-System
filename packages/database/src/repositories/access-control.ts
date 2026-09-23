import type {
  AccessControlRepository,
  AccessRole,
  AccessRoleScopeType,
  Permission,
  RolePermission,
} from '@devos/domain';
import type { AccessRolesTable, PermissionsTable, RolePermissionsTable } from '../database.js';
import type { QueryExecutor } from './base.js';

function accessRoleToDomain(row: AccessRolesTable): AccessRole {
  return {
    id: row.id,
    scopeType: row.scope_type as AccessRoleScopeType,
    key: row.key,
    name: row.name,
    createdAt: row.created_at,
  };
}

function permissionToDomain(row: PermissionsTable): Permission {
  return { id: row.id, key: row.key, name: row.name, createdAt: row.created_at };
}

function rolePermissionToDomain(row: RolePermissionsTable): RolePermission {
  return { accessRoleId: row.access_role_id, permissionId: row.permission_id };
}

/** DEVOS-288: the real ACCESS_ROLE/PERMISSION/ROLE_PERMISSION catalogue —
 * `packages/application/src/access-control/load-access-control-catalogue.ts`
 * is its one real consumer, loading it into
 * `packages/domain/src/access-control/permission-catalogue.ts`'s in-memory
 * cache at application boot. */
export function createAccessControlRepository(db: QueryExecutor): AccessControlRepository {
  return {
    async listAccessRoles() {
      const rows = await db.selectFrom('access_roles').selectAll().execute();
      return rows.map(accessRoleToDomain);
    },
    async listPermissions() {
      const rows = await db.selectFrom('permissions').selectAll().execute();
      return rows.map(permissionToDomain);
    },
    async listRolePermissions() {
      const rows = await db.selectFrom('role_permissions').selectAll().execute();
      return rows.map(rolePermissionToDomain);
    },
  };
}
