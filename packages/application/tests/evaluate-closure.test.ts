import { randomUUID } from 'node:crypto';
import type {
  Approval,
  ApprovalRepository,
  Artifact,
  ArtifactRepository,
  ArtifactVersion,
  ArtifactVersionRepository,
  Membership,
  MembershipRepository,
  OrganisationId,
  Project,
  ProjectId,
  ProjectRepository,
  WorkItem,
  WorkItemId,
  WorkItemRepository,
} from '@devos/domain';
import { describe, expect, it } from 'vitest';
import { closeWorkItem } from '../src/workflows/close-work-item.js';
import type { ClosureUseCaseDeps } from '../src/workflows/deps.js';
import { evaluateClosure } from '../src/workflows/evaluate-closure.js';

const PASSING_TEST_EVIDENCE = { artifactId: 'a', passed: true };
const PASSING_REVIEW_EVIDENCE = { artifactId: 'b', decision: 'PASS', findings: [] };
const APPROVED_RELEASE_APPROVAL = { approvalId: 'c', status: 'APPROVED' };
const PASSING_RELEASE_EVIDENCE = { artifactId: 'd', passed: true };
const PASSING_SECURITY_SCAN_EVIDENCE = { artifactId: 'e', passed: true };

describe('evaluateClosure (pure function)', () => {
  it('closes when test/review evidence pass, release approval is APPROVED, and release evidence passed', () => {
    const result = evaluateClosure({
      testEvidence: PASSING_TEST_EVIDENCE,
      reviewEvidence: PASSING_REVIEW_EVIDENCE,
      securityScanEvidence: PASSING_SECURITY_SCAN_EVIDENCE,
      releaseApproval: APPROVED_RELEASE_APPROVAL,
      releaseEvidence: PASSING_RELEASE_EVIDENCE,
    });

    expect(result.closed).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it('reuses evaluateReleaseReadiness verbatim: a failing test evidence blocks closure with its own reason', () => {
    const result = evaluateClosure({
      testEvidence: { artifactId: 'a', passed: false },
      reviewEvidence: PASSING_REVIEW_EVIDENCE,
      securityScanEvidence: PASSING_SECURITY_SCAN_EVIDENCE,
      releaseApproval: APPROVED_RELEASE_APPROVAL,
      releaseEvidence: PASSING_RELEASE_EVIDENCE,
    });

    expect(result.closed).toBe(false);
    expect(result.reasons).toContain('Test evidence shows a failing build or test.');
  });

  it('is not closed when no release approval exists', () => {
    const result = evaluateClosure({
      testEvidence: PASSING_TEST_EVIDENCE,
      reviewEvidence: PASSING_REVIEW_EVIDENCE,
      securityScanEvidence: PASSING_SECURITY_SCAN_EVIDENCE,
      releaseEvidence: PASSING_RELEASE_EVIDENCE,
    });

    expect(result.closed).toBe(false);
    expect(result.reasons).toContain('No release approval found.');
  });

  it('is not closed when the release approval is not APPROVED', () => {
    const result = evaluateClosure({
      testEvidence: PASSING_TEST_EVIDENCE,
      reviewEvidence: PASSING_REVIEW_EVIDENCE,
      securityScanEvidence: PASSING_SECURITY_SCAN_EVIDENCE,
      releaseApproval: { approvalId: 'c', status: 'REJECTED' },
      releaseEvidence: PASSING_RELEASE_EVIDENCE,
    });

    expect(result.closed).toBe(false);
    expect(result.reasons).toContain('Release approval is "REJECTED", not "APPROVED".');
  });

  it('is not closed when no release evidence exists', () => {
    const result = evaluateClosure({
      testEvidence: PASSING_TEST_EVIDENCE,
      reviewEvidence: PASSING_REVIEW_EVIDENCE,
      securityScanEvidence: PASSING_SECURITY_SCAN_EVIDENCE,
      releaseApproval: APPROVED_RELEASE_APPROVAL,
    });

    expect(result.closed).toBe(false);
    expect(result.reasons).toContain('No release evidence found.');
  });

  it('is not closed when release evidence shows a failing post-release validation', () => {
    const result = evaluateClosure({
      testEvidence: PASSING_TEST_EVIDENCE,
      reviewEvidence: PASSING_REVIEW_EVIDENCE,
      securityScanEvidence: PASSING_SECURITY_SCAN_EVIDENCE,
      releaseApproval: APPROVED_RELEASE_APPROVAL,
      releaseEvidence: { artifactId: 'd', passed: false },
    });

    expect(result.closed).toBe(false);
    expect(result.reasons).toContain('Release evidence shows a failing post-release validation.');
  });

  it('the same evidence always yields the same verdict (deterministic)', () => {
    const evidence = {
      testEvidence: PASSING_TEST_EVIDENCE,
      reviewEvidence: PASSING_REVIEW_EVIDENCE,
      securityScanEvidence: PASSING_SECURITY_SCAN_EVIDENCE,
      releaseApproval: APPROVED_RELEASE_APPROVAL,
      releaseEvidence: PASSING_RELEASE_EVIDENCE,
    };
    expect(evaluateClosure(evidence)).toEqual(evaluateClosure(evidence));
  });
});

describe('closeWorkItem (real project-scoped evidence lookup)', () => {
  function buildScenario() {
    const organisationId = randomUUID() as OrganisationId;
    const projectId = randomUUID() as ProjectId;
    const workItemId = randomUUID() as WorkItemId;
    const now = new Date(0).toISOString();

    const project: Project = {
      id: projectId,
      organisationId,
      name: 'Test Project',
      slug: 'test-project',
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };
    const membership: Membership = {
      id: randomUUID() as Membership['id'],
      organisationId,
      projectId,
      principalId: 'alice',
      role: 'OWNER',
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };
    let workItem: WorkItem = {
      id: workItemId,
      projectId,
      title: 'Ship the status page',
      description: 'Release it.',
      type: 'GENERAL',
      status: 'OPEN',
      priority: 'MEDIUM',
      metadata: {},
      createdBy: 'alice',
      createdAt: now,
      updatedAt: now,
    };

    function makeArtifact(artifactType: string, offsetMs: number): Artifact {
      return {
        id: randomUUID() as Artifact['id'],
        projectId,
        artifactType,
        name: artifactType,
        status: 'GENERATED',
        createdBy: 'devos-agent-runtime',
        createdAt: new Date(offsetMs).toISOString(),
        updatedAt: new Date(offsetMs).toISOString(),
      };
    }
    function makeVersion(artifact: Artifact, metadata: Record<string, unknown>): ArtifactVersion {
      return {
        id: randomUUID() as ArtifactVersion['id'],
        artifactId: artifact.id,
        version: 1,
        contentType: 'application/json',
        contentUri: `file:///${artifact.artifactType}.json`,
        contentHash: 'a'.repeat(64),
        metadata,
        createdBy: 'devos-agent-runtime',
        createdAt: artifact.createdAt,
      };
    }

    const testEvidenceArtifact = makeArtifact('TEST_EVIDENCE', 1);
    const testEvidenceVersion = makeVersion(testEvidenceArtifact, { passed: true });
    const reviewEvidenceArtifact = makeArtifact('REVIEW_EVIDENCE', 2);
    const reviewEvidenceVersion = makeVersion(reviewEvidenceArtifact, {
      decision: 'PASS',
      findings: [],
    });
    const releaseEvidenceArtifact = makeArtifact('RELEASE_EVIDENCE', 3);
    const releaseEvidenceVersion = makeVersion(releaseEvidenceArtifact, { passed: true });
    const securityScanEvidenceArtifact = makeArtifact('SECURITY_SCAN_EVIDENCE', 4);
    const securityScanEvidenceVersion = makeVersion(securityScanEvidenceArtifact, {
      passed: true,
    });

    const projectArtifacts = [
      testEvidenceArtifact,
      reviewEvidenceArtifact,
      releaseEvidenceArtifact,
      securityScanEvidenceArtifact,
    ];
    const artifactVersionsByArtifactId = new Map([
      [testEvidenceArtifact.id, [testEvidenceVersion]],
      [reviewEvidenceArtifact.id, [reviewEvidenceVersion]],
      [releaseEvidenceArtifact.id, [releaseEvidenceVersion]],
      [securityScanEvidenceArtifact.id, [securityScanEvidenceVersion]],
    ]);

    const releaseApproval: Approval = {
      id: randomUUID() as Approval['id'],
      projectId,
      workflowRunId: randomUUID() as Approval['workflowRunId'],
      approvalType: 'RELEASE',
      status: 'APPROVED',
      requestedBy: 'devos-worker',
      decidedBy: 'alice',
      evidenceReference: { artifactVersionIds: [], scopeHash: 'x'.repeat(64) },
      requestedAt: new Date(0).toISOString(),
      decidedAt: new Date(1).toISOString(),
    };

    const projects: ProjectRepository = {
      getById: async (id) => (id === project.id ? project : null),
      listForOrganisation: async () => [project],
      create: async () => {},
      update: async () => {},
    };
    const memberships: MembershipRepository = {
      getById: async () => null,
      getForPrincipalAndProject: async (principalId, pid) =>
        principalId === membership.principalId && pid === projectId ? membership : null,
      listForPrincipal: async () => [],
      listForProject: async () => [membership],
      create: async () => {},
      updateRole: async () => {},
      remove: async () => {},
    };
    const workItems: WorkItemRepository = {
      getById: async (id) => (id === workItem.id ? workItem : null),
      listForProject: async () => [workItem],
      create: async () => {},
      update: async (id, changes, updatedAt) => {
        if (id !== workItem.id) return;
        workItem = { ...workItem, ...changes, updatedAt };
      },
    };
    const artifacts: ArtifactRepository = {
      getById: async (id) => projectArtifacts.find((a) => a.id === id) ?? null,
      listForProject: async () => projectArtifacts,
      create: async () => {},
    };
    const artifactVersions: ArtifactVersionRepository = {
      getById: async () => null,
      listForArtifact: async (artifactId) => artifactVersionsByArtifactId.get(artifactId) ?? [],
      create: async () => {},
    };
    const approvals: ApprovalRepository = {
      getById: async (id) => (id === releaseApproval.id ? releaseApproval : null),
      listForProject: async () => [releaseApproval],
      listForRun: async () => [releaseApproval],
      getPendingForRunAndType: async () => null,
      create: async () => {},
      decide: async () => {},
    };

    const closeWorkItemCalls: Array<{
      workItemId: string;
      projectId: string;
      metadata: Record<string, unknown>;
    }> = [];

    const deps: ClosureUseCaseDeps = {
      projects,
      memberships,
      workItems,
      artifacts,
      artifactVersions,
      approvals,
      closeWorkItem: async (wid, pid, metadata) => {
        closeWorkItemCalls.push({ workItemId: wid, projectId: pid, metadata });
      },
    };

    return { deps, projectId, workItemId, closeWorkItemCalls, getWorkItem: () => workItem };
  }

  it('closes the work item and records the linked evidence when every criterion holds', async () => {
    const scenario = buildScenario();

    const result = await closeWorkItem(scenario.deps, 'alice', scenario.workItemId);

    expect(result.closed).toBe(true);
    expect(scenario.closeWorkItemCalls).toHaveLength(1);
    const call = scenario.closeWorkItemCalls[0]!;
    expect(call.workItemId).toBe(scenario.workItemId);
    expect(call.metadata.releaseApprovalId).toEqual(expect.any(String));
    expect(call.metadata.releaseEvidenceArtifactId).toEqual(expect.any(String));
  });

  it('throws ValidationError (and never calls closeWorkItem) when release approval is missing', async () => {
    const scenario = buildScenario();
    scenario.deps.approvals = {
      ...scenario.deps.approvals,
      listForProject: async () => [],
    };

    await expect(closeWorkItem(scenario.deps, 'alice', scenario.workItemId)).rejects.toThrow(
      /cannot be closed/,
    );
    expect(scenario.closeWorkItemCalls).toHaveLength(0);
  });

  it('throws NotFoundError for a non-member principal', async () => {
    const scenario = buildScenario();

    await expect(closeWorkItem(scenario.deps, 'mallory', scenario.workItemId)).rejects.toThrow();
    expect(scenario.closeWorkItemCalls).toHaveLength(0);
  });
});
