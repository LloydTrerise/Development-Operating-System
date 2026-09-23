import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type {
  ArtifactEvidenceRow,
  ArtifactRepository,
  Membership,
  MembershipRepository,
  Organisation,
  OrganisationRepository,
  Project,
  ProjectRepository,
  ProjectType,
  ProjectTypeRepository,
  WorkItem,
  WorkItemRepository,
  WorkItemReworkCount,
} from '@devos/domain';
import {
  aggregateEngineeringEvidence,
  getOrganisationEngineeringReport,
  getProjectEngineeringReport,
  NotFoundError,
  type EngineeringIntelligenceUseCaseDeps,
} from '../src/index.js';

function row(metadata: Record<string, unknown>): ArtifactEvidenceRow {
  return {
    artifactId: randomUUID() as ArtifactEvidenceRow['artifactId'],
    createdAt: new Date().toISOString(),
    metadata,
  };
}

const TEST_PERIOD = {
  start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  end: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
};

describe('aggregateEngineeringEvidence', () => {
  it('computes real pass rates, counts, rework total, and DORA release metrics from real evidence rows', () => {
    const result = aggregateEngineeringEvidence(
      {
        review: [
          row({ decision: 'PASS' }),
          row({ decision: 'CHANGES_REQUIRED' }),
          row({ decision: 'PASS' }),
        ],
        test: [row({ passed: true }), row({ passed: false })],
        securityScan: [row({ passed: true })],
        release: [
          row({ action: 'deploy', passed: true }),
          row({ action: 'deploy', passed: true }),
          row({ action: 'rollback', passed: false }),
        ],
        codeChange: [],
        reworkCycles: [
          { workItemId: 'a' as WorkItemReworkCount['workItemId'], reworkCount: 1 },
          { workItemId: 'b' as WorkItemReworkCount['workItemId'], reworkCount: 2 },
        ],
      },
      TEST_PERIOD,
    );

    expect(result.reviewCount).toBe(3);
    expect(result.reviewPassCount).toBe(2);
    expect(result.reviewPassRate).toBeCloseTo(2 / 3, 6);
    expect(result.testCount).toBe(2);
    expect(result.testPassRate).toBeCloseTo(0.5, 6);
    expect(result.securityScanCount).toBe(1);
    expect(result.securityScanPassRate).toBe(1);
    expect(result.deployCount).toBe(2);
    expect(result.rollbackCount).toBe(1);
    expect(result.reworkCycleCount).toBe(3);
    expect(result.dora.deploymentCount).toBe(2);
    expect(result.dora.changeFailureCount).toBe(1);
    expect(result.dora.changeFailureRate).toBeCloseTo(0.5, 6);
  });

  it('reports a rate of 0, not NaN, when a category has zero rows', () => {
    const result = aggregateEngineeringEvidence(
      { review: [], test: [], securityScan: [], release: [], codeChange: [], reworkCycles: [] },
      TEST_PERIOD,
    );

    expect(result.reviewPassRate).toBe(0);
    expect(result.testPassRate).toBe(0);
    expect(result.securityScanPassRate).toBe(0);
    expect(result.deployCount).toBe(0);
    expect(result.rollbackCount).toBe(0);
    expect(result.dora.deploymentCount).toBe(0);
    expect(result.dora.changeFailureRate).toBe(0);
    expect(result.leadTime.sampleCount).toBe(0);
  });

  it('DEVOS-168: matches a passed release to its originating CODE_CHANGE via derivedFromArtifactId and computes a real lead time, excluding an unreleased CODE_CHANGE', () => {
    const codeChangeArtifactId = randomUUID();
    const codeChangeGeneratedAt = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1h ago
    const releaseCompletedAt = new Date().toISOString();

    const codeChangeRow: ArtifactEvidenceRow = {
      artifactId: codeChangeArtifactId as ArtifactEvidenceRow['artifactId'],
      createdAt: codeChangeGeneratedAt,
      metadata: { generatedAt: codeChangeGeneratedAt },
    };
    const unreleasedCodeChangeRow = row({ generatedAt: new Date().toISOString() });
    const releaseRow: ArtifactEvidenceRow = {
      artifactId: randomUUID() as ArtifactEvidenceRow['artifactId'],
      createdAt: releaseCompletedAt,
      metadata: {
        action: 'deploy',
        passed: true,
        completedAt: releaseCompletedAt,
        derivedFromArtifactId: codeChangeArtifactId,
      },
    };

    const result = aggregateEngineeringEvidence(
      {
        review: [],
        test: [],
        securityScan: [],
        release: [releaseRow],
        codeChange: [codeChangeRow, unreleasedCodeChangeRow],
        reworkCycles: [],
      },
      TEST_PERIOD,
    );

    expect(result.leadTime.sampleCount).toBe(1);
    expect(result.leadTime.leadTimeMsP50).toBeCloseTo(60 * 60 * 1000, -2);
  });
});

