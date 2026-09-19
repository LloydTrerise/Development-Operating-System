import type { OrganisationId } from '@devos/contracts';
import type { AuditRecord } from '@devos/domain';
import { NotFoundError } from '../errors.js';
import { resolveOrganisationMembership } from '../organisations/membership-access.js';
import type { AuditUseCaseDeps } from './deps.js';

/**
 * DEVOS-147: the organisation-scoped mirror of `listAuditRecordsForProject`
 * — reuses the already-real `AuditRecordRepository.listForOrganisation`
 * (DEVOS-141) directly, a real query already correctly scoped by
 * `AuditRecord.organisationId`, rather than looping every project's own
 * `listForProject` client-side (this sprint's own `README.md` grounding
 * records the choice explicitly). Tenant isolation (ADR-SEC-005): this never
 * reaches across organisations.
 */
export async function listAuditRecordsForOrganisation(
  deps: AuditUseCaseDeps,
  principalId: string,
  organisationId: OrganisationId,
  limit?: number,
): Promise<AuditRecord[]> {
  const organisation = await deps.organisations.getById(organisationId);
  if (!organisation) throw new NotFoundError('Organisation');

  const membership = await resolveOrganisationMembership(deps, principalId, organisationId);
  if (!membership) throw new NotFoundError('Organisation');

  return deps.auditRecords.listForOrganisation(organisationId, limit);
}
