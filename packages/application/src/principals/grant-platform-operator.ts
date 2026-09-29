import { randomUUID } from 'node:crypto';
import type { PlatformAuditId } from '@devos/contracts';
import type { PlatformAuditRecord, PlatformOperator } from '@devos/domain';
import { ForbiddenError, ValidationError } from '../errors.js';
import type { PlatformOperatorUseCaseDeps } from './deps.js';
import { ensureHumanPrincipal } from './ensure-human-principal.js';

/**
 * DEVOS-327: gated to existing platform operators only — mirrors
 * `addOrganisationMember`'s "requester must already have standing" shape,
 * at platform scope instead of organisation scope. The target may never
 * have made an authenticated request through this codebase's bootstrap
 * chokepoint before, so `ensureHumanPrincipal` (DEVOS-284/286) is reused
 * first to satisfy `platform_operators.principal_id`'s own FK to
 * `principals.id` — the same need `ensureBootstrapPlatformOperator`
 * (DEVOS-326) already has.
 */
export async function grantPlatformOperator(
  deps: PlatformOperatorUseCaseDeps,
  actingPrincipalId: string,
  targetPrincipalId: string,
): Promise<PlatformOperator> {
  const actor = await deps.platformOperators.getByPrincipalId(actingPrincipalId);
  if (!actor) {
    throw new ForbiddenError(
      'Only an existing platform operator may grant platform-operator status.',
    );
  }

  const existing = await deps.platformOperators.getByPrincipalId(targetPrincipalId);
  if (existing) throw new ValidationError('Principal is already a platform operator.');

  await ensureHumanPrincipal(deps, { id: targetPrincipalId });

  const now = new Date().toISOString();
  const operator: PlatformOperator = {
    principalId: targetPrincipalId,
    grantedAt: now,
    grantedByPrincipalId: actingPrincipalId,
  };
  await deps.platformOperators.create(operator);

  // DEVOS-345 (Sprint 61): a separate, dedicated platform-level audit
  // record — `AuditRecord.organisationId` is required and a platform
  // operator has none by design, per this sprint's own Decision 1.
  const auditRecord: PlatformAuditRecord = {
    id: randomUUID() as PlatformAuditId,
    actorPrincipalId: actingPrincipalId,
    action: 'platform_operator.granted',
    targetPrincipalId: targetPrincipalId,
    outcome: 'SUCCESS',
    createdAt: now,
  };
  await deps.platformAuditRecords.create(auditRecord);

  return operator;
}
