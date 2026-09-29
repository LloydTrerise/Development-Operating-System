import { randomUUID } from 'node:crypto';
import type { PlatformAuditId } from '@devos/contracts';
import type { PlatformAuditRecord } from '@devos/domain';
import { ForbiddenError, NotFoundError, ValidationError } from '../errors.js';
import type { PlatformOperatorUseCaseDeps } from './deps.js';

/**
 * DEVOS-327: mirrors `assertNotLastOrganisationAdmin`'s "never leave zero
 * owners" discipline (DEVOS-290) at platform scope — a platform operator
 * being the sole remaining one is rejected with the same `ValidationError`
 * shape that discipline already established, distinct from the `ForbiddenError`
 * an unauthorized actor gets.
 */
export async function revokePlatformOperator(
  deps: PlatformOperatorUseCaseDeps,
  actingPrincipalId: string,
  targetPrincipalId: string,
): Promise<void> {
  const actor = await deps.platformOperators.getByPrincipalId(actingPrincipalId);
  if (!actor) {
    throw new ForbiddenError(
      'Only an existing platform operator may revoke platform-operator status.',
    );
  }

  const target = await deps.platformOperators.getByPrincipalId(targetPrincipalId);
  if (!target) throw new NotFoundError('PlatformOperator');

  const count = await deps.platformOperators.count();
  if (count <= 1) {
    throw new ValidationError('Cannot revoke the last remaining platform operator.');
  }

  await deps.platformOperators.delete(targetPrincipalId);

  // DEVOS-345 (Sprint 61): see `grant-platform-operator.ts`'s identical
  // audit-record doc comment.
  const auditRecord: PlatformAuditRecord = {
    id: randomUUID() as PlatformAuditId,
    actorPrincipalId: actingPrincipalId,
    action: 'platform_operator.revoked',
    targetPrincipalId: targetPrincipalId,
    outcome: 'SUCCESS',
    createdAt: new Date().toISOString(),
  };
  await deps.platformAuditRecords.create(auditRecord);
}
