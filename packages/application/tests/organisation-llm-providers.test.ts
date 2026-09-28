import { randomUUID } from 'node:crypto';
import type { OrganisationId, OrganisationLlmProviderId } from '@devos/contracts';
import type {
  AuditRecord,
  AuditRecordRepository,
  Membership,
  MembershipRepository,
  Organisation,
  OrganisationLlmProvider,
  OrganisationLlmProviderRepository,
  OrganisationRepository,
} from '@devos/domain';
import { beforeEach, describe, expect, it } from 'vitest';
import { createOrganisationLlmProvider } from '../src/organisations/create-organisation-llm-provider.js';
import { deleteOrganisationLlmProvider } from '../src/organisations/delete-organisation-llm-provider.js';
import type { OrganisationLlmProviderUseCaseDeps } from '../src/organisations/deps.js';
import { listOrganisationLlmProviders } from '../src/organisations/list-organisation-llm-providers.js';
import { reorderOrganisationLlmProviders } from '../src/organisations/reorder-organisation-llm-providers.js';
import { updateOrganisationLlmProvider } from '../src/organisations/update-organisation-llm-provider.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../src/errors.js';

const ORG_ID = randomUUID() as OrganisationId;
const OTHER_ORG_ID = randomUUID() as OrganisationId;

function createInMemoryDeps(): OrganisationLlmProviderUseCaseDeps {
  const organisations = new Map<string, Organisation>();
  const memberships = new Map<string, Membership>();
  const providers = new Map<string, OrganisationLlmProvider>();
  const auditRecordsStore: AuditRecord[] = [];

  const now = new Date().toISOString();

  organisations.set(ORG_ID, {
    id: ORG_ID,
    name: 'Acme',
    slug: 'acme',
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  });
  organisations.set(OTHER_ORG_ID, {
    id: OTHER_ORG_ID,
    name: 'Other',
    slug: 'other',
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  });

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
    updateRole: async () => {},
    remove: async (id) => {
      memberships.delete(id);
    },
  };

  const organisationLlmProviderRepository: OrganisationLlmProviderRepository = {
    getById: async (id) => providers.get(id) ?? null,
    listForOrganisation: async (organisationId) =>
      [...providers.values()]
        .filter((row) => row.organisationId === organisationId)
        .sort((a, b) => a.priority - b.priority),
    create: async (provider) => {
      providers.set(provider.id, provider);
    },
    update: async (id, changes, updatedAt) => {
      const existing = providers.get(id);
      if (!existing) return;
      providers.set(id, { ...existing, ...changes, updatedAt });
    },
    delete: async (id) => {
      providers.delete(id);
    },
  };

  const reorder = async (
    organisationId: OrganisationId,
    orderedIds: OrganisationLlmProviderId[],
    updatedAt: string,
  ): Promise<void> => {
    orderedIds.forEach((id, index) => {
      const existing = providers.get(id);
      if (existing && existing.organisationId === organisationId) {
        providers.set(id, { ...existing, priority: index + 1, updatedAt });
      }
    });
  };

  const auditRecords: AuditRecordRepository = {
    create: async (record) => {
      auditRecordsStore.push(record);
    },
    listForProject: async (projectId) => auditRecordsStore.filter((r) => r.projectId === projectId),
    listForOrganisation: async (organisationId) =>
      auditRecordsStore.filter((r) => r.organisationId === organisationId),
  };

  return {
    organisations: organisationRepository,
    memberships: membershipRepository,
    organisationLlmProviders: organisationLlmProviderRepository,
    reorderOrganisationLlmProviders: reorder,
    auditRecords,
  };
}

async function addMembership(
  deps: OrganisationLlmProviderUseCaseDeps,
  principalId: string,
  role: Membership['role'],
): Promise<void> {
  const now = new Date().toISOString();
  await deps.memberships.create({
    id: randomUUID() as Membership['id'],
    organisationId: ORG_ID,
    projectId: null,
    principalId,
    role,
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  });
}

