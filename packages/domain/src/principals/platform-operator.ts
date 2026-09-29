/**
 * DEVOS-325 (Sprint 56, candidate epic E31): a real, principal-attached
 * grant that sits above and outside every organisation — see migration
 * `0060_platform_operators.ts`'s own doc comment for why this needs a new
 * table rather than reusing `Membership` (whose `organisationId` is
 * non-nullable even for an org-level row). `principalId` stays a bare
 * `string`, matching `Principal.id`'s own established convention (the OIDC
 * `sub` claim, or a bare dev-mode bearer token) rather than a branded
 * contracts type — the same choice `Membership.principalId` already made.
 *
 * A principal with no `PlatformOperator` row is not a platform operator;
 * this sprint adds no reader anywhere outside its own management routes
 * (DEVOS-327) — `createOrganisation` and every other existing use case are
 * completely unaffected.
 */
export interface PlatformOperator {
  principalId: string;
  grantedAt: string;
  grantedByPrincipalId?: string;
}

export interface PlatformOperatorRepository {
  getByPrincipalId: (principalId: string) => Promise<PlatformOperator | null>;
  list: () => Promise<PlatformOperator[]>;
  /** DEVOS-326 needs this to detect "zero platform operators exist yet"
   * without fetching every row. */
  count: () => Promise<number>;
  create: (platformOperator: PlatformOperator) => Promise<void>;
  /** DEVOS-327's revoke. */
  delete: (principalId: string) => Promise<void>;
}
