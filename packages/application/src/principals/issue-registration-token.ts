import { randomUUID } from 'node:crypto';
import type { RegistrationTokenId } from '@devos/contracts';
import type { RegistrationToken } from '@devos/domain';
import { ForbiddenError } from '../errors.js';
import type { RegistrationTokenUseCaseDeps } from './deps.js';
import { generateRegistrationToken, hashRegistrationToken } from './registration-token-crypto.js';

/**
 * DEVOS-331 (Sprint 57, candidate epic E31): gated to existing platform
 * operators only, mirroring `grantPlatformOperator`'s identical "actor must
 * already have standing" shape. Returns the **raw** token value in this
 * one response only — `packages/domain/src/principals/registration-token.ts`'s
 * own doc comment: never persisted, never re-derivable, never shown again
 * after this call returns.
 */
export async function issueRegistrationToken(
  deps: RegistrationTokenUseCaseDeps,
  actingPrincipalId: string,
  expiryDays: number,
): Promise<{ token: RegistrationToken; rawToken: string }> {
  const actor = await deps.platformOperators.getByPrincipalId(actingPrincipalId);
  if (!actor) {
    throw new ForbiddenError('Only an existing platform operator may issue registration tokens.');
  }

  const rawToken = generateRegistrationToken();
  const now = new Date().toISOString();
  const token: RegistrationToken = {
    id: randomUUID() as RegistrationTokenId,
    tokenHash: hashRegistrationToken(rawToken),
    issuedByPlatformOperatorId: actingPrincipalId,
    status: 'ACTIVE',
    expiresAt: new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: now,
    updatedAt: now,
  };

  await deps.registrationTokens.create(token);
  return { token, rawToken };
}
