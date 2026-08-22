import type { AuditId, OrganisationId, ProjectId } from '@devos/contracts';
import type {
  AuditActorType,
  AuditOutcome,
  AuditRecord,
  AuditRecordRepository,
} from '@devos/domain';
import type { AuditRecordsTable } from '../database.js';
import type { QueryExecutor } from './base.js';

function toDomain(row: AuditRecordsTable): AuditRecord {
  return {
    id: row.id as AuditId,
    organisationId: row.organisation_id as OrganisationId,
    ...(row.project_id !== null ? { projectId: row.project_id as ProjectId } : {}),
    actorType: row.actor_type as AuditActorType,
    actorId: row.actor_id,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    outcome: row.outcome as AuditOutcome,
    ...(row.metadata !== null ? { metadata: row.metadata as Record<string, unknown> } : {}),
    ...(row.correlation_id !== null ? { correlationId: row.correlation_id } : {}),
    createdAt: row.created_at,
  };
}

export function createAuditRecordRepository(db: QueryExecutor): AuditRecordRepository {
  return {
    async create(record) {
      await db
        .insertInto('audit_records')
        .values({
          id: record.id,
          organisation_id: record.organisationId,
          project_id: record.projectId ?? null,
          actor_type: record.actorType,
          actor_id: record.actorId,
          action: record.action,
          target_type: record.targetType,
          target_id: record.targetId,
          outcome: record.outcome,
          metadata: record.metadata !== undefined ? JSON.stringify(record.metadata) : null,
          correlation_id: record.correlationId ?? null,
          created_at: record.createdAt,
        })
        .execute();
    },

    async listForProject(projectId, limit = 100) {
      const rows = await db
        .selectFrom('audit_records')
        .selectAll()
        .where('project_id', '=', projectId)
        .orderBy('created_at', 'desc')
        .limit(limit)
        .execute();
      return rows.map(toDomain);
    },
  };
}
