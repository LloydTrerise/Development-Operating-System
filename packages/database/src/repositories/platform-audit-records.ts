import type { PlatformAuditId } from '@devos/contracts';
import type {
  AuditOutcome,
  PlatformAuditRecord,
  PlatformAuditRecordRepository,
} from '@devos/domain';
import type { PlatformAuditRecordsTable } from '../database.js';
import type { QueryExecutor } from './base.js';

function toDomain(row: PlatformAuditRecordsTable): PlatformAuditRecord {
  return {
    id: row.id as PlatformAuditId,
    actorPrincipalId: row.actor_principal_id,
    action: row.action,
    targetPrincipalId: row.target_principal_id,
    outcome: row.outcome as AuditOutcome,
    ...(row.metadata !== null ? { metadata: row.metadata as Record<string, unknown> } : {}),
    createdAt: row.created_at,
  };
}

export function createPlatformAuditRecordRepository(
  db: QueryExecutor,
): PlatformAuditRecordRepository {
  return {
    async create(record) {
      await db
        .insertInto('platform_audit_records')
        .values({
          id: record.id,
          actor_principal_id: record.actorPrincipalId,
          action: record.action,
          target_principal_id: record.targetPrincipalId,
          outcome: record.outcome,
          metadata: record.metadata !== undefined ? JSON.stringify(record.metadata) : null,
          created_at: record.createdAt,
        })
        .execute();
    },

    async list(limit = 100) {
      const rows = await db
        .selectFrom('platform_audit_records')
        .selectAll()
        .orderBy('created_at', 'desc')
        .limit(limit)
        .execute();
      return rows.map(toDomain);
    },
  };
}
