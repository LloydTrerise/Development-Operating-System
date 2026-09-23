import type { HumanProfile, HumanProfileRepository } from '@devos/domain';
import type { HumanProfilesTable } from '../database.js';
import type { QueryExecutor } from './base.js';

function toDomain(row: HumanProfilesTable): HumanProfile {
  return {
    principalId: row.principal_id,
    ...(row.email !== null ? { email: row.email } : {}),
    ...(row.display_name !== null ? { displayName: row.display_name } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createHumanProfileRepository(db: QueryExecutor): HumanProfileRepository {
  return {
    async getByPrincipalId(principalId) {
      const row = await db
        .selectFrom('human_profiles')
        .selectAll()
        .where('principal_id', '=', principalId)
        .executeTakeFirst();
      return row ? toDomain(row) : null;
    },

    async create(profile) {
      await db
        .insertInto('human_profiles')
        .values({
          principal_id: profile.principalId,
          email: profile.email ?? null,
          display_name: profile.displayName ?? null,
          created_at: profile.createdAt,
          updated_at: profile.updatedAt,
        })
        .onConflict((oc) => oc.column('principal_id').doNothing())
        .execute();
    },
  };
}
