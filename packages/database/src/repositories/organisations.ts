import type { OrganisationId } from '@devos/contracts';
import type { Organisation, OrganisationRepository } from '@devos/domain';
import type { OrganisationsTable } from '../database.js';
import type { QueryExecutor } from './base.js';
import { ensureDefaultJobRolesForOrganisation } from './job-roles.js';

function toDomain(row: OrganisationsTable): Organisation {
  return {
    id: row.id as OrganisationId,
    name: row.name,
    slug: row.slug,
    status: row.status,
    ...(row.budget_usd !== null ? { budgetUsd: Number(row.budget_usd) } : {}),
    ...(row.owner_principal_id !== null ? { ownerPrincipalId: row.owner_principal_id } : {}),
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
          budget_usd: organisation.budgetUsd?.toString() ?? null,
          owner_principal_id: organisation.ownerPrincipalId ?? null,
          created_at: organisation.createdAt,
          updated_at: organisation.updatedAt,
        })
        .execute();

      // DEVOS-299: the real, ongoing counterpart to migration 0051's
      // one-time backfill — every organisation created through the
      // application layer going forward gets the same default job-role
      // catalogue (PO/BA/DEV/QA), the one true chokepoint every
      // organisation-creation path shares. `seed.ts` inserts organisations
      // directly (bypassing this repository, per its own established
      // convention), so it separately seeds the same invariant.
      await ensureDefaultJobRolesForOrganisation(db, organisation.id);
    },

    async update(id, changes, updatedAt) {
      await db
        .updateTable('organisations')
        .set({
          ...(changes.name !== undefined ? { name: changes.name } : {}),
          ...(changes.status !== undefined ? { status: changes.status } : {}),
          ...(changes.budgetUsd !== undefined ? { budget_usd: changes.budgetUsd.toString() } : {}),
          updated_at: updatedAt,
        })
        .where('id', '=', id)
        .execute();
    },

    async setOwnerPrincipalId(id, ownerPrincipalId, updatedAt) {
      await db
        .updateTable('organisations')
        .set({ owner_principal_id: ownerPrincipalId, updated_at: updatedAt })
        .where('id', '=', id)
        .execute();
    },
  };
}
