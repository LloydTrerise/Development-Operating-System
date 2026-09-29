import type {
  HumanProfileRepository,
  PlatformOperatorRepository,
  PrincipalRepository,
  RegistrationTokenRepository,
} from '@devos/domain';

/**
 * DEVOS-327 (Sprint 56, candidate epic E31): shared by every platform-
 * operator management use case. `principals`/`humanProfiles` are only
 * actually touched by `grantPlatformOperator` (via `ensureHumanPrincipal`,
 * for a target who may never have reached the bootstrap chokepoint before,
 * DEVOS-326) — `listPlatformOperators`/`revokePlatformOperator` only use
 * `platformOperators`, mirroring `OrganisationUseCaseDeps`'s own established
 * "bundle what the resource's use cases need, not what every single one
 * uses" precedent.
 */
export interface PlatformOperatorUseCaseDeps {
  principals: PrincipalRepository;
  humanProfiles: HumanProfileRepository;
  platformOperators: PlatformOperatorRepository;
}

/**
 * DEVOS-331 (Sprint 57, candidate epic E31): `issueRegistrationToken`/
 * `listRegistrationTokens`/`revokeRegistrationToken` all gate on
 * `platformOperators` (the same `getByPrincipalId`-not-found-means-
 * `ForbiddenError` check `grantPlatformOperator`/`revokePlatformOperator`/
 * `listPlatformOperators` already established), plus the new
 * `registrationTokens` repository itself. Kept separate from
 * `PlatformOperatorUseCaseDeps` rather than widening it — nothing here
 * needs `principals`/`humanProfiles` (unlike `grantPlatformOperator`, no
 * target principal needs `ensureHumanPrincipal`; a registration token is
 * issued to no one in particular, only redeemed later by whoever ends up
 * using it, DEVOS-330), mirroring `OrganisationLlmProviderUseCaseDeps`'s
 * own "narrower than the shared deps it's adjacent to" precedent.
 */
export interface RegistrationTokenUseCaseDeps {
  platformOperators: PlatformOperatorRepository;
  registrationTokens: RegistrationTokenRepository;
}
