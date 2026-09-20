import type {
  AgentConfiguration,
  AgentId,
  AgentVersionId,
  AgentVersionStatus,
  ProjectId,
} from '@devos/contracts';
import type { AgentVersion, AgentVersionRepository, SharedAgentVersion } from '@devos/domain';
import type { AgentVersionsTable } from '../database.js';
import type { QueryExecutor } from './base.js';

function toDomain(row: AgentVersionsTable): AgentVersion {
  return {
    id: row.id as AgentVersionId,
    agentId: row.agent_id as AgentId,
    version: row.version,
    status: row.status as AgentVersionStatus,
    configuration: row.configuration as AgentConfiguration,
    ...(row.prompt_reference !== null ? { promptReference: row.prompt_reference } : {}),
    createdBy: row.created_by,
    ...(row.published_at !== null ? { publishedAt: row.published_at } : {}),
    createdAt: row.created_at,
    sharedAcrossOrganisation: row.shared_across_organisation,
  };
}

export function createAgentVersionRepository(db: QueryExecutor): AgentVersionRepository {
  return {
    async getById(id) {
      const row = await db
        .selectFrom('agent_versions')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst();
      return row ? toDomain(row) : null;
    },

    async getByAgentAndVersion(agentId, version) {
      const row = await db
        .selectFrom('agent_versions')
        .selectAll()
        .where('agent_id', '=', agentId)
        .where('version', '=', version)
        .executeTakeFirst();
      return row ? toDomain(row) : null;
    },

    async getLatestForAgent(agentId) {
      const row = await db
        .selectFrom('agent_versions')
        .selectAll()
        .where('agent_id', '=', agentId)
        .orderBy('version', 'desc')
        .limit(1)
        .executeTakeFirst();
      return row ? toDomain(row) : null;
    },

    async listForAgent(agentId) {
      const rows = await db
        .selectFrom('agent_versions')
        .selectAll()
        .where('agent_id', '=', agentId)
        .orderBy('version', 'asc')
        .execute();
      return rows.map(toDomain);
    },

    async create(version) {
      await db
        .insertInto('agent_versions')
        .values({
          id: version.id,
          agent_id: version.agentId,
          version: version.version,
          status: version.status,
          configuration: JSON.stringify(version.configuration),
          prompt_reference: version.promptReference ?? null,
          created_by: version.createdBy,
          published_at: version.publishedAt ?? null,
          created_at: version.createdAt,
          shared_across_organisation: version.sharedAcrossOrganisation ?? false,
        })
        .execute();
    },

    async publish(id, publishedAt) {
      await db
        .updateTable('agent_versions')
        .set({ status: 'PUBLISHED', published_at: publishedAt })
        .where('id', '=', id)
        .execute();
    },

    async setSharedAcrossOrganisation(id, shared) {
      await db
        .updateTable('agent_versions')
        .set({ shared_across_organisation: shared })
        .where('id', '=', id)
        .execute();
    },

    // DEVOS-178: a real `agent_versions` ⋈ `agents` ⋈ `projects` join —
    // mirrors `sumEstimatedCostUsdForOrganisation`'s real-join, never-a-
    // client-loop precedent (DEVOS-150).
    async listSharedForOrganisation(organisationId): Promise<SharedAgentVersion[]> {
      const rows = await db
        .selectFrom('agent_versions')
        .innerJoin('agents', 'agents.id', 'agent_versions.agent_id')
        .innerJoin('projects', 'projects.id', 'agents.project_id')
        .where('agent_versions.shared_across_organisation', '=', true)
        .where('projects.organisation_id', '=', organisationId)
        .select([
          'agent_versions.id as id',
          'agent_versions.agent_id as agent_id',
          'agent_versions.version as version',
          'agent_versions.status as status',
          'agent_versions.configuration as configuration',
          'agent_versions.prompt_reference as prompt_reference',
          'agent_versions.created_by as created_by',
          'agent_versions.published_at as published_at',
          'agent_versions.created_at as created_at',
          'agent_versions.shared_across_organisation as shared_across_organisation',
          'agents.key as agent_key',
          'agents.name as agent_name',
          'agents.project_id as source_project_id',
        ])
        .execute();

      return rows.map((row) => ({
        ...toDomain(row),
        agentKey: row.agent_key,
        agentName: row.agent_name,
        sourceProjectId: row.source_project_id as ProjectId,
      }));
    },
  };
}
