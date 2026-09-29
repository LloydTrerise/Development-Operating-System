import type { OrganisationId } from '@devos/contracts';
import { NotFoundError, OrganisationNotInitialisedError } from '../errors.js';
import type { OrganisationInitialisationStatusDeps } from './deps.js';
import { getOrganisationInitialisationStatus } from './get-organisation-initialisation-status.js';

/**
 * DEVOS-337 (Sprint 59, candidate epic E31 part 4): the real enforcement
 * counterpart to Sprint 58's read-only `getOrganisationInitialisationStatus`
 * — reused here unchanged (including its own masked-`NotFoundError`-for-
 * non-member behaviour) rather than duplicating its membership/computation
 * logic, per this epic's own "reuse, don't duplicate" discipline.
 *
 * An organisation whose `initialisationEnforcementExemptAt` (DEVOS-339) is
 * set always passes, regardless of its real, live status — grandfathering
 * every organisation that existed before this sprint's backfill migration
 * ran. This does not reopen Sprint 58's own decision: `INITIALISED` and the
 * three booleans behind it stay exactly as that sprint computes them; this
 * exemption field is a separate, one-time-set historical fact this function
 * alone consults.
 */
export async function requireOrganisationInitialised(
  deps: OrganisationInitialisationStatusDeps,
  principalId: string,
  organisationId: OrganisationId,
): Promise<void> {
  const organisation = await deps.organisations.getById(organisationId);
  if (!organisation) throw new NotFoundError('Organisation');
  if (organisation.initialisationEnforcementExemptAt !== undefined) return;

  const status = await getOrganisationInitialisationStatus(deps, principalId, organisationId);
  if (status.initialised) return;

  const missing: ('hasProjectType' | 'hasLlmProvider' | 'hasPolicy')[] = [];
  if (!status.hasProjectType) missing.push('hasProjectType');
  if (!status.hasLlmProvider) missing.push('hasLlmProvider');
  if (!status.hasPolicy) missing.push('hasPolicy');
  throw new OrganisationNotInitialisedError(missing);
}
