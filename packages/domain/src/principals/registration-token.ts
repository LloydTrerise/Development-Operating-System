import type {
  OrganisationId,
  RegistrationTokenId,
  RegistrationTokenStatus,
} from '@devos/contracts';

/**
 * DEVOS-329 (Sprint 57, `specs/DEVOS-ORGANISATION-ONBOARDING-BACKLOG.md`
 * §6.2, candidate epic E31): a platform-operator-issued, single-use,
 * expiring grant that DEVOS-330 requires `createOrganisation` to redeem.
 * The raw token value is never persisted anywhere — only `tokenHash` (a
 * salted hash `packages/application/src/principals/registration-token-crypto.ts`
 * computes), per `AGENTS.md` §22 and the backlog's own §9 "stored only as a
 * hash" resolution. The raw value is returned to the issuing platform
 * operator exactly once, in `issueRegistrationToken`'s own response
 * (DEVOS-331) — never re-derivable, never shown again after that.
 *
 * `status` here is the token's *effective* status — `EXPIRED` is derived at
 * read time from `expiresAt` rather than a separately-transitioned stored
 * value (see `packages/database/src/repositories/registration-tokens.ts`'s
 * own `toDomain`), since the only two writers that ever change a token's
 * persisted status (`markRedeemed`/`markRevoked`) both already know exactly
 * which of those two terminal states applies — there is no third writer
 * that would ever need to write `EXPIRED` itself.
 */
export interface RegistrationToken {
  id: RegistrationTokenId;
  tokenHash: string;
  issuedByPlatformOperatorId: string;
  status: RegistrationTokenStatus;
  expiresAt: string;
  redeemedByPrincipalId?: string;
  redeemedOrganisationId?: OrganisationId;
  createdAt: string;
  updatedAt: string;
}

export interface RegistrationTokenRepository {
  getByTokenHash: (tokenHash: string) => Promise<RegistrationToken | null>;
  /** DEVOS-331: `revokeRegistrationToken`'s own lookup — the API route
   * addresses a token by `id`, never by its (secret, hashed) value. */
  getById: (id: RegistrationTokenId) => Promise<RegistrationToken | null>;
  list: () => Promise<RegistrationToken[]>;
  create: (token: RegistrationToken) => Promise<void>;
  /** DEVOS-330: the sole writer of a `REDEEMED` outcome. */
  markRedeemed: (
    id: RegistrationTokenId,
    redeemedByPrincipalId: string,
    redeemedOrganisationId: OrganisationId,
    updatedAt: string,
  ) => Promise<void>;
  /** DEVOS-331: the sole writer of a `REVOKED` outcome. */
  markRevoked: (id: RegistrationTokenId, updatedAt: string) => Promise<void>;
}
