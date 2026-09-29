import type { RegistrationTokenId } from '@devos/contracts';
import { ForbiddenError, NotFoundError, ValidationError } from '../errors.js';
import type { RegistrationTokenUseCaseDeps } from './deps.js';

/**
 * DEVOS-331: gated identically to issue/list. Only an `ACTIVE` token can be
 * revoked — a token that's already `REDEEMED` (the organisation it created
 * already exists; revoking it now would be meaningless) or already
 * `REVOKED`/`EXPIRED` is rejected with the same generic `ValidationError`
 * shape `revokePlatformOperator`'s own "last operator" rejection uses.
 */
export async function revokeRegistrationToken(
  deps: RegistrationTokenUseCaseDeps,
  actingPrincipalId: string,
  tokenId: RegistrationTokenId,
): Promise<void> {
  const actor = await deps.platformOperators.getByPrincipalId(actingPrincipalId);
  if (!actor) {
    throw new ForbiddenError('Only an existing platform operator may revoke registration tokens.');
  }

  const token = await deps.registrationTokens.getById(tokenId);
  if (!token) throw new NotFoundError('RegistrationToken');
  if (token.status !== 'ACTIVE') {
    throw new ValidationError('Only an active registration token can be revoked.');
  }

  await deps.registrationTokens.markRevoked(tokenId, new Date().toISOString());
}
