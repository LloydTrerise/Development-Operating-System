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
import { transferOrganisationOwnership } from '../src/organisations/transfer-organisation-ownership.js';
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
    setOwnerPrincipalId: async (id, ownerPrincipalId, updatedAt) => {
      const existing = organisations.get(id);
      if (!existing) return;
      organisations.set(id, { ...existing, ownerPrincipalId, updatedAt });
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

  it('creates an organisation, makes the creator its owner and an org-level ORGANISATION_ADMIN (DEVOS-290)', async () => {
    const organisation = await createOrganisation(deps, 'alice', {
      name: 'Acme Corp',
      slug: 'acme-corp',
    });

    expect(organisation).toMatchObject({
      name: 'Acme Corp',
      slug: 'acme-corp',
      status: 'ACTIVE',
      ownerPrincipalId: 'alice',
    });

    const memberships = await deps.memberships.listForPrincipal('alice');
    expect(memberships).toContainEqual(
      expect.objectContaining({
        organisationId: organisation.id,
        projectId: null,
        role: 'ORGANISATION_ADMIN',
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

  it('allows the org-level ORGANISATION_ADMIN to update the organisation, denies a non-member', async () => {
    const acme = await createOrganisation(deps, 'alice', { name: 'Acme', slug: 'acme' });

    const updated = await updateOrganisation(deps, 'alice', acme.id, { name: 'Acme Renamed' });
    expect(updated.name).toBe('Acme Renamed');

    await expect(
      updateOrganisation(deps, 'mallory', acme.id, { name: 'Should fail' }),
    ).rejects.toThrow(NotFoundError);
  });

  it('denies a project-level OWNER with no org-level membership from updating the organisation (DEVOS-309)', async () => {
    const acme = await createOrganisation(deps, 'alice', { name: 'Acme', slug: 'acme' });

    // DEVOS-309 (Sprint 51 reconciliation): this used to be a deliberate,
    // tested Sprint 39 (DEVOS-254) fallback for a real gap at the time (most
    // organisations had no org-level membership row at all). That gap no
    // longer exists post-DEVOS-290 — every organisation is guaranteed a real
    // org-level ORGANISATION_ADMIN row — so a plain project OWNER must no
    // longer be able to reach organisation-admin authority just by owning
    // one project; see `resolveOrganisationAdminMembership`'s own doc
    // comment for the full rationale.
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

    await expect(
      updateOrganisation(deps, 'carol', acme.id, { name: 'Via project owner' }),
    ).rejects.toThrow(NotFoundError);
  });

  it('denies a project-level MEMBER (non-OWNER) with no org-level membership from updating the organisation', async () => {
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

    // DEVOS-309: same as the project-level OWNER case above — no org-level
    // membership row means no organisation-admin standing at all, reported
    // as NotFoundError (matching every other "not a member" case in this
    // codebase), not a role-specific ForbiddenError.
    await expect(
      updateOrganisation(deps, 'dave', acme.id, { name: 'Should fail' }),
    ).rejects.toThrow(NotFoundError);
  });

  it('denies an org-level ORGANISATION_ADMIN from a different organisation (tenant isolation)', async () => {
    const acme = await createOrganisation(deps, 'alice', { name: 'Acme', slug: 'acme' });
    await createOrganisation(deps, 'erin', { name: 'Globex', slug: 'globex' });

    await expect(
      updateOrganisation(deps, 'erin', acme.id, { name: 'Should fail' }),
    ).rejects.toThrow(NotFoundError);
  });

  describe('organisation-level membership (DEVOS-254, revised by DEVOS-290)', () => {
    it('lets an ORGANISATION_ADMIN add a co-admin, and denies a non-admin', async () => {
      const acme = await createOrganisation(deps, 'alice', { name: 'Acme', slug: 'acme' });

      const membership = await addOrganisationMember(deps, 'alice', acme.id, {
        principalId: 'bob',
        role: 'ORGANISATION_ADMIN',
      });
      expect(membership).toMatchObject({
        organisationId: acme.id,
        projectId: null,
        role: 'ORGANISATION_ADMIN',
      });

      const members = await listOrganisationMembers(deps, 'alice', acme.id);
      expect(members.map((m) => m.principalId)).toContain('bob');

      await expect(
        addOrganisationMember(deps, 'mallory', acme.id, {
          principalId: 'carol',
          role: 'ORGANISATION_ADMIN',
        }),
      ).rejects.toThrow(NotFoundError);

      const audit = await deps.auditRecords.listForOrganisation(acme.id);
      expect(audit).toContainEqual(expect.objectContaining({ action: 'membership.added' }));
    });

    it('denies a project-level OWNER with no org-level membership from adding an org-level admin (DEVOS-309)', async () => {
      const acme = await createOrganisation(deps, 'alice', { name: 'Acme', slug: 'acme' });

      // The specific privilege-escalation shape DEVOS-309 closed: a plain
      // project OWNER self-granting ORGANISATION_ADMIN would gain authority
      // over every project in the organisation via `resolveMembership`'s
      // own org-level fallback — never legitimate, since this principal was
      // never given any organisation-level standing.
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

      await expect(
        addOrganisationMember(deps, 'carol', acme.id, {
          principalId: 'carol',
          role: 'ORGANISATION_ADMIN',
        }),
      ).rejects.toThrow(NotFoundError);
    });

    it('rejects any org-level role other than ORGANISATION_ADMIN (decision §9.3 drops org-level MEMBER)', async () => {
      const acme = await createOrganisation(deps, 'alice', { name: 'Acme', slug: 'acme' });

      await expect(
        addOrganisationMember(deps, 'alice', acme.id, { principalId: 'bob', role: 'MEMBER' }),
      ).rejects.toThrow(ValidationError);
      await expect(
        addOrganisationMember(deps, 'alice', acme.id, { principalId: 'bob', role: 'OWNER' }),
      ).rejects.toThrow(ValidationError);
    });

    it('rejects adding a principal who is already an org-level member', async () => {
      const acme = await createOrganisation(deps, 'alice', { name: 'Acme', slug: 'acme' });
      await addOrganisationMember(deps, 'alice', acme.id, {
        principalId: 'bob',
        role: 'ORGANISATION_ADMIN',
      });

      await expect(
        addOrganisationMember(deps, 'alice', acme.id, {
          principalId: 'bob',
          role: 'ORGANISATION_ADMIN',
        }),
      ).rejects.toThrow(ValidationError);
    });

    it('removes a co-admin and audits it', async () => {
      const acme = await createOrganisation(deps, 'alice', { name: 'Acme', slug: 'acme' });
      const bob = await addOrganisationMember(deps, 'alice', acme.id, {
        principalId: 'bob',
        role: 'ORGANISATION_ADMIN',
      });

      await removeOrganisationMember(deps, 'alice', acme.id, bob.id);

      const members = await listOrganisationMembers(deps, 'alice', acme.id);
      expect(members.map((m) => m.principalId)).not.toContain('bob');

      const audit = await deps.auditRecords.listForOrganisation(acme.id);
      expect(audit).toContainEqual(expect.objectContaining({ action: 'membership.removed' }));
    });

    it('refuses to remove the last org-level ORGANISATION_ADMIN', async () => {
      const acme = await createOrganisation(deps, 'alice', { name: 'Acme', slug: 'acme' });
      const members = await listOrganisationMembers(deps, 'alice', acme.id);
      const admin = members.find((m) => m.principalId === 'alice')!;

      await expect(removeOrganisationMember(deps, 'alice', acme.id, admin.id)).rejects.toThrow(
        ValidationError,
      );
    });

    it('allows removing a co-admin who is not the current owner when another admin remains', async () => {
      const acme = await createOrganisation(deps, 'alice', { name: 'Acme', slug: 'acme' });
      const bob = await addOrganisationMember(deps, 'alice', acme.id, {
        principalId: 'bob',
        role: 'ORGANISATION_ADMIN',
      });

      await removeOrganisationMember(deps, 'alice', acme.id, bob.id);

      const members = await listOrganisationMembers(deps, 'alice', acme.id);
      expect(members.map((m) => m.principalId)).toEqual(['alice']);
    });

    it('refuses to remove the current owner even when another admin remains (DEVOS-290)', async () => {
      const acme = await createOrganisation(deps, 'alice', { name: 'Acme', slug: 'acme' });
      const alice = (await listOrganisationMembers(deps, 'alice', acme.id))[0]!;
      await addOrganisationMember(deps, 'alice', acme.id, {
        principalId: 'bob',
        role: 'ORGANISATION_ADMIN',
      });

      await expect(removeOrganisationMember(deps, 'alice', acme.id, alice.id)).rejects.toThrow(
        ValidationError,
      );
    });

    it('changeOrganisationMemberRole only accepts ORGANISATION_ADMIN, idempotently', async () => {
      const acme = await createOrganisation(deps, 'alice', { name: 'Acme', slug: 'acme' });
      const bob = await addOrganisationMember(deps, 'alice', acme.id, {
        principalId: 'bob',
        role: 'ORGANISATION_ADMIN',
      });

      const updated = await changeOrganisationMemberRole(
        deps,
        'alice',
        acme.id,
        bob.id,
        'ORGANISATION_ADMIN',
      );
      expect(updated.role).toBe('ORGANISATION_ADMIN');

      await expect(
        changeOrganisationMemberRole(deps, 'alice', acme.id, bob.id, 'MEMBER'),
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('organisation ownership transfer (DEVOS-290)', () => {
    it('lets the current owner transfer ownership to an existing co-admin', async () => {
      const acme = await createOrganisation(deps, 'alice', { name: 'Acme', slug: 'acme' });
      await addOrganisationMember(deps, 'alice', acme.id, {
        principalId: 'bob',
        role: 'ORGANISATION_ADMIN',
      });

      const updated = await transferOrganisationOwnership(deps, 'alice', acme.id, 'bob');
      expect(updated.ownerPrincipalId).toBe('bob');

      const audit = await deps.auditRecords.listForOrganisation(acme.id);
      expect(audit).toContainEqual(
        expect.objectContaining({ action: 'organisation.ownership_transferred' }),
      );
    });

    it('denies a transfer attempted by anyone other than the current owner', async () => {
      const acme = await createOrganisation(deps, 'alice', { name: 'Acme', slug: 'acme' });
      await addOrganisationMember(deps, 'alice', acme.id, {
        principalId: 'bob',
        role: 'ORGANISATION_ADMIN',
      });

      await expect(transferOrganisationOwnership(deps, 'bob', acme.id, 'bob')).rejects.toThrow(
        ForbiddenError,
      );
    });

    it('rejects transferring ownership to a principal who is not already a co-admin', async () => {
      const acme = await createOrganisation(deps, 'alice', { name: 'Acme', slug: 'acme' });

      await expect(transferOrganisationOwnership(deps, 'alice', acme.id, 'carol')).rejects.toThrow(
        ValidationError,
      );
    });

    it('lets the new owner remove the former owner after a transfer', async () => {
      const acme = await createOrganisation(deps, 'alice', { name: 'Acme', slug: 'acme' });
      const alice = (await listOrganisationMembers(deps, 'alice', acme.id))[0]!;
      await addOrganisationMember(deps, 'alice', acme.id, {
        principalId: 'bob',
        role: 'ORGANISATION_ADMIN',
      });
      await transferOrganisationOwnership(deps, 'alice', acme.id, 'bob');

      await removeOrganisationMember(deps, 'bob', acme.id, alice.id);

      const members = await listOrganisationMembers(deps, 'bob', acme.id);
      expect(members.map((m) => m.principalId)).toEqual(['bob']);
    });
  });
});
