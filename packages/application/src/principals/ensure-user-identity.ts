import { randomUUID } from 'node:crypto';
import type { UserIdentityId } from '@devos/contracts';
import type { UserIdentityRepository } from '@devos/domain';
import { ensureHumanPrincipal, type EnsureHumanPrincipalDeps } from './ensure-human-principal.js';

export interface EnsureUserIdentityDeps extends EnsureHumanPrincipalDeps {
  userIdentities: UserIdentityRepository;
}

export interface EnsureUserIdentityInput {
  id: string;
  email?: string;
}

/**
 * DEVOS-285: the real, first-ever writer of `USER_IDENTITY` — called once
 * per successfully-authenticated real OIDC request (`apps/api/src/app.ts`),
 * mirroring `createOidcAuthProvider`'s own already-verified `sub`/`email`
 * claims. `provider` is a fixed literal, not per-issuer, matching this
 * codebase's own already-generic OIDC verifier (`packages/identity/src/
 * authentication/oidc-provider.ts`'s doc comment: "already works against
 * any OIDC issuer... without a branded per-provider implementation") — one
 * DevOS deployment has exactly one configured issuer, so there is nothing a
 * second provider value would ever need to distinguish.
 *
 * Deliberately never called from `createLocalAuthProvider`'s dev-mode path
 * (its bearer token is trusted as-is with no real IdP behind it, so it isn't
 * a "login" this table is meant to record) — every existing test uses that
 * path exclusively (`app.ts`'s own doc comment at the OIDC/local selection
 * point), so this function has zero reachable call site in the existing
 * test suite, the same "identical results on every existing test" property
 * DEVOS-286 requires (`specs/sprints/sprint-46/DEVOS-285.md`).
 */
export async function ensureUserIdentityForLogin(
  deps: EnsureUserIdentityDeps,
  input: EnsureUserIdentityInput,
  provider: string,
): Promise<void> {
  await ensureHumanPrincipal(deps, input);

  const existing = await deps.userIdentities.getByProviderSubject(provider, input.id);
  if (!existing) {
    await deps.userIdentities.create({
      id: randomUUID() as UserIdentityId,
      principalId: input.id,
      provider,
      providerSubject: input.id,
      createdAt: new Date().toISOString(),
    });
  }
}
