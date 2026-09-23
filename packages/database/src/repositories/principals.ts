import type { Principal, PrincipalRepository, PrincipalType } from '@devos/domain';
import type { PrincipalsTable } from '../database.js';
import type { QueryExecutor } from './base.js';

function toDomain(row: PrincipalsTable): Principal {
  return {
    id: row.id,
    principalType: row.principal_type as PrincipalType,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createPrincipalRepository(db: QueryExecutor): PrincipalRepository {
  return {
    async getById(id) {
      const row = await db
        .selectFrom('principals')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst();
      return row ? toDomain(row) : null;
    },

    async create(principal) {
      await db
        .insertInto('principals')
        .values({
          id: principal.id,
          principal_type: principal.principalType,
          created_at: principal.createdAt,
          updated_at: principal.updatedAt,
        })
        .onConflict((oc) => oc.column('id').doNothing())
        .execute();
    },
  };
}
