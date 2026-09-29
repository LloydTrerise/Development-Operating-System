import { randomUUID } from 'node:crypto';
import type {
  OrganisationId,
  OrganisationLlmProviderId,
  PolicyId,
  ProjectId,
  ProjectTypeId,
} from '@devos/contracts';
import type {
  Membership,
  MembershipRepository,
  Organisation,
  OrganisationLlmProvider,
  OrganisationLlmProviderRepository,
  OrganisationRepository,
  Policy,
  PolicyRepository,
  Project,
  ProjectRepository,
} from '@devos/domain';
import { beforeEach, describe, expect, it } from 'vitest';
import { NotFoundError, OrganisationNotInitialisedError } from '../src/errors.js';
import type { OrganisationInitialisationStatusDeps } from '../src/organisations/deps.js';
import { requireOrganisationInitialised } from '../src/organisations/require-organisation-initialised.js';

const MEMBER_PRINCIPAL_ID = 'alice';

/**
 * DEVOS-337 (Sprint 59, candidate epic E31 part 4): mirrors
 * `organisation-initialisation-status.test.ts`'s own fixture shape exactly
 * (Sprint 58) — this file adds the one field that sprint's fixture never
 * needed, `initialisationEnforcementExemptAt` (DEVOS-339), configurable per
 * organisation so both the enforced and the grandfathered path are real,
 * exercised behavior, not assumed.
 */
