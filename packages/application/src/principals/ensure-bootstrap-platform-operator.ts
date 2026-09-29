import type { PlatformOperatorRepository } from '@devos/domain';
import { ensureHumanPrincipal, type EnsureHumanPrincipalDeps } from './ensure-human-principal.js';

export interface EnsureBootstrapPlatformOperatorDeps extends EnsureHumanPrincipalDeps {
  platformOperators: PlatformOperatorRepository;
  /** `undefined` when `DEVOS_BOOTSTRAP_PLATFORM_OPERATOR_SUBJECT` is unset —
   * the common case for every existing deployment/test, making this whole
   * function an immediate no-op. */
  bootstrapSubject?: string;
}

/**
 * DEVOS-326 (Sprint 56, candidate epic E31): the disclosed, resolved
 * bootstrap mechanism from `specs/DEVOS-ORGANISATION-ONBOARDING-BACKLOG.md`
 * §9 — a single deploy-time environment variable naming a bootstrap
 * principal. Called once per authenticated request from `apps/api`'s
 * existing auth chokepoint (`apps/api/src/app.ts`), mirroring where
 * `ensureUserIdentityForLogin` (DEVOS-285) already runs, but unconditionally
 * (not gated to OIDC-only) — the bootstrap subject may be a local-dev bearer
 * token id, since this codebase never assumes OIDC is configured.
 *
 * A cheap no-op once bootstrapping has happened: unset config, a
 * non-matching principal, or a non-empty `platform_operators` table each
 * short-circuit before any write. Only when all three conditions align
 * (configured, matching principal, zero existing operators) is a grant
 * created — `ensureHumanPrincipal` (DEVOS-284/286) is reused first, not
 * duplicated, to satisfy `platform_operators.principal_id`'s own FK to
 * `principals.id` for a principal who may never have reached that chokepoint
 * before (e.g. `createLocalAuthProvider`'s dev-mode path, DEVOS-285's own
 * doc comment: never itself calls `ensureHumanPrincipal`).
 */
export async function ensureBootstrapPlatformOperator(
  deps: EnsureBootstrapPlatformOperatorDeps,
  principalId: string,
): Promise<void> {
  if (deps.bootstrapSubject === undefined) return;
  if (principalId !== deps.bootstrapSubject) return;
  if ((await deps.platformOperators.count()) !== 0) return;

  await ensureHumanPrincipal(deps, { id: principalId });

  await deps.platformOperators.create({
    principalId,
    grantedAt: new Date().toISOString(),
  });
}
