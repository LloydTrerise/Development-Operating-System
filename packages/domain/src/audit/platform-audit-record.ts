import type { PlatformAuditId } from '@devos/contracts';
import type { AuditOutcome } from './audit-record.js';

/**
 * DEVOS-345 (Sprint 61, Epic E31 gap closure): a separate, dedicated
 * platform-level audit concept, not a widened `AuditRecord` — a platform
 * operator sits above and outside every organisation by design
 * (`AuditRecord.organisationId` is required, `packages/database/migrations/
 * 0012_audit_records.ts:10`), so a grant/revoke has no `organisationId` to
 * give it. Per `specs/DEVOS-E31-GAP-CLOSURE-SPRINT.md` §6 Decision 1, this
 * mirrors `platform_operators`/`registration_tokens`'s own established
 * precedent (Sprint 56/57) of a new table for a new tier rather than
 * widening an existing organisation-scoped one.
 */
export interface PlatformAuditRecord {
  id: PlatformAuditId;
  actorPrincipalId: string;
  action: string;
  targetPrincipalId: string;
  outcome: AuditOutcome;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface PlatformAuditRecordRepository {
  create: (record: PlatformAuditRecord) => Promise<void>;
  list: (limit?: number) => Promise<PlatformAuditRecord[]>;
}
