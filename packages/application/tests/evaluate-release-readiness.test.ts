import { randomUUID } from 'node:crypto';
import type {
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
} from '@devos/domain';
import { describe, expect, it } from 'vitest';
import type { ReleaseReadinessUseCaseDeps } from '../src/workflows/deps.js';
import {
  evaluateReleaseReadiness,
  getReleaseReadinessForProject,
} from '../src/workflows/evaluate-release-readiness.js';

describe('evaluateReleaseReadiness (pure function)', () => {
  it('is ready when test evidence passed, review decision is PASS with no BLOCKER findings, and the security scan passed', () => {
    const result = evaluateReleaseReadiness({
      testEvidence: { artifactId: 'a', passed: true },
      reviewEvidence: { artifactId: 'b', decision: 'PASS', findings: [] },
      securityScanEvidence: { artifactId: 'c', passed: true },
    });
    expect(result).toEqual({
      ready: true,
      reasons: [],
      evidence: {
        testEvidence: { artifactId: 'a', passed: true },
        reviewEvidence: { artifactId: 'b', decision: 'PASS', findings: [] },
        securityScanEvidence: { artifactId: 'c', passed: true },
      },
    });
  });

  it('is ready with a MINOR/NOTE finding present, since only BLOCKER findings block readiness', () => {
    const result = evaluateReleaseReadiness({
      testEvidence: { artifactId: 'a', passed: true },
      reviewEvidence: {
        artifactId: 'b',
        decision: 'PASS',
        findings: [{ severity: 'MINOR', description: 'Consider renaming this variable.' }],
      },
      securityScanEvidence: { artifactId: 'c', passed: true },
    });
    expect(result.ready).toBe(true);
  });

  it('is not ready when test evidence failed', () => {
    const result = evaluateReleaseReadiness({
      testEvidence: { artifactId: 'a', passed: false },
      reviewEvidence: { artifactId: 'b', decision: 'PASS', findings: [] },
      securityScanEvidence: { artifactId: 'c', passed: true },
    });
    expect(result.ready).toBe(false);
    expect(result.reasons).toContain('Test evidence shows a failing build or test.');
  });

  it('is not ready when the review decision is not PASS', () => {
    const result = evaluateReleaseReadiness({
      testEvidence: { artifactId: 'a', passed: true },
      reviewEvidence: { artifactId: 'b', decision: 'CHANGES_REQUIRED', findings: [] },
      securityScanEvidence: { artifactId: 'c', passed: true },
    });
    expect(result.ready).toBe(false);
    expect(result.reasons).toContain('Review decision is "CHANGES_REQUIRED", not "PASS".');
  });

  it('is not ready when an unresolved BLOCKER finding remains, even if the decision says PASS', () => {
    const result = evaluateReleaseReadiness({
      testEvidence: { artifactId: 'a', passed: true },
      reviewEvidence: {
        artifactId: 'b',
        decision: 'PASS',
        findings: [{ severity: 'BLOCKER', description: 'Should not have been marked PASS.' }],
      },
      securityScanEvidence: { artifactId: 'c', passed: true },
    });
    expect(result.ready).toBe(false);
    expect(result.reasons).toContain('1 unresolved BLOCKER finding(s) remain.');
  });

  it('is not ready when the security scan failed', () => {
    const result = evaluateReleaseReadiness({
      testEvidence: { artifactId: 'a', passed: true },
      reviewEvidence: { artifactId: 'b', decision: 'PASS', findings: [] },
      securityScanEvidence: { artifactId: 'c', passed: false },
    });
    expect(result.ready).toBe(false);
    expect(result.reasons).toContain('Security scan evidence shows a failing scan.');
  });

  it('is not ready when all evidence is missing entirely', () => {
    const result = evaluateReleaseReadiness({});
    expect(result.ready).toBe(false);
    expect(result.reasons).toEqual([
      'No test evidence found.',
      'No review evidence found.',
      'No security scan evidence found.',
    ]);
  });

  it('the same evidence always yields the same verdict (deterministic)', () => {
    const evidence = {
      testEvidence: { artifactId: 'a', passed: true },
      reviewEvidence: { artifactId: 'b', decision: 'PASS', findings: [] },
      securityScanEvidence: { artifactId: 'c', passed: true },
    };
    const first = evaluateReleaseReadiness(evidence);
    const second = evaluateReleaseReadiness(evidence);
    expect(first).toEqual(second);
  });
});

describe('getReleaseReadinessForProject (real project-scoped artifact lookup)', () => {
  function buildScenario() {
    const organisationId = randomUUID() as OrganisationId;
    const projectId = randomUUID() as ProjectId;
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
    const securityScanEvidenceArtifact = makeArtifact('SECURITY_SCAN_EVIDENCE', 3);
    const securityScanEvidenceVersion = makeVersion(securityScanEvidenceArtifact, {
      passed: true,
    });

    const projectArtifacts = [
      testEvidenceArtifact,
      reviewEvidenceArtifact,
      securityScanEvidenceArtifact,
    ];
    const artifactVersionsByArtifactId = new Map([
      [testEvidenceArtifact.id, [testEvidenceVersion]],
      [reviewEvidenceArtifact.id, [reviewEvidenceVersion]],
      [securityScanEvidenceArtifact.id, [securityScanEvidenceVersion]],
    ]);

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

    return { projectId, projects, memberships, artifacts, artifactVersions };
  }

  it('resolves the latest test/review evidence for the project and evaluates them', async () => {
    const scenario = buildScenario();
    const deps: ReleaseReadinessUseCaseDeps = {
      projects: scenario.projects,
      memberships: scenario.memberships,
      artifacts: scenario.artifacts,
      artifactVersions: scenario.artifactVersions,
    };

    const result = await getReleaseReadinessForProject(deps, 'alice', scenario.projectId);
    expect(result.ready).toBe(true);
    expect(result.evidence.testEvidence?.passed).toBe(true);
    expect(result.evidence.reviewEvidence?.decision).toBe('PASS');
    expect(result.evidence.securityScanEvidence?.passed).toBe(true);
  });

  it('throws NotFoundError for a non-member principal', async () => {
    const scenario = buildScenario();
    const deps: ReleaseReadinessUseCaseDeps = {
      projects: scenario.projects,
      memberships: scenario.memberships,
      artifacts: scenario.artifacts,
      artifactVersions: scenario.artifactVersions,
    };

    await expect(
      getReleaseReadinessForProject(deps, 'mallory', scenario.projectId),
    ).rejects.toThrow();
  });
});
