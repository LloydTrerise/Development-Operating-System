import type { OrganisationId } from '@devos/contracts';
import type { Organisation, OrganisationRepository } from '@devos/domain';
import type { OrganisationsTable } from '../database.js';
import type { QueryExecutor } from './base.js';

function toDomain(row: OrganisationsTable): Organisation {
  return {
    id: row.id as OrganisationId,
    name: row.name,
    slug: row.slug,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createOrganisationRepository(db: QueryExecutor): OrganisationRepository {
  return {
    async getById(id) {
      const row = await db
        .selectFrom('organisations')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst();
      return row ? toDomain(row) : null;
    },
  };
}
