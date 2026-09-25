import type {
  OrganisationId,
  OrganisationLlmProviderId,
  OrganisationLlmProviderStatus,
} from '@devos/contracts';
import type { OrganisationLlmProvider, OrganisationLlmProviderRepository } from '@devos/domain';
import type { OrganisationLlmProvidersTable } from '../database.js';
import type { QueryExecutor } from './base.js';

function toDomain(row: OrganisationLlmProvidersTable): OrganisationLlmProvider {
  return {
    id: row.id as OrganisationLlmProviderId,
    organisationId: row.organisation_id as OrganisationId,
    provider: row.provider,
    credentialReference: row.credential_reference,
    priority: row.priority,
    status: row.status as OrganisationLlmProviderStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createOrganisationLlmProviderRepository(
  db: QueryExecutor,
): OrganisationLlmProviderRepository {
  return {
    async getById(id) {
      const row = await db
        .selectFrom('organisation_llm_providers')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst();
      return row ? toDomain(row) : null;
    },

    async listForOrganisation(organisationId) {
      const rows = await db
        .selectFrom('organisation_llm_providers')
        .selectAll()
        .where('organisation_id', '=', organisationId)
        .orderBy('priority', 'asc')
        .execute();
      return rows.map(toDomain);
    },

    async create(provider) {
      await db
        .insertInto('organisation_llm_providers')
        .values({
          id: provider.id,
          organisation_id: provider.organisationId,
          provider: provider.provider,
          credential_reference: provider.credentialReference,
          priority: provider.priority,
          status: provider.status,
          created_at: provider.createdAt,
          updated_at: provider.updatedAt,
        })
        .execute();
    },
  };
}
