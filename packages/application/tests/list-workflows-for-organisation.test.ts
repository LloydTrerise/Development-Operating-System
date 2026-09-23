import { randomUUID } from 'node:crypto';
import type { OrganisationId } from '@devos/contracts';
import type {
  Membership,
  MembershipRepository,
  Organisation,
  OrganisationRepository,
  SummarizeWorkflowRunStatusCountsForOrganisation,
  SummarizeWorkflowVersionsForDefinitions,
  WorkflowDefinition,
  WorkflowDefinitionRepository,
  WorkflowRunStatusCount,
  WorkflowVersionSummary,
} from '@devos/domain';
import { beforeEach, describe, expect, it } from 'vitest';
import { NotFoundError } from '../src/errors.js';
import type { WorkflowLibraryUseCaseDeps } from '../src/workflows/deps.js';
import { listWorkflowsForOrganisation } from '../src/workflows/list-workflows-for-organisation.js';

function createInMemoryDeps() {
  const organisationsStore = new Map<string, Organisation>();
  const membershipsStore = new Map<string, Membership>();
  const definitionsStore = new Map<string, WorkflowDefinition>();
  let versionSummaries: WorkflowVersionSummary[] = [];
  let runStatusCounts: WorkflowRunStatusCount[] = [];
  let summarizeVersionsCallCount = 0;
  let summarizeRunStatusCountsCallCount = 0;

  const organisations: OrganisationRepository = {
    getById: async (id) => organisationsStore.get(id) ?? null,
    list: async () => [...organisationsStore.values()],
    create: async (organisation) => {
      organisationsStore.set(organisation.id, organisation);
    },
    update: async () => {},
    setOwnerPrincipalId: async () => {},
  };

  const memberships: MembershipRepository = {
    getById: async (id) => membershipsStore.get(id) ?? null,
    getForPrincipalAndProject: async () => null,
    listForPrincipal: async (principalId) =>
      [...membershipsStore.values()].filter((m) => m.principalId === principalId),
    listForProject: async () => [],
    create: async (membership) => {
      membershipsStore.set(membership.id, membership);
    },
    updateRole: async () => {},
    remove: async () => {},
  };

  // The fake joins nothing (there's no Project store here) — the real
  // repository's own join to `projects` is a database-layer concern, not
  // this use case's. Every definition created in a test belongs to the
  // one organisation under test.
  const workflowDefinitions: WorkflowDefinitionRepository = {
    getById: async (id) => definitionsStore.get(id) ?? null,
    getByProjectAndKey: async () => null,
    listForProject: async (projectId) =>
      [...definitionsStore.values()].filter((d) => d.projectId === projectId),
    create: async (definition) => {
      definitionsStore.set(definition.id, definition);
    },
    listForOrganisation: async () => [...definitionsStore.values()],
  };

  const summarizeVersionsForDefinitions: SummarizeWorkflowVersionsForDefinitions = async (ids) => {
    summarizeVersionsCallCount += 1;
    return versionSummaries.filter((summary) => ids.includes(summary.workflowDefinitionId));
  };

  const summarizeRunStatusCountsForOrganisation: SummarizeWorkflowRunStatusCountsForOrganisation =
    async () => {
      summarizeRunStatusCountsCallCount += 1;
      return runStatusCounts;
    };

  return {
    organisations,
    memberships,
    workflowDefinitions,
    summarizeVersionsForDefinitions,
    summarizeRunStatusCountsForOrganisation,
    setVersionSummaries: (rows: WorkflowVersionSummary[]) => {
      versionSummaries = rows;
    },
    setRunStatusCounts: (rows: WorkflowRunStatusCount[]) => {
      runStatusCounts = rows;
    },
    getSummarizeCallCounts: () => ({
      summarizeVersionsCallCount,
      summarizeRunStatusCountsCallCount,
    }),
  };
}

describe('listWorkflowsForOrganisation (Sprint 41 gap closure)', () => {
  let deps: ReturnType<typeof createInMemoryDeps> & WorkflowLibraryUseCaseDeps;
  const organisationId = randomUUID() as OrganisationId;

  beforeEach(async () => {
    deps = createInMemoryDeps();
    await deps.organisations.create({
      id: organisationId,
      name: 'Org',
      slug: 'org',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await deps.memberships.create({
      id: randomUUID() as Membership['id'],
      organisationId,
      projectId: null,
      principalId: 'alice',
      role: 'OWNER',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });

  it('aggregates real version/run-health data across every definition in the organisation', async () => {
    const definitionOneId = randomUUID() as WorkflowDefinition['id'];
    const definitionTwoId = randomUUID() as WorkflowDefinition['id'];
    await deps.workflowDefinitions.create({
      id: definitionOneId,
      projectId: randomUUID() as WorkflowDefinition['projectId'],
      key: 'wf-one',
      name: 'Workflow One',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await deps.workflowDefinitions.create({
      id: definitionTwoId,
      projectId: randomUUID() as WorkflowDefinition['projectId'],
      key: 'wf-two',
      name: 'Workflow Two',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    deps.setVersionSummaries([
      { workflowDefinitionId: definitionOneId, latestStatus: 'PUBLISHED', versionCount: 2 },
    ]);
    deps.setRunStatusCounts([
      { workflowDefinitionId: definitionOneId, status: 'COMPLETED', count: 3 },
      { workflowDefinitionId: definitionOneId, status: 'FAILED', count: 1 },
    ]);

    const entries = await listWorkflowsForOrganisation(deps, 'alice', organisationId);

    expect(entries).toHaveLength(2);
    const entryOne = entries.find((entry) => entry.definition.id === definitionOneId)!;
    expect(entryOne.latestVersionStatus).toBe('PUBLISHED');
    expect(entryOne.versionCount).toBe(2);
    expect(entryOne.runStatusCounts).toEqual({ COMPLETED: 3, FAILED: 1 });

    const entryTwo = entries.find((entry) => entry.definition.id === definitionTwoId)!;
    expect(entryTwo.latestVersionStatus).toBeNull();
    expect(entryTwo.versionCount).toBe(0);
    expect(entryTwo.runStatusCounts).toEqual({});
  });

  it('short-circuits without calling either summarizer when the organisation has zero workflow definitions', async () => {
    const entries = await listWorkflowsForOrganisation(deps, 'alice', organisationId);

    expect(entries).toEqual([]);
    expect(deps.getSummarizeCallCounts()).toEqual({
      summarizeVersionsCallCount: 0,
      summarizeRunStatusCountsCallCount: 0,
    });
  });

  it('404s a non-member', async () => {
    await expect(listWorkflowsForOrganisation(deps, 'mallory', organisationId)).rejects.toThrow(
      NotFoundError,
    );
  });

  it('404s a lookup against an organisation that does not exist', async () => {
    await expect(
      listWorkflowsForOrganisation(deps, 'alice', randomUUID() as OrganisationId),
    ).rejects.toThrow(NotFoundError);
  });
});
