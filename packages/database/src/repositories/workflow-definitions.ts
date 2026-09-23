import type { ProjectId, WorkflowId } from '@devos/contracts';
import type { WorkflowDefinition, WorkflowDefinitionRepository } from '@devos/domain';
import { sql } from 'kysely';
import type { WorkflowDefinitionsTable } from '../database.js';
import type { QueryExecutor } from './base.js';

function toDomain(row: WorkflowDefinitionsTable): WorkflowDefinition {
  return {
    id: row.id as WorkflowId,
    projectId: row.project_id as ProjectId,
    key: row.key,
    name: row.name,
    ...(row.description !== null ? { description: row.description } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createWorkflowDefinitionRepository(
  db: QueryExecutor,
): WorkflowDefinitionRepository {
  return {
    async getById(id) {
      const row = await db
        .selectFrom('workflow_definitions')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst();
      return row ? toDomain(row) : null;
    },

    async getByProjectAndKey(projectId, key) {
      const row = await db
        .selectFrom('workflow_definitions')
        .selectAll()
        .where('project_id', '=', projectId)
        .where('key', '=', key)
        .executeTakeFirst();
      return row ? toDomain(row) : null;
    },

    async listForProject(projectId) {
      const rows = await db
        .selectFrom('workflow_definitions')
        .selectAll()
        .where('project_id', '=', projectId)
        .execute();
      return rows.map(toDomain);
    },

    // Sprint 41 gap closure: a real join against `projects` — one query
    // for every definition in the organisation, replacing the N per-project
    // calls `WorkflowLibraryPage.tsx` used to make.
    async listForOrganisation(organisationId) {
      const rows = await db
        .selectFrom('workflow_definitions')
        .innerJoin('projects', 'projects.id', 'workflow_definitions.project_id')
        .where('projects.organisation_id', '=', organisationId)
        .selectAll('workflow_definitions')
        .execute();
      return rows.map(toDomain);
    },

    async create(definition) {
      await db
        .insertInto('workflow_definitions')
        .values({
          id: definition.id,
          project_id: definition.projectId,
          key: definition.key,
          name: definition.name,
          description: definition.description ?? null,
          created_at: definition.createdAt,
          updated_at: definition.updatedAt,
        })
        .execute();
    },

    // DEVOS-261: real Postgres full-text search over `name`/`description`,
    // mirroring `KnowledgeSourceRepository.searchForProject`'s (DEVOS-187)
    // exact pattern. `description` is nullable, so `coalesce()` is needed
    // (unlike `work_items.description`).
    async searchForProject(projectId, query) {
      const rows = await db
        .selectFrom('workflow_definitions')
        .selectAll()
        .where('project_id', '=', projectId)
        .where(
          sql<boolean>`to_tsvector('english', name || ' ' || coalesce(description, '')) @@ plainto_tsquery('english', ${query})`,
        )
        .orderBy(
          sql`ts_rank(to_tsvector('english', name || ' ' || coalesce(description, '')), plainto_tsquery('english', ${query}))`,
          'desc',
        )
        .limit(50)
        .execute();
      return rows.map(toDomain);
    },
  };
}
