import type { PlatformOperator } from '@devos/domain';
import { ForbiddenError } from '../errors.js';
import type { PlatformOperatorUseCaseDeps } from './deps.js';

/** DEVOS-327: read access is gated identically to grant/revoke — only an
 * existing platform operator may see who else holds the tier. */
export async function listPlatformOperators(
  deps: PlatformOperatorUseCaseDeps,
  actingPrincipalId: string,
): Promise<PlatformOperator[]> {
  const actor = await deps.platformOperators.getByPrincipalId(actingPrincipalId);
  if (!actor) {
    throw new ForbiddenError('Only an existing platform operator may list platform operators.');
  }

  return deps.platformOperators.list();
}
