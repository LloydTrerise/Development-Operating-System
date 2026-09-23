import { randomUUID } from 'node:crypto';
import type { CreateOrganisationInput, Membership, Organisation } from '@devos/domain';
import { ValidationError } from '../errors.js';
import type { OrganisationUseCaseDeps } from './deps.js';

/**
 * Any authenticated principal may create an organisation (matches today's
 * ungated project creation) — the creator becomes its transferable
 * `ownerPrincipalId` (DEVOS-290) via a real org-level `ORGANISATION_ADMIN`
 * membership (`projectId: null`), reusing the exact mechanism
 * `resolveMembership()` (packages/application/src/projects/membership-access.ts)
 * already falls back to, rather than inventing a new one.
 */
export async function createOrganisation(
  deps: OrganisationUseCaseDeps,
  principalId: string,
  input: CreateOrganisationInput,
): Promise<Organisation> {
  if (input.name.trim().length === 0) throw new ValidationError('name is required.');
  if (input.slug.trim().length === 0) throw new ValidationError('slug is required.');

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

  return { ...organisation, ownerPrincipalId: principalId };
}