function createDeps(
  organisationId: OrganisationId,
  options: { exempt?: boolean } = {},
): OrganisationInitialisationStatusDeps {
  const organisations = new Map<string, Organisation>();
  const memberships = new Map<string, Membership>();
  const projects = new Map<string, Project>();
  const llmProviders = new Map<string, OrganisationLlmProvider>();
  const policies = new Map<string, Policy>();

  organisations.set(organisationId, {
    id: organisationId,
    name: 'Acme',
    slug: 'acme',
    status: 'ACTIVE',
    ...(options.exempt === true
      ? { initialisationEnforcementExemptAt: new Date(0).toISOString() }
      : {}),
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  });

  const membership: Membership = {
    id: randomUUID() as Membership['id'],
    organisationId,
    projectId: null,
    principalId: MEMBER_PRINCIPAL_ID,
    role: 'ORGANISATION_ADMIN',
    status: 'ACTIVE',
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
  memberships.set(membership.id, membership);

  const organisationRepository: OrganisationRepository = {
    getById: async (id) => organisations.get(id) ?? null,
    list: async () => [...organisations.values()],
    create: async (organisation) => {
      organisations.set(organisation.id, organisation);
    },
    update: async () => {},
    setOwnerPrincipalId: async () => {},
  };

  const membershipRepository: MembershipRepository = {
    getById: async (id) => memberships.get(id) ?? null,
    getForPrincipalAndProject: async () => null,
    listForPrincipal: async (principalId) =>
      [...memberships.values()].filter((m) => m.principalId === principalId),
    listForProject: async () => [],
    listForOrganisation: async (id) =>
      [...memberships.values()].filter((m) => m.organisationId === id),
    create: async (m) => {
      memberships.set(m.id, m);
    },
    updateRole: async () => {},
    remove: async () => {},
  };

  const projectRepository: ProjectRepository = {
    getById: async (id) => projects.get(id) ?? null,
    listForOrganisation: async (id) =>
      [...projects.values()].filter((p) => p.organisationId === id),
    create: async (project) => {
      projects.set(project.id, project);
    },
    update: async () => {},
  };

  const organisationLlmProviderRepository: OrganisationLlmProviderRepository = {
    getById: async (id) => llmProviders.get(id) ?? null,
    listForOrganisation: async (id) =>
      [...llmProviders.values()].filter((p) => p.organisationId === id),
    create: async (provider) => {
      llmProviders.set(provider.id, provider);
    },
    update: async () => {},
    delete: async (id) => {
      llmProviders.delete(id);
    },
  };

  const policyRepository: PolicyRepository = {
    getById: async (id) => policies.get(id) ?? null,
    getByProjectAndKeyAndVersion: async () => null,
    getLatestForProjectAndKey: async () => null,
    listForProject: async () => [],
    getLatestForOrganisationAndKey: async () => null,
    listForOrganisation: async (id) =>
      [...policies.values()].filter((p) => p.organisationId === id && !p.projectId),
    create: async (policy) => {
      policies.set(policy.id, policy);
    },
    publish: async () => {},
  };

  return {
    organisations: organisationRepository,
    memberships: membershipRepository,
    projects: projectRepository,
    organisationLlmProviders: organisationLlmProviderRepository,
    policies: policyRepository,
  };
}

function makeProject(organisationId: OrganisationId): Project {
  return {
    id: randomUUID() as ProjectId,
    organisationId,
    projectTypeId: randomUUID() as ProjectTypeId,
    name: 'Project',
    slug: 'project',
    status: 'ACTIVE',
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
}

function makeLlmProvider(organisationId: OrganisationId): OrganisationLlmProvider {
  return {
    id: randomUUID() as OrganisationLlmProviderId,
    organisationId,
    provider: 'gemini',
    credentialReference: 'ref',
    priority: 1,
    status: 'ACTIVE',
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
}

function makeOrganisationWidePolicy(organisationId: OrganisationId): Policy {
  return {
    id: randomUUID() as PolicyId,
    organisationId,
    key: 'default',
    version: 1,
    status: 'DRAFT',
    definition: {},
    createdBy: MEMBER_PRINCIPAL_ID,
    createdAt: new Date(0).toISOString(),
  };
}

describe('requireOrganisationInitialised (DEVOS-337, Sprint 59)', () => {
  let organisationId: OrganisationId;

  beforeEach(() => {
    organisationId = randomUUID() as OrganisationId;
  });

  it('resolves silently for an organisation that has completed all three requirements', async () => {
    const deps = createDeps(organisationId);
    await deps.projects.create(makeProject(organisationId));
    await deps.organisationLlmProviders.create(makeLlmProvider(organisationId));
    await deps.policies.create(makeOrganisationWidePolicy(organisationId));

    await expect(
      requireOrganisationInitialised(deps, MEMBER_PRINCIPAL_ID, organisationId),
    ).resolves.toBeUndefined();
  });

  it('throws OrganisationNotInitialisedError listing all three requirements when none are met', async () => {
    const deps = createDeps(organisationId);

    await expect(
      requireOrganisationInitialised(deps, MEMBER_PRINCIPAL_ID, organisationId),
    ).rejects.toThrow(OrganisationNotInitialisedError);

    try {
      await requireOrganisationInitialised(deps, MEMBER_PRINCIPAL_ID, organisationId);
      expect.unreachable('expected requireOrganisationInitialised to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(OrganisationNotInitialisedError);
      expect((error as OrganisationNotInitialisedError).missingRequirements).toEqual([
        'hasProjectType',
        'hasLlmProvider',
        'hasPolicy',
      ]);
    }
  });

  it('lists exactly the requirements still outstanding when only some are met', async () => {
    const deps = createDeps(organisationId);
    await deps.projects.create(makeProject(organisationId));

    try {
      await requireOrganisationInitialised(deps, MEMBER_PRINCIPAL_ID, organisationId);
      expect.unreachable('expected requireOrganisationInitialised to throw');
    } catch (error) {
      expect((error as OrganisationNotInitialisedError).missingRequirements).toEqual([
        'hasLlmProvider',
        'hasPolicy',
      ]);
    }
  });

  it('resolves silently for a grandfathered (exempt) organisation regardless of its real status', async () => {
    const deps = createDeps(organisationId, { exempt: true });

    await expect(
      requireOrganisationInitialised(deps, MEMBER_PRINCIPAL_ID, organisationId),
    ).resolves.toBeUndefined();
  });

  it('rejects a non-member of a non-exempt organisation, masked as not found (via the reused status computation)', async () => {
    const deps = createDeps(organisationId);

    await expect(requireOrganisationInitialised(deps, 'mallory', organisationId)).rejects.toThrow(
      NotFoundError,
    );
  });

  it('rejects a nonexistent organisation the same way', async () => {
    const deps = createDeps(organisationId);

    await expect(
      requireOrganisationInitialised(deps, MEMBER_PRINCIPAL_ID, randomUUID() as OrganisationId),
    ).rejects.toThrow(NotFoundError);
  });
});
