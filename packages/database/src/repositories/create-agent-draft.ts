import type { Agent, AgentVersion } from '@devos/domain';
import type { Kysely } from 'kysely';
import type { Database } from '../database.js';
import { createAgentRepository } from './agents.js';
import { createAgentVersionRepository } from './agent-versions.js';
import { withTransaction } from './base.js';

export type CreateAgentDraft = (agent: Agent, version: AgentVersion) => Promise<void>;

export function createAgentDraftCreator(db: Kysely<Database>): CreateAgentDraft {
  return async (agent, version) => {
    await withTransaction(db, async (trx) => {
      await createAgentRepository(trx).create(agent);
      await createAgentVersionRepository(trx).create(version);
    });
  };
}
