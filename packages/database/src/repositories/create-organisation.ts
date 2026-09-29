import type { RegistrationTokenId } from '@devos/contracts';
import type { Membership, Organisation } from '@devos/domain';
import type { Kysely } from 'kysely';
import type { Database } from '../database.js';
import { withTransaction } from './base.js';
import { createMembershipRepository } from './memberships.js';
import { createOrganisationRepository } from './organisations.js';
import { createRegistrationTokenRepository } from './registration-tokens.js';

/**
 * DEVOS-346 (Sprint 61, Epic E31 gap closure): the real implementation of
 * `CreateOrganisationTransactionally` (`packages/application/src/
 * organisations/deps.ts`) — runs the same four writes `createOrganisation`
 * (application) previously made sequentially (organisation, membership,
 * owner, token redemption) inside one `withTransaction` block, mirroring
 * `createOrganisationLlmProviderReorderer`'s and
 * `createDecideApprovalAndTransition`'s own identical
 * "port declared in application, adapter built here" precedent.
 */
export function createOrganisationTransactionCreator(
  db: Kysely<Database>,
): (
  organisation: Organisation,
  membership: Membership,
  tokenId: string,
  now: string,
) => Promise<void> {
  return async (organisation, membership, tokenId, now) => {
    await withTransaction(db, async (trx) => {
      await createOrganisationRepository(trx).create(organisation);
      await createMembershipRepository(trx).create(membership);
      await createOrganisationRepository(trx).setOwnerPrincipalId(
        organisation.id,
        membership.principalId,
        now,
      );
      await createRegistrationTokenRepository(trx).markRedeemed(
        tokenId as RegistrationTokenId,
        membership.principalId,
        organisation.id,
        now,
      );
    });
  };
}
