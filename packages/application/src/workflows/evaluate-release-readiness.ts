import type { ProjectId } from '@devos/contracts';
import { NotFoundError } from '../errors.js';
import { resolveMembership } from '../projects/membership-access.js';
import type { ReleaseReadinessUseCaseDeps } from './deps.js';

export interface ReleaseReadinessFinding {
  severity: string;
  description?: string;
}

export interface ReleaseReadinessEvidence {
  testEvidence?: {
    artifactId: string;
    passed: boolean;
  };
  reviewEvidence?: {
    artifactId: string;
    decision: string;
    findings: ReleaseReadinessFinding[];
  };
}

export interface ReleaseReadinessResult {
  ready: boolean;
  reasons: string[];
  evidence: ReleaseReadinessEvidence;
}

/**
 * Stage 10 — Release Readiness (specs/workflows/software-change-workflow.md
 * §21): "Determine whether the change is ready for release," checked
 * against "required tests pass; review passes; ... no unresolved blockers
 * remain," deterministically (Workflow Principle 12, §8: "Workflow
 * transitions depend on evidence and validation, not agent claims alone").
 * Deliberately a pure function — no model call, matching DEVOS-044's
 * `evaluatePolicies` precedent exactly (an *evaluator*, distinct from the
 * review *agent*): the same evidence always yields the same verdict.
 *
 * §21 also lists "acceptance criteria pass," "security checks pass," and
 * "required approvals exist" among its checks — none of those have any
 * implementation anywhere in this codebase or this sprint (acceptance-
 * criteria validation and security scanning don't exist; this sprint adds
 * no new approval gate), so fabricating a pass/fail for them would violate
 * AGENTS.md §7. This evaluator is explicitly scoped to the two checks this
 * sprint's own evidence actually supports: test evidence and review
 * evidence.
 */
export function evaluateReleaseReadiness(
  evidence: ReleaseReadinessEvidence,
): ReleaseReadinessResult {
  const reasons: string[] = [];

  if (!evidence.testEvidence) {
    reasons.push('No test evidence found.');
  } else if (!evidence.testEvidence.passed) {
    reasons.push('Test evidence shows a failing build or test.');
  }

  if (!evidence.reviewEvidence) {
    reasons.push('No review evidence found.');
  } else {
    if (evidence.reviewEvidence.decision !== 'PASS') {
      reasons.push(`Review decision is "${evidence.reviewEvidence.decision}", not "PASS".`);
    }
    const unresolvedBlockers = evidence.reviewEvidence.findings.filter(
      (finding) => finding.severity === 'BLOCKER',
    );
    if (unresolvedBlockers.length > 0) {
      reasons.push(`${unresolvedBlockers.length} unresolved BLOCKER finding(s) remain.`);
    }
  }

  return { ready: reasons.length === 0, reasons, evidence };
}

/** Exported so DEVOS-078's closure use case can resolve its own additional
 * artifact type (`RELEASE_EVIDENCE`) the same project-scoped, latest-wins
 * way every other stage already resolves its own. */
export function latestOfType<T extends { artifactType: string; createdAt: string }>(
  artifacts: T[],
  artifactType: string,
): T | undefined {
  return artifacts
    .filter((artifact) => artifact.artifactType === artifactType)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
}

export interface ReleaseReadinessEvidenceSourceDeps {
  artifacts: ReleaseReadinessUseCaseDeps['artifacts'];
  artifactVersions: ReleaseReadinessUseCaseDeps['artifactVersions'];
}

/**
 * Resolves the project's latest `TEST_EVIDENCE`/`REVIEW_EVIDENCE` artifacts
 * (project-scoped, matching every other consuming stage's lookup this and
 * the prior sprint use) into the shape `evaluateReleaseReadiness` checks.
 * Factored out so both the authenticated read side below and DEVOS-073's
 * system-driven release-readiness-check task (which runs inside an
 * already-scoped workflow task, not a user request, so it has no principal
 * to check membership for) can reuse the exact same evidence gathering
 * without duplicating it.
 */
export async function gatherReleaseReadinessEvidence(
  deps: ReleaseReadinessEvidenceSourceDeps,
  projectId: ProjectId,
): Promise<ReleaseReadinessEvidence> {
  const artifacts = await deps.artifacts.listForProject(projectId);

  const testEvidenceArtifact = latestOfType(artifacts, 'TEST_EVIDENCE');
  const reviewEvidenceArtifact = latestOfType(artifacts, 'REVIEW_EVIDENCE');

  const [testEvidenceVersions, reviewEvidenceVersions] = await Promise.all([
    testEvidenceArtifact
      ? deps.artifactVersions.listForArtifact(testEvidenceArtifact.id)
      : Promise.resolve([]),
    reviewEvidenceArtifact
      ? deps.artifactVersions.listForArtifact(reviewEvidenceArtifact.id)
      : Promise.resolve([]),
  ]);
  const latestTestEvidenceVersion = testEvidenceVersions.sort((a, b) => b.version - a.version)[0];
  const latestReviewEvidenceVersion = reviewEvidenceVersions.sort(
    (a, b) => b.version - a.version,
  )[0];

  return {
    ...(testEvidenceArtifact && latestTestEvidenceVersion
      ? {
          testEvidence: {
            artifactId: testEvidenceArtifact.id,
            passed: latestTestEvidenceVersion.metadata?.passed === true,
          },
        }
      : {}),
    ...(reviewEvidenceArtifact && latestReviewEvidenceVersion
      ? {
          reviewEvidence: {
            artifactId: reviewEvidenceArtifact.id,
            decision: String(latestReviewEvidenceVersion.metadata?.decision ?? ''),
            findings: Array.isArray(latestReviewEvidenceVersion.metadata?.findings)
              ? (latestReviewEvidenceVersion.metadata.findings as ReleaseReadinessFinding[])
              : [],
          },
        }
      : {}),
  };
}

/**
 * The read side: resolves the project's latest evidence (via
 * `gatherReleaseReadinessEvidence`) and evaluates it, after the same
 * `resolveMembership` authorization check every other project-scoped use
 * case already performs.
 */
export async function getReleaseReadinessForProject(
  deps: ReleaseReadinessUseCaseDeps,
  principalId: string,
  projectId: ProjectId,
): Promise<ReleaseReadinessResult> {
  const project = await deps.projects.getById(projectId);
  if (!project) throw new NotFoundError('Project');

  const membership = await resolveMembership(deps, principalId, project);
  if (!membership) throw new NotFoundError('Project');

  const evidence = await gatherReleaseReadinessEvidence(deps, projectId);
  return evaluateReleaseReadiness(evidence);
}
