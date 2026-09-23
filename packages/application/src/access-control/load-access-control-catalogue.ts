import {
  configureAccessRoleCatalogue,
  type AccessControlRepository,
  type AccessRoleCatalogue,
  type MembershipRole,
  type ProjectPermissionKey,
} from '@devos/domain';

export interface LoadAccessControlCatalogueDeps {
  accessControl: AccessControlRepository;
}

/**
 * DEVOS-289 (Sprint 47): loads the real `ACCESS_ROLE`/`PERMISSION`/
 * `ROLE_PERMISSION` rows and swaps them into
 * `packages/domain/src/access-control/permission-catalogue.ts`'s in-memory
 * cache — wired as a fire-and-forget call at `apps/api/src/app.ts` boot
 * (mirrors DEVOS-285's own `ensureUserIdentityForLogin` fire-and-forget
 * precedent: safe because the cache's own hardcoded default already
 * matches these real seeded values exactly, so a slow or failed load never
 * changes observable behavior, only which of two identical sources served
 * it).
 */
export async function loadAccessControlCatalogueFromRepository(
  deps: LoadAccessControlCatalogueDeps,
): Promise<void> {
  const [accessRoles, permissions, rolePermissions] = await Promise.all([
    deps.accessControl.listAccessRoles(),
    deps.accessControl.listPermissions(),
    deps.accessControl.listRolePermissions(),
  ]);

  const permissionKeyById = new Map(
    permissions.map((permission) => [permission.id, permission.key]),
  );
  const accessRoleById = new Map(accessRoles.map((accessRole) => [accessRole.id, accessRole]));

  const catalogue: Partial<Record<MembershipRole, Set<ProjectPermissionKey>>> = {};
  for (const accessRole of accessRoles) {
    catalogue[accessRole.key as MembershipRole] = new Set();
  }

  for (const rolePermission of rolePermissions) {
    const accessRole = accessRoleById.get(rolePermission.accessRoleId);
    const permissionKey = permissionKeyById.get(rolePermission.permissionId);
    if (accessRole === undefined || permissionKey === undefined) continue;

    catalogue[accessRole.key as MembershipRole]?.add(permissionKey as ProjectPermissionKey);
  }

  configureAccessRoleCatalogue(catalogue as AccessRoleCatalogue);
}
