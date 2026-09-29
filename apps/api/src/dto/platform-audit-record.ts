import type { PlatformAuditRecord } from '@devos/domain';

export function toPlatformAuditRecordDto(record: PlatformAuditRecord) {
  return {
    id: record.id,
    actorPrincipalId: record.actorPrincipalId,
    action: record.action,
    targetPrincipalId: record.targetPrincipalId,
    outcome: record.outcome,
    metadata: record.metadata,
    createdAt: record.createdAt,
  };
}
