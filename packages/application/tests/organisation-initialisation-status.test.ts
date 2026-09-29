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
import type { OrganisationInitialisationStatusDeps } from '../src/organisations/deps.js';
import { getOrganisationInitialisationStatus } from '../src/organisations/get-organisation-initialisation-status.js';
import { NotFoundError } from '../src/errors.js';

const ORG_ID = randomUUID() as OrganisationId;
const OTHER_ORG_ID = randomUUID() as OrganisationId;
const MEMBER_PRINCIPAL_ID = 'alice';
const NON_MEMBER_PRINCIPAL_ID = 'mallory';

function createInMemoryDeps(): OrganisationInitialisationStatusDeps {
  const organisations = new Map<string, Organisation>();
  const memberships = new Map<string, Membership>();
  const projects = new Map<string, Project>();
  const llmProviders = new Map<string, OrganisationLlmProvider>();
  const policies = new Map<string, Policy>();

  organisations.set(ORG_ID, {
    id: ORG_ID,
    name: 'Acme',
    slug: 'acme',
    status: 'ACTIVE',
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  });
  organisations.set(OTHER_ORG_ID, {
    id: OTHER_ORG_ID,
    name: 'Other',
    slug: 'other',
    status: 'ACTIVE',
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  });

  const membership: Membership = {
    id: randomUUID() as Membership['id'],
    organisationId: ORG_ID,
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
    listForOrganisation: async (organisationId) =>
      [...memberships.values()].filter((m) => m.organisationId === organisationId),
    create: async (m) => {
      memberships.set(m.id, m);
    },
    updateRole: async () => {},
    remove: async () => {},
  };

  const projectRepository: ProjectRepository = {
    getById: async (id) => projects.get(id) ?? null,
    listForOrganisation: async (organisationId) =>
      [...projects.values()].filter((p) => p.organisationId === organisationId),
    create: async (project) => {
      projects.set(project.id, project);
    },
    update: async () => {},
  };

  const organisationLlmProviderRepository: OrganisationLlmProviderRepository = {
    getById: async (id) => llmProviders.get(id) ?? null,
    listForOrganisation: async (organisationId) =>
      [...llmProviders.values()].filter((p) => p.organisationId === organisationId),
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
    // Mirrors `packages/database/src/repositories/policies.ts:79-89`'s own
    // `WHERE project_id IS NULL` filter exactly.
    listForOrganisation: async (organisationId) =>
      [...policies.values()].filter((p) => p.organisationId === organisationId && !p.projectId),
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

function makeProjectScopedPolicy(organisationId: OrganisationId, projectId: ProjectId): Policy {
  return {
    ...makeOrganisationWidePolicy(organisationId),
    id: randomUUID() as PolicyId,
    projectId,
  };
}

describe('getOrganisationInitialisationStatus (DEVOS-333/334, Sprint 58)', () => {
  let deps: OrganisationInitialisationStatusDeps;

  beforeEach(() => {
    deps = createInMemoryDeps();
  });

  it('reports all three requirements false and initialised false for a freshly created organisation', async () => {
    const status = await getOrganisationInitialisationStatus(deps, MEMBER_PRINCIPAL_ID, ORG_ID);
    expect(status).toEqual({
      organisationId: ORG_ID,
      hasProjectType: false,
      hasLlmProvider: false,
      hasPolicy: false,
      initialised: false,
    });
  });

  it('flips hasProjectType once a Project exists, independent of the other two', async () => {
    await deps.projects.create(makeProject(ORG_ID));
    const status = await getOrganisationInitialisationStatus(deps, MEMBER_PRINCIPAL_ID, ORG_ID);
    expect(status).toMatchObject({
      hasProjectType: true,
      hasLlmProvider: false,
      hasPolicy: false,
      initialised: false,
    });
  });

  it('flips hasLlmProvider once an organisation_llm_providers row exists', async () => {
    await deps.organisationLlmProviders.create(makeLlmProvider(ORG_ID));
    const status = await getOrganisationInitialisationStatus(deps, MEMBER_PRINCIPAL_ID, ORG_ID);
    expect(status).toMatchObject({
      hasProjectType: false,
      hasLlmProvider: true,
      hasPolicy: false,
      initialised: false,
    });
  });

  it('flips hasPolicy once an organisation-wide Policy exists, but not from a project-scoped one', async () => {
    const project = makeProject(ORG_ID);
    await deps.projects.create(project);
    await deps.policies.create(makeProjectScopedPolicy(ORG_ID, project.id));

    const beforeOrgWide = await getOrganisationInitialisationStatus(
      deps,
      MEMBER_PRINCIPAL_ID,
      ORG_ID,
    );
    expect(beforeOrgWide.hasPolicy).toBe(false);

    await deps.policies.create(makeOrganisationWidePolicy(ORG_ID));
    const afterOrgWide = await getOrganisationInitialisationStatus(
      deps,
      MEMBER_PRINCIPAL_ID,
      ORG_ID,
    );
    expect(afterOrgWide.hasPolicy).toBe(true);
  });

  it('reports initialised true only once all three requirements are met, not before', async () => {
    await deps.projects.create(makeProject(ORG_ID));
    await deps.organisationLlmProviders.create(makeLlmProvider(ORG_ID));
    const stillNotInitialised = await getOrganisationInitialisationStatus(
      deps,
      MEMBER_PRINCIPAL_ID,
      ORG_ID,
    );
    expect(stillNotInitialised.initialised).toBe(false);

    await deps.policies.create(makeOrganisationWidePolicy(ORG_ID));
    const initialised = await getOrganisationInitialisationStatus(
      deps,
      MEMBER_PRINCIPAL_ID,
      ORG_ID,
    );
    expect(initialised).toEqual({
      organisationId: ORG_ID,
      hasProjectType: true,
      hasLlmProvider: true,
      hasPolicy: true,
      initialised: true,
    });
  });

  it('never mixes one organisation\'s requirements into another\'s status', async () => {
    await deps.projects.create(makeProject(ORG_ID));
    await deps.organisationLlmProviders.create(makeLlmProvider(ORG_ID));
    await deps.policies.create(makeOrganisationWidePolicy(ORG_ID));

    const otherOrgMembership: Membership = {
      id: randomUUID() as Membership['id'],
      organisationId: OTHER_ORG_ID,
      projectId: null,
      principalId: MEMBER_PRINCIPAL_ID,
      role: 'ORGANISATION_ADMIN',
      status: 'ACTIVE',
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    };
    await deps.memberships.create(otherOrgMembership);

    const otherStatus = await getOrganisationInitialisationStatus(
      deps,
      MEMBER_PRINCIPAL_ID,
      OTHER_ORG_ID,
    );
    expect(otherStatus.initialised).toBe(false);
  });

  it('rejects a principal with no membership in the organisation, masked as not found', async () => {
    await expect(
      getOrganisationInitialisationStatus(deps, NON_MEMBER_PRINCIPAL_ID, ORG_ID),
    ).rejects.toThrow(NotFoundError);
  });

  it('rejects a nonexistent organisation the same way', async () => {
    await expect(
      getOrganisationInitialisationStatus(
        deps,
        MEMBER_PRINCIPAL_ID,
        randomUUID() as OrganisationId,
      ),
    ).rejects.toThrow(NotFoundError);
  });
});
