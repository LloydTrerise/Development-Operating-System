import type { AuditId, OrganisationId, ProjectId } from '@devos/contracts';

export type AuditActorType = 'USER' | 'SYSTEM';
export type AuditOutcome = 'SUCCESS' | 'FAILURE';

export interface AuditRecord {
  id: AuditId;
  organisationId: OrganisationId;
  projectId?: ProjectId;
  actorType: AuditActorType;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  outcome: AuditOutcome;
  metadata?: Record<string, unknown>;
  correlationId?: string;
  createdAt: string;
}

export interface AuditRecordRepository {
  create: (record: AuditRecord) => Promise<void>;
  listForProject: (projectId: ProjectId, limit?: number) => Promise<AuditRecord[]>;
}
