import type { OrganisationId } from '@devos/contracts';
import type { JobRole, JobRoleRepository } from '@devos/domain';
import { defaultJobRoleKeys } from '@devos/domain';
import type { JobRolesTable } from '../database.js';
import type { QueryExecutor } from './base.js';

const DEFAULT_JOB_ROLE_NAMES: Record<(typeof defaultJobRoleKeys)[number], string> = {
  PO: 'Product Owner',
  BA: 'Business Analyst',
  DEV: 'Developer',
  QA: 'Quality Assurance',
};

function toDomain(row: JobRolesTable): JobRole {
  return {
    id: row.id,
    organisationId: row.organisation_id as OrganisationId,
    key: row.key,
    name: row.name,
    createdAt: row.created_at,
  };
}

export function createJobRoleRepository(db: QueryExecutor): JobRoleRepository {
  return {
    async listForOrganisation(organisationId) {
      const rows = await db
        .selectFrom('job_roles')
        .selectAll()
        .where('organisation_id', '=', organisationId)
        .execute();
      return rows.map(toDomain);
    },

    async getById(id) {
      const row = await db
        .selectFrom('job_roles')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst();
      return row ? toDomain(row) : null;
    },

    async create(jobRole) {
      await db
        .insertInto('job_roles')
        .values({
          id: jobRole.id,
          organisation_id: jobRole.organisationId,
          key: jobRole.key,
          name: jobRole.name,
          created_at: jobRole.createdAt,
        })
        .onConflict((oc) => oc.column('id').doNothing())
        .execute();
    },
  };
}

/**
 * DEVOS-299: the real, ongoing counterpart to migration `0051`'s one-time
 * per-organisation backfill — wired into `createOrganisationRepository.
 * create()`, the one real chokepoint every organisation-creation path
 * shares (mirrors `ensureAgentPrincipal`'s identical "backfill at migration
 * time, chokepoint going forward" shape from DEVOS-295/296). `id` reuses the
 * same `${organisationId}:${key}` deterministic scheme the migration seeds,
 * so a real race between two concurrent organisation creations can never
 * produce duplicate rows — `onConflict().doNothing()` in `create()` above
 * absorbs it.
 */
export async function ensureDefaultJobRolesForOrganisation(
  db: QueryExecutor,
  organisationId: OrganisationId,
): Promise<void> {
  const now = new Date().toISOString();
  const repository = createJobRoleRepository(db);

  for (const key of defaultJobRoleKeys) {
    await repository.create({
      id: `${organisationId}:${key}`,
      organisationId,
      key,
      name: DEFAULT_JOB_ROLE_NAMES[key],
      createdAt: now,
    });
  }
}
