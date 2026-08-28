import type { ProjectTypeId } from '@devos/contracts';
import type { ProjectType, ProjectTypeRepository } from '@devos/domain';
import type { ProjectTypesTable } from '../database.js';
import type { QueryExecutor } from './base.js';

function toDomain(row: ProjectTypesTable): ProjectType {
  return {
    id: row.id as ProjectTypeId,
    key: row.key,
    name: row.name,
    ...(row.description !== null ? { description: row.description } : {}),
    status: row.status as ProjectType['status'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createProjectTypeRepository(db: QueryExecutor): ProjectTypeRepository {
  return {
    async getById(id) {
      const row = await db
        .selectFrom('project_types')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst();
      return row ? toDomain(row) : null;
    },

    async getByKey(key) {
      const row = await db
        .selectFrom('project_types')
        .selectAll()
        .where('key', '=', key)
        .executeTakeFirst();
      return row ? toDomain(row) : null;
    },

    async list() {
      const rows = await db.selectFrom('project_types').selectAll().execute();
      return rows.map(toDomain);
    },

    async create(projectType) {
      await db
        .insertInto('project_types')
        .values({
          id: projectType.id,
          key: projectType.key,
          name: projectType.name,
          description: projectType.description ?? null,
          status: projectType.status,
          created_at: projectType.createdAt,
          updated_at: projectType.updatedAt,
        })
        .execute();
    },

    async update(id, changes, updatedAt) {
      await db
        .updateTable('project_types')
        .set({
          ...(changes.name !== undefined ? { name: changes.name } : {}),
          ...(changes.description !== undefined ? { description: changes.description } : {}),
          ...(changes.status !== undefined ? { status: changes.status } : {}),
          updated_at: updatedAt,
        })
        .where('id', '=', id)
        .execute();
    },
  };
}
