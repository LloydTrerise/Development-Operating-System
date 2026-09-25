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
    ...(row.actor_principal_id !== null ? { actorPrincipalId: row.actor_principal_id } : {}),
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
      // DEVOS-309 (Sprint 51 reconciliation): resolved here, not accepted
      // as writer input (see `AuditRecord.actorPrincipalId`'s own doc
      // comment) — a real existence check, not an unconditional copy of
      // `actor_id`, since `actor_principal_id` carries a real FK to
      // `principals.id` and an unconditional copy would reject the whole
      // audit write whenever a USER/AGENT actor id does not (yet) resolve
      // to one.
      let actorPrincipalId: string | null = null;
      if (record.actorType === 'USER' || record.actorType === 'AGENT') {
        const principal = await db
          .selectFrom('principals')
          .select('id')
          .where('id', '=', record.actorId)
          .executeTakeFirst();
        actorPrincipalId = principal?.id ?? null;
      }

      await db
        .insertInto('audit_records')
        .values({
          id: record.id,
          organisation_id: record.organisationId,
          project_id: record.projectId ?? null,
          actor_type: record.actorType,
          actor_id: record.actorId,
          actor_principal_id: actorPrincipalId,
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

    async listForOrganisation(organisationId, limit = 100) {
      const rows = await db
        .selectFrom('audit_records')
        .selectAll()
        .where('organisation_id', '=', organisationId)
        .orderBy('created_at', 'desc')
        .limit(limit)
        .execute();
      return rows.map(toDomain);
    },
  };
}