function buildDeps(overrides: {
  project: Project;
  organisation: Organisation;
  membership: Membership | null;
  evidenceByType?: Record<string, ArtifactEvidenceRow[]>;
  reworkCycles?: WorkItemReworkCount[];
  otherProjects?: Project[];
  projectType?: ProjectType | null;
  closedWorkItems?: { createdAt: string; closedAt: string }[];
}): EngineeringIntelligenceUseCaseDeps {
  const { project, organisation, membership, evidenceByType = {}, reworkCycles = [] } = overrides;

  const memberships: MembershipRepository = {
    getById: async () => null,
    getForPrincipalAndProject: async (_principalId, projectId) =>
      membership && projectId === project.id ? membership : null,
    listForPrincipal: async () => (membership ? [membership] : []),
    listForProject: async () => (membership ? [membership] : []),
    create: async () => {},
    updateRole: async () => {},
    remove: async () => {},
  };

  const projects: ProjectRepository = {
    getById: async (id) => (id === project.id ? project : null),
    listForOrganisation: async () => [project, ...(overrides.otherProjects ?? [])],
    create: async () => {},
    update: async () => {},
  };

  const organisations: OrganisationRepository = {
    getById: async (id) => (id === organisation.id ? organisation : null),
    list: async () => [organisation],
    create: async () => {},
    update: async () => {},
    setOwnerPrincipalId: async () => {},
  };

  const artifacts: ArtifactRepository = {
    getById: async () => null,
    listForProject: async () => [],
    create: async () => {},
    listEvidenceForProject: async (_projectId, artifactType) => evidenceByType[artifactType] ?? [],
    listEvidenceForOrganisation: async (_organisationId, artifactType) =>
      evidenceByType[artifactType] ?? [],
  };

  const closedWorkItems: WorkItem[] = (overrides.closedWorkItems ?? []).map((entry) => ({
    id: randomUUID() as WorkItem['id'],
    projectId: project.id,
    title: 'Incident fixture',
    type: 'INCIDENT',
    status: 'CLOSED',
    priority: 'HIGH',
    metadata: { closedAt: entry.closedAt },
    createdBy: 'user-1',
    createdAt: entry.createdAt,
    updatedAt: entry.closedAt,
  }));

  const workItems: WorkItemRepository = {
    getById: async () => null,
    listForProject: async () => closedWorkItems,
    create: async () => {},
    update: async () => {},
    countReworkCyclesForProject: async () => reworkCycles,
  };

  const projectTypes: ProjectTypeRepository = {
    getById: async (id) =>
      overrides.projectType && id === overrides.projectType.id ? overrides.projectType : null,
    getByKey: async () => null,
    list: async () => [],
    create: async () => {},
    update: async () => {},
  };

  return { projects, memberships, organisations, artifacts, workItems, projectTypes };
}

function makeProject(organisationId: string): Project {
  const now = new Date().toISOString();
  return {
    id: randomUUID() as Project['id'],
    organisationId: organisationId as Project['organisationId'],
    projectTypeId: randomUUID() as Project['projectTypeId'],
    name: 'Test Project',
    slug: `test-project-${randomUUID()}`,
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  };
}

function makeOrganisation(): Organisation {
  const now = new Date().toISOString();
  return {
    id: randomUUID() as Organisation['id'],
    name: 'Test Org',
    slug: `test-org-${randomUUID()}`,
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  };
}

function makeMembership(organisationId: string, projectId: string): Membership {
  const now = new Date().toISOString();
  return {
    id: randomUUID() as Membership['id'],
    organisationId: organisationId as Membership['organisationId'],
    projectId: projectId as Membership['projectId'],
    principalId: 'user-1',
    role: 'OWNER',
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  };
}

