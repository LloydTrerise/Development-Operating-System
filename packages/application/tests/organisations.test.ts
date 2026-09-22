import { randomUUID } from 'node:crypto';
import type { OrganisationId } from '@devos/contracts';
import type {
  AuditRecord,
  AuditRecordRepository,
  Membership,
  MembershipRepository,
  Organisation,
  OrganisationRepository,
} from '@devos/domain';
import { beforeEach, describe, expect, it } from 'vitest';
import { addOrganisationMember } from '../src/organisations/add-member.js';
import { changeOrganisationMemberRole } from '../src/organisations/change-member-role.js';
import { createOrganisation } from '../src/organisations/create-organisation.js';
import type { OrganisationUseCaseDeps } from '../src/organisations/deps.js';
import { getOrganisationForPrincipal } from '../src/organisations/get-organisation.js';
import { listOrganisationMembers } from '../src/organisations/list-members.js';
import { listOrganisationsForPrincipal } from '../src/organisations/list-organisations-for-principal.js';
import { removeOrganisationMember } from '../src/organisations/remove-member.js';
import { updateOrganisation } from '../src/organisations/update-organisation.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../src/errors.js';

function createInMemoryDeps(): OrganisationUseCaseDeps {
  const organisations = new Map<string, Organisation>();
  const memberships = new Map<string, Membership>();

  const organisationRepository: OrganisationRepository = {
    getById: async (id) => organisations.get(id) ?? null,
    list: async () => [...organisations.values()],
    create: async (organisation) => {
      organisations.set(organisation.id, organisation);
    },
    update: async (id, changes, updatedAt) => {
      const existing = organisations.get(id);
      if (!existing) return;
      organisations.set(id, { ...existing, ...changes, updatedAt });
    },
  };

  const membershipRepository: MembershipRepository = {
    getById: async (id) => memberships.get(id) ?? null,
    getForPrincipalAndProject: async (principalId, projectId) =>
      [...memberships.values()].find(
        (m) => m.principalId === principalId && m.projectId === projectId,
      ) ?? null,
    listForPrincipal: async (principalId) =>
      [...memberships.values()].filter((m) => m.principalId === principalId),
    listForProject: async (projectId) =>
      [...memberships.values()].filter((m) => m.projectId === projectId),
    listForOrganisation: async (organisationId) =>
      [...memberships.values()].filter(
        (m) => m.organisationId === organisationId && m.projectId === null,
      ),
    create: async (membership) => {
      memberships.set(membership.id, membership);
    },
    updateRole: async (id, role, updatedAt) => {
      const existing = memberships.get(id);
      if (!existing) return;
      memberships.set(id, { ...existing, role, updatedAt });
    },
    remove: async (id) => {
      memberships.delete(id);
    },
  };

  const auditRecordsStore: AuditRecord[] = [];
  const auditRecords: AuditRecordRepository = {
    create: async (record) => {
      auditRecordsStore.push(record);
    },
    listForProject: async (projectId) => auditRecordsStore.filter((r) => r.projectId === projectId),
    listForOrganisation: async (organisationId) =>
      auditRecordsStore.filter((r) => r.organisationId === organisationId),
  };

  return { organisations: organisationRepository, memberships: membershipRepository, auditRecords };
}