describe('organisation LLM provider use cases (DEVOS-319/320/321)', () => {
  let deps: OrganisationLlmProviderUseCaseDeps;

  beforeEach(async () => {
    deps = createInMemoryDeps();
    await addMembership(deps, 'admin', 'ORGANISATION_ADMIN');
    await addMembership(deps, 'member', 'MEMBER');
  });

  it('lists the (empty) provider list for any org member', async () => {
    expect(await listOrganisationLlmProviders(deps, 'member', ORG_ID)).toEqual([]);
  });

  it('rejects listing for a non-member', async () => {
    await expect(listOrganisationLlmProviders(deps, 'stranger', ORG_ID)).rejects.toThrow(
      NotFoundError,
    );
  });

  it('creates a provider, auto-assigning the next priority, gated to an org admin', async () => {
    await expect(
      createOrganisationLlmProvider(deps, 'member', ORG_ID, {
        provider: 'gemini',
        credentialReference: 'LLM_PROVIDER_ACME_GEMINI',
      }),
    ).rejects.toThrow(ForbiddenError);

    const first = await createOrganisationLlmProvider(deps, 'admin', ORG_ID, {
      provider: 'gemini',
      credentialReference: 'LLM_PROVIDER_ACME_GEMINI',
    });
    expect(first.priority).toBe(1);
    expect(first.status).toBe('ACTIVE');

    const second = await createOrganisationLlmProvider(deps, 'admin', ORG_ID, {
      provider: 'anthropic',
      credentialReference: 'LLM_PROVIDER_ACME_ANTHROPIC',
    });
    expect(second.priority).toBe(2);

    const listed = await listOrganisationLlmProviders(deps, 'admin', ORG_ID);
    expect(listed.map((row) => row.provider)).toEqual(['gemini', 'anthropic']);
  });

  it('rejects an unregistered provider key', async () => {
    await expect(
      createOrganisationLlmProvider(deps, 'admin', ORG_ID, {
        provider: 'openai',
        credentialReference: 'LLM_PROVIDER_ACME_OPENAI',
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('updates credentialReference/status, gated to an org admin, never touching priority', async () => {
    const provider = await createOrganisationLlmProvider(deps, 'admin', ORG_ID, {
      provider: 'gemini',
      credentialReference: 'LLM_PROVIDER_ACME_GEMINI',
    });

    await expect(
      updateOrganisationLlmProvider(deps, 'member', ORG_ID, provider.id, { status: 'DISABLED' }),
    ).rejects.toThrow(ForbiddenError);

    const updated = await updateOrganisationLlmProvider(deps, 'admin', ORG_ID, provider.id, {
      status: 'DISABLED',
    });
    expect(updated.status).toBe('DISABLED');
    expect(updated.priority).toBe(1);
  });

  it('rejects updating a provider that belongs to a different organisation', async () => {
    const provider = await createOrganisationLlmProvider(deps, 'admin', ORG_ID, {
      provider: 'gemini',
      credentialReference: 'LLM_PROVIDER_ACME_GEMINI',
    });
    await addMembership(deps, 'other-admin', 'ORGANISATION_ADMIN');
    // Re-home the membership onto the other organisation for this check.
    await deps.memberships.create({
      id: randomUUID() as Membership['id'],
      organisationId: OTHER_ORG_ID,
      projectId: null,
      principalId: 'other-admin',
      role: 'ORGANISATION_ADMIN',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await expect(
      updateOrganisationLlmProvider(deps, 'other-admin', OTHER_ORG_ID, provider.id, {
        status: 'DISABLED',
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('deletes a provider, gated to an org admin', async () => {
    const provider = await createOrganisationLlmProvider(deps, 'admin', ORG_ID, {
      provider: 'gemini',
      credentialReference: 'LLM_PROVIDER_ACME_GEMINI',
    });

    await expect(
      deleteOrganisationLlmProvider(deps, 'member', ORG_ID, provider.id),
    ).rejects.toThrow(ForbiddenError);

    await deleteOrganisationLlmProvider(deps, 'admin', ORG_ID, provider.id);
    expect(await listOrganisationLlmProviders(deps, 'admin', ORG_ID)).toEqual([]);
  });

  it('reorders the full list, gated to an org admin, and rejects a partial/mismatched set', async () => {
    const first = await createOrganisationLlmProvider(deps, 'admin', ORG_ID, {
      provider: 'gemini',
      credentialReference: 'LLM_PROVIDER_ACME_GEMINI',
    });
    const second = await createOrganisationLlmProvider(deps, 'admin', ORG_ID, {
      provider: 'anthropic',
      credentialReference: 'LLM_PROVIDER_ACME_ANTHROPIC',
    });

    await expect(
      reorderOrganisationLlmProviders(deps, 'member', ORG_ID, [second.id, first.id]),
    ).rejects.toThrow(ForbiddenError);

    await expect(
      reorderOrganisationLlmProviders(deps, 'admin', ORG_ID, [second.id]),
    ).rejects.toThrow(ValidationError);

    await reorderOrganisationLlmProviders(deps, 'admin', ORG_ID, [second.id, first.id]);

    const reordered = await listOrganisationLlmProviders(deps, 'admin', ORG_ID);
    expect(reordered.map((row) => row.provider)).toEqual(['anthropic', 'gemini']);
  });

  it('audits every write action', async () => {
    const provider = await createOrganisationLlmProvider(deps, 'admin', ORG_ID, {
      provider: 'gemini',
      credentialReference: 'LLM_PROVIDER_ACME_GEMINI',
    });
    await updateOrganisationLlmProvider(deps, 'admin', ORG_ID, provider.id, {
      status: 'DISABLED',
    });
    await deleteOrganisationLlmProvider(deps, 'admin', ORG_ID, provider.id);

    const records = await deps.auditRecords.listForOrganisation(ORG_ID);
    expect(records.map((r) => r.action)).toEqual([
      'organisation_llm_provider.created',
      'organisation_llm_provider.updated',
      'organisation_llm_provider.deleted',
    ]);
  });
});
