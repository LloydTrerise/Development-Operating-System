import { randomUUID } from 'node:crypto';
import type { AuditId, ProjectId } from '@devos/contracts';
import type { AuditActorType, AuditOutcome, AuditRecord } from '@devos/domain';
import type { QueryExecutor } from './base.js';
import { createAuditRecordRepository } from './audit-records.js';

export interface WriteAuditInput {
  organisationId: string;
  projectId?: string;
  actorType: AuditActorType;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  outcome: AuditOutcome;
  metadata?: Record<string, unknown>;
  correlationId?: string;
}

export async function writeAuditRecord(trx: QueryExecutor, input: WriteAuditInput): Promise<void> {
  let record: AuditRecord = {
    id: randomUUID() as AuditId,
    organisationId: input.organisationId as AuditRecord['organisationId'],
    actorType: input.actorType,
    actorId: input.actorId,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    outcome: input.outcome,
    createdAt: new Date().toISOString(),
  };

  if (input.projectId !== undefined) {
    record = { ...record, projectId: input.projectId as ProjectId };
  }
  if (input.metadata !== undefined) {
    record = { ...record, metadata: input.metadata };
  }
  if (input.correlationId !== undefined) {
    record = { ...record, correlationId: input.correlationId };
  }

  await createAuditRecordRepository(trx).create(record);
}