describe('organisation use cases', () => {
  let deps: OrganisationUseCaseDeps;

  beforeEach(() => {
    deps = createInMemoryDeps();
  });

  it('creates an organisation and makes the creator an org-level OWNER', async () => {
    const organisation = await createOrganisation(deps, 'alice', {
      name: 'Acme Corp',
      slug: 'acme-corp',
    });

    expect(organisation).toMatchObject({ name: 'Acme Corp', slug: 'acme-corp', status: 'ACTIVE' });

    const memberships = await deps.memberships.listForPrincipal('alice');
    expect(memberships).toContainEqual(
      expect.objectContaining({
        organisationId: organisation.id,
        projectId: null,
        role: 'OWNER',
      }),
    );
  });

  it('rejects an empty name or slug', async () => {
    await expect(createOrganisation(deps, 'alice', { name: '', slug: 'x' })).rejects.toThrow(
      ValidationError,
    );
    await expect(createOrganisation(deps, 'alice', { name: 'X', slug: '' })).rejects.toThrow(
      ValidationError,
    );
  });

  it('lists only organisations the principal has a membership in', async () => {
    const acme = await createOrganisation(deps, 'alice', { name: 'Acme', slug: 'acme' });
    await createOrganisation(deps, 'bob', { name: 'Globex', slug: 'globex' });

    const aliceOrgs = await listOrganisationsForPrincipal(deps, 'alice');
    expect(aliceOrgs.map((o) => o.id)).toEqual([acme.id]);
  });

  it('rejects getOrganisationForPrincipal for a non-member', async () => {
    const acme = await createOrganisation(deps, 'alice', { name: 'Acme', slug: 'acme' });

    await expect(getOrganisationForPrincipal(deps, 'mallory', acme.id)).rejects.toThrow(
      NotFoundError,
    );
  });

  it('rejects a non-existent organisation id', async () => {
    await expect(
      getOrganisationForPrincipal(deps, 'alice', randomUUID() as OrganisationId),
    ).rejects.toThrow(NotFoundError);
  });

  it('allows the org-level OWNER to update the organisation, denies a non-member', async () => {
    const acme = await createOrganisation(deps, 'alice', { name: 'Acme', slug: 'acme' });

    const updated = await updateOrganisation(deps, 'alice', acme.id, { name: 'Acme Renamed' });
    expect(updated.name).toBe('Acme Renamed');

    await expect(
      updateOrganisation(deps, 'mallory', acme.id, { name: 'Should fail' }),
    ).rejects.toThrow(NotFoundError);
  });

  it('falls back to an OWNER of any project within the organisation when no org-level membership exists', async () => {
    const acme = await createOrganisation(deps, 'alice', { name: 'Acme', slug: 'acme' });

    // Simulate today's reality: a project-level OWNER membership with no
    // corresponding org-level one — the exact gap this fallback closes.
    await deps.memberships.create({
      id: randomUUID() as Membership['id'],
      organisationId: acme.id,
      projectId: randomUUID() as Membership['projectId'],
      principalId: 'carol',
      role: 'OWNER',
      status: 'ACTIVE',
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    });

    const updated = await updateOrganisation(deps, 'carol', acme.id, { name: 'Via project owner' });
    expect(updated.name).toBe('Via project owner');
  });

  it('denies a project-level MEMBER (non-OWNER) from updating the organisation', async () => {
    const acme = await createOrganisation(deps, 'alice', { name: 'Acme', slug: 'acme' });

    await deps.memberships.create({
      id: randomUUID() as Membership['id'],
      organisationId: acme.id,
      projectId: randomUUID() as Membership['projectId'],
      principalId: 'dave',
      role: 'MEMBER',
      status: 'ACTIVE',
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    });

    await expect(
      updateOrganisation(deps, 'dave', acme.id, { name: 'Should fail' }),
    ).rejects.toThrow(ForbiddenError);
  });

  describe('organisation-level membership (DEVOS-254)', () => {
    it('lets an OWNER add an org-level member, and denies a non-OWNER', async () => {
      const acme = await createOrganisation(deps, 'alice', { name: 'Acme', slug: 'acme' });

      const membership = await addOrganisationMember(deps, 'alice', acme.id, {
        principalId: 'bob',
        role: 'MEMBER',
      });
      expect(membership).toMatchObject({
        organisationId: acme.id,
        projectId: null,
        role: 'MEMBER',
      });

      const members = await listOrganisationMembers(deps, 'alice', acme.id);
      expect(members.map((m) => m.principalId)).toContain('bob');

      await expect(
        addOrganisationMember(deps, 'bob', acme.id, { principalId: 'carol', role: 'MEMBER' }),
      ).rejects.toThrow(ForbiddenError);

      const audit = await deps.auditRecords.listForOrganisation(acme.id);
      expect(audit).toContainEqual(expect.objectContaining({ action: 'membership.added' }));
    });

    it('rejects adding a principal who is already an org-level member', async () => {
      const acme = await createOrganisation(deps, 'alice', { name: 'Acme', slug: 'acme' });
      await addOrganisationMember(deps, 'alice', acme.id, { principalId: 'bob', role: 'MEMBER' });

      await expect(
        addOrganisationMember(deps, 'alice', acme.id, { principalId: 'bob', role: 'OWNER' }),
      ).rejects.toThrow(ValidationError);
    });

    it('changes an org-level member role and audits it', async () => {
      const acme = await createOrganisation(deps, 'alice', { name: 'Acme', slug: 'acme' });
      const bob = await addOrganisationMember(deps, 'alice', acme.id, {
        principalId: 'bob',
        role: 'MEMBER',
      });

      const updated = await changeOrganisationMemberRole(deps, 'alice', acme.id, bob.id, 'OWNER');
      expect(updated.role).toBe('OWNER');

      const audit = await deps.auditRecords.listForOrganisation(acme.id);
      expect(audit).toContainEqual(expect.objectContaining({ action: 'membership.role_changed' }));
    });

    it('removes an org-level member and audits it', async () => {
      const acme = await createOrganisation(deps, 'alice', { name: 'Acme', slug: 'acme' });
      const bob = await addOrganisationMember(deps, 'alice', acme.id, {
        principalId: 'bob',
        role: 'MEMBER',
      });

      await removeOrganisationMember(deps, 'alice', acme.id, bob.id);

      const members = await listOrganisationMembers(deps, 'alice', acme.id);
      expect(members.map((m) => m.principalId)).not.toContain('bob');

      const audit = await deps.auditRecords.listForOrganisation(acme.id);
      expect(audit).toContainEqual(expect.objectContaining({ action: 'membership.removed' }));
    });

    it('refuses to remove or demote the last org-level OWNER', async () => {
      const acme = await createOrganisation(deps, 'alice', { name: 'Acme', slug: 'acme' });
      const members = await listOrganisationMembers(deps, 'alice', acme.id);
      const owner = members.find((m) => m.principalId === 'alice')!;

      await expect(removeOrganisationMember(deps, 'alice', acme.id, owner.id)).rejects.toThrow(
        ValidationError,
      );
      await expect(
        changeOrganisationMemberRole(deps, 'alice', acme.id, owner.id, 'MEMBER'),
      ).rejects.toThrow(ValidationError);
    });

    it('allows demoting an OWNER when another org-level OWNER still exists', async () => {
      const acme = await createOrganisation(deps, 'alice', { name: 'Acme', slug: 'acme' });
      const bob = await addOrganisationMember(deps, 'alice', acme.id, {
        principalId: 'bob',
        role: 'OWNER',
      });

      const updated = await changeOrganisationMemberRole(deps, 'alice', acme.id, bob.id, 'MEMBER');
      expect(updated.role).toBe('MEMBER');
    });
  });
});
