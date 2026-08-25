import type {
  ProjectId,
  ToolCapabilityId,
  ToolCapabilityRiskClass,
  ToolCapabilityStatus,
} from '@devos/contracts';
import type { ToolCapability, ToolCapabilityRepository } from '@devos/domain';
import type { ToolCapabilitiesTable } from '../database.js';
import type { QueryExecutor } from './base.js';

function toDomain(row: ToolCapabilitiesTable): ToolCapability {
  return {
    id: row.id as ToolCapabilityId,
    projectId: row.project_id as ProjectId,
    key: row.key,
    name: row.name,
    riskClass: row.risk_class as ToolCapabilityRiskClass,
    inputSchema: row.input_schema as Record<string, unknown>,
    outputSchema: row.output_schema as Record<string, unknown>,
    status: row.status as ToolCapabilityStatus,
    createdAt: row.created_at,
  };
}

export function createToolCapabilityRepository(db: QueryExecutor): ToolCapabilityRepository {
  return {
    async getById(id) {
      const row = await db
        .selectFrom('tool_capabilities')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst();
      return row ? toDomain(row) : null;
    },

    async getByProjectAndKey(projectId, key) {
      const row = await db
        .selectFrom('tool_capabilities')
        .selectAll()
        .where('project_id', '=', projectId)
        .where('key', '=', key)
        .executeTakeFirst();
      return row ? toDomain(row) : null;
    },

    async listForProject(projectId) {
      const rows = await db
        .selectFrom('tool_capabilities')
        .selectAll()
        .where('project_id', '=', projectId)
        .orderBy('key', 'asc')
        .execute();
      return rows.map(toDomain);
    },

    async create(capability) {
      await db
        .insertInto('tool_capabilities')
        .values({
          id: capability.id,
          project_id: capability.projectId,
          key: capability.key,
          name: capability.name,
          risk_class: capability.riskClass,
          input_schema: JSON.stringify(capability.inputSchema),
          output_schema: JSON.stringify(capability.outputSchema),
          status: capability.status,
          created_at: capability.createdAt,
        })
        .execute();
    },
  };
}
