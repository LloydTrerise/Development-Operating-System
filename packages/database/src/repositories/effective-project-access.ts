import type { ProjectId } from '@devos/contracts';
import type { ListEffectiveProjectIdsForPrincipal } from '@devos/domain';
import type { QueryExecutor } from './base.js';

/** DEVOS-292: queries the real `effective_project_access` view (migration
 * `0049`) — `packages/application/src/projects/list-projects-for-principal.ts`
 * is its first real consumer. */
export function createEffectiveProjectIdsForPrincipalLister(
  db: QueryExecutor,
): ListEffectiveProjectIdsForPrincipal {
  return async (principalId) => {
    const rows = await db
      .selectFrom('effective_project_access')
      .select('project_id')
      .where('principal_id', '=', principalId)
      .execute();
    return rows.map((row) => row.project_id as ProjectId);
  };
}
