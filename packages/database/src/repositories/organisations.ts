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

    async list() {
      const rows = await db.selectFrom('organisations').selectAll().execute();
      return rows.map(toDomain);
    },

    async create(organisation) {
      await db
        .insertInto('organisations')
        .values({
          id: organisation.id,
          name: organisation.name,
          slug: organisation.slug,
          status: organisation.status,
          created_at: organisation.createdAt,
          updated_at: organisation.updatedAt,
        })
        .execute();
    },

    async update(id, changes, updatedAt) {
      await db
        .updateTable('organisations')
        .set({
          ...(changes.name !== undefined ? { name: changes.name } : {}),
          ...(changes.status !== undefined ? { status: changes.status } : {}),
          updated_at: updatedAt,
        })
        .where('id', '=', id)
        .execute();
    },
  };
}
