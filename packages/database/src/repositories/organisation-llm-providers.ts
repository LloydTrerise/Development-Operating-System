import type {
  OrganisationId,
  OrganisationLlmProviderId,
  OrganisationLlmProviderStatus,
} from '@devos/contracts';
import type { OrganisationLlmProvider, OrganisationLlmProviderRepository } from '@devos/domain';
import type { Kysely } from 'kysely';
import type { Database, OrganisationLlmProvidersTable } from '../database.js';
import { withTransaction, type QueryExecutor } from './base.js';

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

    async update(id, changes, updatedAt) {
      await db
        .updateTable('organisation_llm_providers')
        .set({
          ...(changes.credentialReference !== undefined
            ? { credential_reference: changes.credentialReference }
            : {}),
          ...(changes.status !== undefined ? { status: changes.status } : {}),
          updated_at: updatedAt,
        })
        .where('id', '=', id)
        .execute();
    },

    async delete(id) {
      await db.deleteFrom('organisation_llm_providers').where('id', '=', id).execute();
    },
  };
}

/**
 * DEVOS-321 (Sprint 54): see `packages/domain/src/organisations/
 * organisation-llm-provider.ts`'s own doc comment for why this is a
 * standalone primitive, not a repository method. Takes the concrete
 * `Kysely<Database>` (not the narrower `QueryExecutor` union the plain CRUD
 * methods above accept) because it needs `.transaction()`, mirroring
 * `createWorkItemCloser`'s identical signature.
 */
export function createOrganisationLlmProviderReorderer(
  db: Kysely<Database>,
): (
  organisationId: OrganisationId,
  orderedIds: OrganisationLlmProviderId[],
  updatedAt: string,
) => Promise<void> {
  return async (organisationId, orderedIds, updatedAt) => {
    await withTransaction(db, async (trx) => {
      // Phase 1: bump every row to a unique negative priority — guaranteed
      // distinct from every real (positive) priority and from each other,
      // so the non-deferred `(organisation_id, priority)` unique constraint
      // never fires mid-reorder.
      for (const [index, id] of orderedIds.entries()) {
        await trx
          .updateTable('organisation_llm_providers')
          .set({ priority: -(index + 1), updated_at: updatedAt })
          .where('id', '=', id)
          .where('organisation_id', '=', organisationId)
          .execute();
      }
      // Phase 2: assign each row its final, positive priority in the
      // caller's given order.
      for (const [index, id] of orderedIds.entries()) {
        await trx
          .updateTable('organisation_llm_providers')
          .set({ priority: index + 1, updated_at: updatedAt })
          .where('id', '=', id)
          .where('organisation_id', '=', organisationId)
          .execute();
      }
    });
  };
}
