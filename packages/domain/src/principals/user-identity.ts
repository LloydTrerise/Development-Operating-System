import type { UserIdentityId } from '@devos/contracts';

/**
 * DEVOS-285: one row per `(provider, providerSubject)` a human has ever
 * logged in with — `providerSubject` is the token's own `sub` claim,
 * deliberately identical to the `Principal.id`/`principalId` this codebase
 * already uses everywhere (see `principal.ts`'s own doc comment), so this
 * table is a real login record, not a second identity namespace.
 */
export interface UserIdentity {
  id: UserIdentityId;
  principalId: string;
  provider: string;
  providerSubject: string;
  createdAt: string;
}

export interface UserIdentityRepository {
  getByProviderSubject: (provider: string, providerSubject: string) => Promise<UserIdentity | null>;
  create: (identity: UserIdentity) => Promise<void>;
}
