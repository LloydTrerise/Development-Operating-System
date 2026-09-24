import type { AgentId } from '@devos/contracts';
import type { Agent, AgentProfile, AgentProfileRepository } from '@devos/domain';
import type { AgentProfilesTable } from '../database.js';
import type { QueryExecutor } from './base.js';
import { createPrincipalRepository } from './principals.js';

function toDomain(row: AgentProfilesTable): AgentProfile {
  return {
    agentId: row.agent_id as AgentId,
    principalId: row.principal_id,
    ...(row.accountable_owner_id !== null ? { accountableOwnerId: row.accountable_owner_id } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createAgentProfileRepository(db: QueryExecutor): AgentProfileRepository {
  return {
    async getByAgentId(agentId) {
      const row = await db
        .selectFrom('agent_profiles')
        .selectAll()
        .where('agent_id', '=', agentId)
        .executeTakeFirst();
      return row ? toDomain(row) : null;
    },

    async create(profile) {
      await db
        .insertInto('agent_profiles')
        .values({
          agent_id: profile.agentId,
          principal_id: profile.principalId,
          accountable_owner_id: profile.accountableOwnerId ?? null,
          created_at: profile.createdAt,
          updated_at: profile.updatedAt,
        })
        .onConflict((oc) => oc.column('agent_id').doNothing())
        .execute();
    },
  };
}

/**
 * DEVOS-295/DEVOS-296: the real, ongoing counterpart to migration `0050`'s
 * one-time backfill — called from every real agent-creation chokepoint
 * (`create-agent-draft.ts`, `create-project-with-clones.ts`; both already
 * have the new `Agent` and its first `AgentVersion.createdBy` in hand, the
 * same "one true chokepoint" reasoning DEVOS-286 already applied to
 * `createMembershipRepository.create()`) so a newly created agent gets a
 * real `PRINCIPAL`/`AGENT_PROFILE` row the moment it exists, not only ones
 * that already existed at migration time. `createdBy` becomes
 * `accountableOwnerId` only when it actually resolves to a real,
 * already-backfilled `HUMAN` principal — left absent, not fabricated,
 * otherwise (mirrors migration `0050`'s own backfill resolution rule
 * exactly).
 */
export async function ensureAgentPrincipal(
  db: QueryExecutor,
  agent: Agent,
  createdBy: string,
): Promise<void> {
  const now = new Date().toISOString();
  const principals = createPrincipalRepository(db);

  await principals.create({
    id: agent.id,
    principalType: 'AGENT',
    createdAt: now,
    updatedAt: now,
  });

  const creator = await principals.getById(createdBy);

  await createAgentProfileRepository(db).create({
    agentId: agent.id,
    principalId: agent.id,
    ...(creator?.principalType === 'HUMAN' ? { accountableOwnerId: createdBy } : {}),
    createdAt: now,
    updatedAt: now,
  });
}
