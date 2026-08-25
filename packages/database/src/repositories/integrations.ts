import type { IntegrationId, IntegrationStatus, ProjectId } from '@devos/contracts';
import type { Integration, IntegrationRepository } from '@devos/domain';
import type { IntegrationsTable } from '../database.js';
import type { QueryExecutor } from './base.js';

interface StoredConfiguration {
  credentialReference: string;
  [key: string]: unknown;
}

function toDomain(row: IntegrationsTable): Integration {
  const { credentialReference, ...configuration } = row.configuration as StoredConfiguration;
  return {
    id: row.id as IntegrationId,
    projectId: row.project_id as ProjectId,
    type: row.type,
    provider: row.provider,
    name: row.name,
    status: row.status as IntegrationStatus,
    credentialReference,
    configuration,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createIntegrationRepository(db: QueryExecutor): IntegrationRepository {
  return {
    async getById(id) {
      const row = await db
        .selectFrom('integrations')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst();
      return row ? toDomain(row) : null;
    },

    async listForProject(projectId) {
      const rows = await db
        .selectFrom('integrations')
        .selectAll()
        .where('project_id', '=', projectId)
        .orderBy('name', 'asc')
        .execute();
      return rows.map(toDomain);
    },

    async create(integration) {
      const storedConfiguration: StoredConfiguration = {
        credentialReference: integration.credentialReference,
        ...integration.configuration,
      };
      await db
        .insertInto('integrations')
        .values({
          id: integration.id,
          project_id: integration.projectId,
          type: integration.type,
          provider: integration.provider,
          name: integration.name,
          status: integration.status,
          configuration: JSON.stringify(storedConfiguration),
          created_at: integration.createdAt,
          updated_at: integration.updatedAt,
        })
        .execute();
    },
  };
}
