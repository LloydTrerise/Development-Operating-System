import type { RegistrationToken } from '@devos/domain';

/**
 * DEVOS-331 (Sprint 57, candidate epic E31): `tokenHash` is deliberately
 * never included — only ever useful to redeem the token, and this DTO is
 * the *listing* shape platform operators see after issuance, not the
 * raw-value-carrying issuance response itself (`toIssuedRegistrationTokenDto`
 * below), per `AGENTS.md` §22.
 */
export function toRegistrationTokenDto(token: RegistrationToken) {
  return {
    id: token.id,
    issuedByPlatformOperatorId: token.issuedByPlatformOperatorId,
    status: token.status,
    expiresAt: token.expiresAt,
    redeemedByPrincipalId: token.redeemedByPrincipalId,
    redeemedOrganisationId: token.redeemedOrganisationId,
    createdAt: token.createdAt,
    updatedAt: token.updatedAt,
  };
}

/**
 * The one, one-time response that carries the raw token value — never
 * persisted, never re-derivable, never returned by any other route
 * (`GET /registration-tokens` uses `toRegistrationTokenDto` above instead).
 */
export function toIssuedRegistrationTokenDto(result: {
  token: RegistrationToken;
  rawToken: string;
}) {
  return {
    ...toRegistrationTokenDto(result.token),
    rawToken: result.rawToken,
  };
}
