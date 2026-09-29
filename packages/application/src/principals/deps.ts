import type {
  HumanProfileRepository,
  PlatformOperatorRepository,
  PrincipalRepository,
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
