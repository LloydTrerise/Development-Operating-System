import type { UserIdentityId } from '@devos/contracts';
import type { UserIdentity, UserIdentityRepository } from '@devos/domain';
import type { UserIdentitiesTable } from '../database.js';
import type { QueryExecutor } from './base.js';

function toDomain(row: UserIdentitiesTable): UserIdentity {
  return {
    id: row.id as UserIdentityId,
    principalId: row.principal_id,
    provider: row.provider,
    providerSubject: row.provider_subject,
    createdAt: row.created_at,
  };
}

export function createUserIdentityRepository(db: QueryExecutor): UserIdentityRepository {
  return {
    async getByProviderSubject(provider, providerSubject) {
      const row = await db
        .selectFrom('user_identities')
        .selectAll()
        .where('provider', '=', provider)
        .where('provider_subject', '=', providerSubject)
        .executeTakeFirst();
      return row ? toDomain(row) : null;
    },

    async create(identity) {
      await db
        .insertInto('user_identities')
        .values({
          id: identity.id,
          principal_id: identity.principalId,
          provider: identity.provider,
          provider_subject: identity.providerSubject,
          created_at: identity.createdAt,
        })
        .onConflict((oc) => oc.columns(['provider', 'provider_subject']).doNothing())
        .execute();
    },
  };
}
