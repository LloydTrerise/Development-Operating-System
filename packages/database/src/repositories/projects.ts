import type { OrganisationId, ProjectId } from '@devos/contracts';
import type { Project, ProjectRepository } from '@devos/domain';
import type { ProjectsTable } from '../database.js';
import type { QueryExecutor } from './base.js';

function toDomain(row: ProjectsTable): Project {
  return {
    id: row.id as ProjectId,
    organisationId: row.organisation_id as OrganisationId,
    name: row.name,
    slug: row.slug,
    ...(row.description !== null ? { description: row.description } : {}),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createProjectRepository(db: QueryExecutor): ProjectRepository {
  return {
    async getById(id) {
      const row = await db
        .selectFrom('projects')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst();
      return row ? toDomain(row) : null;
    },

    async listForOrganisation(organisationId) {
      const rows = await db
        .selectFrom('projects')
        .selectAll()
        .where('organisation_id', '=', organisationId)
        .execute();
      return rows.map(toDomain);
    },

    async create(project) {
      await db
        .insertInto('projects')
        .values({
          id: project.id,
          organisation_id: project.organisationId,
          name: project.name,
          slug: project.slug,
          description: project.description ?? null,
          status: project.status,
          repository_id: null,
          created_at: project.createdAt,
          updated_at: project.updatedAt,
        })
        .execute();
    },

    async update(id, changes, updatedAt) {
      await db
        .updateTable('projects')
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