describe('getProjectEngineeringReport', () => {
  it('returns a correctly aggregated real report for a real member', async () => {
    const organisation = makeOrganisation();
    const project = makeProject(organisation.id);
    const membership = makeMembership(organisation.id, project.id);
    const deps = buildDeps({
      project,
      organisation,
      membership,
      evidenceByType: {
        REVIEW_EVIDENCE: [row({ decision: 'PASS' })],
        RELEASE_EVIDENCE: [row({ action: 'deploy' })],
      },
      reworkCycles: [{ workItemId: 'a' as WorkItemReworkCount['workItemId'], reworkCount: 1 }],
    });

    const report = await getProjectEngineeringReport(deps, 'user-1', project.id);

    expect(report.projectId).toBe(project.id);
    expect(report.reviewCount).toBe(1);
    expect(report.reviewPassRate).toBe(1);
    expect(report.deployCount).toBe(1);
    expect(report.reworkCycleCount).toBe(1);
    expect(report.incidentRecoveryProxy).toBeUndefined();
  });

  it('DEVOS-169: computes a real incident-recovery proxy only for an Incident Response project, from real closed work items', async () => {
    const organisation = makeOrganisation();
    const project = makeProject(organisation.id);
    const membership = makeMembership(organisation.id, project.id);
    const incidentResponseType: ProjectType = {
      id: project.projectTypeId,
      key: 'incident-response',
      name: 'Incident Response',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const deps = buildDeps({
      project,
      organisation,
      membership,
      projectType: incidentResponseType,
      closedWorkItems: [
        {
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          closedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        },
      ],
    });

    const report = await getProjectEngineeringReport(deps, 'user-1', project.id);

    expect(report.incidentRecoveryProxy).toBeDefined();
    expect(report.incidentRecoveryProxy?.sampleCount).toBe(1);
    expect(report.incidentRecoveryProxy?.meanMs).toBeGreaterThan(0);
    expect(report.incidentRecoveryProxy?.label).toBe('incident-work-item-created-to-closed');
  });

  it('throws NotFoundError for a non-member principal, matching every other project-scoped use case', async () => {
    const organisation = makeOrganisation();
    const project = makeProject(organisation.id);
    const deps = buildDeps({ project, organisation, membership: null });

    await expect(getProjectEngineeringReport(deps, 'stranger', project.id)).rejects.toThrow(
      NotFoundError,
    );
  });

  it('reports an empty evidence set (not an error) when the repository lacks the optional methods', async () => {
    const organisation = makeOrganisation();
    const project = makeProject(organisation.id);
    const membership = makeMembership(organisation.id, project.id);
    const deps = buildDeps({ project, organisation, membership });
    deps.artifacts.listEvidenceForProject = undefined;
    deps.workItems.countReworkCyclesForProject = undefined;

    const report = await getProjectEngineeringReport(deps, 'user-1', project.id);

    expect(report.reviewCount).toBe(0);
    expect(report.reworkCycleCount).toBe(0);
  });
});

describe('getOrganisationEngineeringReport', () => {
  it('returns a correctly aggregated real report spanning the organisation, tenant-isolated by construction', async () => {
    const organisation = makeOrganisation();
    const project = makeProject(organisation.id);
    const otherProject = makeProject(organisation.id);
    const membership = makeMembership(organisation.id, project.id);
    const deps = buildDeps({
      project,
      organisation,
      membership,
      otherProjects: [otherProject],
      evidenceByType: {
        RELEASE_EVIDENCE: [row({ action: 'deploy' }), row({ action: 'rollback' })],
      },
    });

    const report = await getOrganisationEngineeringReport(deps, 'user-1', organisation.id);

    expect(report.organisationId).toBe(organisation.id);
    expect(report.projectCount).toBe(2);
    expect(report.deployCount).toBe(1);
    expect(report.rollbackCount).toBe(1);
    expect(report.reworkCycleCount).toBe(0);
  });

  it('throws NotFoundError for a principal with no membership in the organisation', async () => {
    const organisation = makeOrganisation();
    const project = makeProject(organisation.id);
    const deps = buildDeps({ project, organisation, membership: null });

    await expect(
      getOrganisationEngineeringReport(deps, 'stranger', organisation.id),
    ).rejects.toThrow(NotFoundError);
  });
});
