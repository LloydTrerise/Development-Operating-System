import { randomUUID } from 'node:crypto';
import type { CreateOrganisationInput, Membership, Organisation } from '@devos/domain';
import { ValidationError } from '../errors.js';
import type { OrganisationUseCaseDeps } from './deps.js';
import { hashRegistrationToken } from '../principals/registration-token-crypto.js';

/**
 * DEVOS-330 (Sprint 57, candidate epic E31): **the disclosed, deliberate
 * reversal** of this function's own previous design — every prior version
 * of this doc comment (and `specs/sprints/sprint-51/DEVOS-310.md:46`, as
 * recently as 2026-09-27) stated "any authenticated principal may create an
 * organisation... this codebase's own longstanding, symmetric convention."
 * That is no longer true: a valid, unredeemed, unexpired registration token
 * a platform operator issued (DEVOS-331) is now required. `project.create`
 * is untouched — this reversal is scoped to `organisation.create` only, per
 * `specs/DEVOS-ORGANISATION-ONBOARDING-BACKLOG.md` §2.7/§5.2.
 *
 * The rest of this function — the creator becoming the organisation's
 * transferable `ownerPrincipalId` (DEVOS-290) via a real org-level
 * `ORGANISATION_ADMIN` membership (`projectId: null`), reusing the exact
 * mechanism `resolveMembership()`
 * (packages/application/src/projects/membership-access.ts) already falls
 * back to — is completely unchanged.
 */
export async function createOrganisation(
  deps: OrganisationUseCaseDeps,
  principalId: string,
  input: CreateOrganisationInput,
): Promise<Organisation> {
  if (input.name.trim().length === 0) throw new ValidationError('name is required.');
  if (input.slug.trim().length === 0) throw new ValidationError('slug is required.');
  if (input.registrationToken.trim().length === 0) {
    throw new ValidationError('registrationToken is required.');
  }

  // DEVOS-330: the generic messages below never echo the raw token value
  // back (`AGENTS.md` §22, mirroring `CredentialResolver`'s own "never leak
  // the secret value in an error" discipline) — each distinguishes *why*
  // redemption failed without distinguishing "unknown" from "wrong" in a
  // way that would help an attacker enumerate valid-but-differently-broken
  // tokens.
  const token = await deps.registrationTokens.getByTokenHash(
    hashRegistrationToken(input.registrationToken),
  );
  if (!token) throw new ValidationError('Registration token is invalid.');
  if (token.status === 'REDEEMED') {
    throw new ValidationError('Registration token has already been redeemed.');
  }
  if (token.status === 'REVOKED') {
    throw new ValidationError('Registration token has been revoked.');
  }
  if (token.status === 'EXPIRED') {
    throw new ValidationError('Registration token has expired.');
  }

  const now = new Date().toISOString();
  const organisation: Organisation = {
    id: randomUUID() as Organisation['id'],
    name: input.name,
    slug: input.slug,
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  };

  // DEVOS-290: `organisations.owner_principal_id` has a real FK to
  // `principals.id`, but nothing backs `principalId` with a real `PRINCIPAL`
  // row until `createMembershipRepository.create()` get-or-creates one
  // (DEVOS-286) — and that call itself needs `organisation.id` to already
  // exist (`memberships.organisation_id`'s own FK). So the organisation is
  // created without an owner first, then the membership (creating the
  // backing principal row as a side effect), then `owner_principal_id` is
  // set — a real ordering bug found and fixed during this task's own live
  // verification (a naive create-with-owner-inline attempt failed on a real
  // Postgres foreign-key violation).
  await deps.organisations.create(organisation);

  const membership: Membership = {
    id: randomUUID() as Membership['id'],
    organisationId: organisation.id,
    projectId: null,
    principalId,
    role: 'ORGANISATION_ADMIN',
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  };

  await deps.memberships.create(membership);
  await deps.organisations.setOwnerPrincipalId(organisation.id, principalId, now);

  // DEVOS-330: marks the token consumed only after every prior step
  // succeeded — a failure partway through the organisation/membership
  // creation sequence above leaves the token still `ACTIVE`, so the
  // principal isn't left holding a burned token for an organisation that
  // was never actually created. Decided and disclosed rather than wrapped
  // in a database transaction spanning both concerns (`DEVOS-332`) — no
  // existing repository method here supports one, and DEVOS-290's own
  // create-then-membership-then-owner sequence already accepts the same
  // kind of partial-failure window for the same reason.
  await deps.registrationTokens.markRedeemed(token.id, principalId, organisation.id, now);

  return { ...organisation, ownerPrincipalId: principalId };
}
