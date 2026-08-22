import type { AuditRecord } from '@devos/domain';

export function toAuditRecordDto(record: AuditRecord) {
  return {
    id: record.id,
    organisationId: record.organisationId,
    projectId: record.projectId,
    actorType: record.actorType,
    actorId: record.actorId,
    action: record.action,
    targetType: record.targetType,
    targetId: record.targetId,
    outcome: record.outcome,
    metadata: record.metadata,
    correlationId: record.correlationId,
    createdAt: record.createdAt,
  };
}
