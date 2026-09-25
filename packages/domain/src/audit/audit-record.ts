import type { AuditId, OrganisationId, ProjectId } from '@devos/contracts';

/**
 * DEVOS-297 (Sprint 48): `'AGENT'` is new — a real agent-run action
 * attributed to its own `AGENT_PROFILE` principal, distinct from a human
 * (`'USER'`) and from the undifferentiated platform system actor
 * (`'SYSTEM'`, e.g. `devos-agent-runtime`'s own budget-alert/orchestration
 * writes, which stay `'SYSTEM'` — they are not any one agent's own action).
 */
export type AuditActorType = 'USER' | 'SYSTEM' | 'AGENT';
export type AuditOutcome = 'SUCCESS' | 'FAILURE';

export interface AuditRecord {
  id: AuditId;
  organisationId: OrganisationId;
  projectId?: ProjectId;
  actorType: AuditActorType;
  actorId: string;
  /** DEVOS-309 (Sprint 51 reconciliation): resolved, read-only — writers
   * never set this directly (it is derived from `actorId`/`actorType` at
   * the repository layer, see `createAuditRecordRepository`); absent for
   * `SYSTEM` actors or any `USER`/`AGENT` actor id that does not resolve to
   * a real `principals` row. */
  actorPrincipalId?: string;
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
