import { randomUUID } from 'node:crypto';
import type { CreateOrganisationInput, Membership, Organisation } from '@devos/domain';
import { ValidationError } from '../errors.js';
import type { OrganisationUseCaseDeps } from './deps.js';

/**
 * Any authenticated principal may create an organisation (matches today's
 * ungated project creation) — the creator becomes its OWNER via an
 * org-level membership (`projectId: null`), reusing the exact mechanism
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

  await deps.organisations.create(organisation);

  const membership: Membership = {
    id: randomUUID() as Membership['id'],
    organisationId: organisation.id,
    projectId: null,
    principalId,
    role: 'OWNER',
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  };

  await deps.memberships.create(membership);

  return organisation;
}
