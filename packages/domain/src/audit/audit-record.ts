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
  /**
   * DEVOS-141: a direct `organisation_id` query — `AuditRecord.organisationId`
   * is already required on every row, so this is a real, already-supported
   * shape, not a workaround for the lack of one.
   */
  listForOrganisation: (organisationId: OrganisationId, limit?: number) => Promise<AuditRecord[]>;
}
