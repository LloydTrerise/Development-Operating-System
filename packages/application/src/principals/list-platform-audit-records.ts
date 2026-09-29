import type { PlatformAuditRecord } from '@devos/domain';
import { ForbiddenError } from '../errors.js';
import type { PlatformOperatorUseCaseDeps } from './deps.js';

/** DEVOS-345 (Sprint 61): read access gated identically to
 * `listPlatformOperators` — only an existing platform operator may see the
 * grant/revoke audit trail. */
export async function listPlatformAuditRecords(
  deps: PlatformOperatorUseCaseDeps,
  actingPrincipalId: string,
): Promise<PlatformAuditRecord[]> {
  const actor = await deps.platformOperators.getByPrincipalId(actingPrincipalId);
  if (!actor) {
    throw new ForbiddenError('Only an existing platform operator may list platform audit records.');
  }

  return deps.platformAuditRecords.list();
}
