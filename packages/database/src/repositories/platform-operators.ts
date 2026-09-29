import type { PlatformOperator, PlatformOperatorRepository } from '@devos/domain';
import type { PlatformOperatorsTable } from '../database.js';
import type { QueryExecutor } from './base.js';

function toDomain(row: PlatformOperatorsTable): PlatformOperator {
  return {
    principalId: row.principal_id,
    grantedAt: row.granted_at,
    ...(row.granted_by_principal_id !== null
      ? { grantedByPrincipalId: row.granted_by_principal_id }
      : {}),
  };
}

export function createPlatformOperatorRepository(db: QueryExecutor): PlatformOperatorRepository {
  return {
    async getByPrincipalId(principalId) {
      const row = await db
        .selectFrom('platform_operators')
        .selectAll()
        .where('principal_id', '=', principalId)
        .executeTakeFirst();
      return row ? toDomain(row) : null;
    },

    async list() {
      const rows = await db.selectFrom('platform_operators').selectAll().execute();
      return rows.map(toDomain);
    },

    async count() {
      const result = await db
        .selectFrom('platform_operators')
        .select((eb) => eb.fn.countAll<string>().as('count'))
        .executeTakeFirst();
      return result ? Number(result.count) : 0;
    },

    async create(platformOperator) {
      await db
        .insertInto('platform_operators')
        .values({
          principal_id: platformOperator.principalId,
          granted_at: platformOperator.grantedAt,
          granted_by_principal_id: platformOperator.grantedByPrincipalId ?? null,
        })
        .execute();
    },

    async delete(principalId) {
      await db.deleteFrom('platform_operators').where('principal_id', '=', principalId).execute();
    },
  };
}
