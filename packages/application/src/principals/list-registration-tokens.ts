import type { RegistrationToken } from '@devos/domain';
import { ForbiddenError } from '../errors.js';
import type { RegistrationTokenUseCaseDeps } from './deps.js';

/** DEVOS-331: read access is gated identically to issue/revoke — only an
 * existing platform operator may see which tokens have been issued. The
 * raw token value is never returned here (it never even reaches this
 * layer — only `tokenHash` is persisted, DEVOS-329). */
export async function listRegistrationTokens(
  deps: RegistrationTokenUseCaseDeps,
  actingPrincipalId: string,
): Promise<RegistrationToken[]> {
  const actor = await deps.platformOperators.getByPrincipalId(actingPrincipalId);
  if (!actor) {
    throw new ForbiddenError('Only an existing platform operator may list registration tokens.');
  }

  return deps.registrationTokens.list();
}
