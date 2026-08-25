import type { WorkItemId } from '@devos/contracts';
import { NotFoundError, ValidationError } from '../errors.js';
import { resolveMembership } from '../projects/membership-access.js';
import type { ClosureUseCaseDeps } from './deps.js';
import { evaluateClosure, type ClosureResult } from './evaluate-closure.js';
import { gatherReleaseReadinessEvidence, latestOfType } from './evaluate-release-readiness.js';

/**
 * Stage 12 — Closure (specs/workflows/software-change-workflow.md §23):
 * gathers the same project-scoped test/review evidence DEVOS-069 already
 * resolves, plus the project's latest `RELEASE`-typed approval and latest
 * `RELEASE_EVIDENCE` artifact, then evaluates and (only when every
 * criterion holds) actually closes the work item — mirroring
 * `getReleaseReadinessForProject`'s own `resolveMembership` authorization
 * check.
 *
 * **Throws rather than silently marking the work item complete when
 * closure criteria aren't met** — DEVOS-078's own acceptance criterion
 * ("closure does not silently mark the work complete") is enforced as a
 * hard precondition, not a soft warning: the caller gets `ValidationError`
 * with every unmet reason, and no state changes at all. This is the
 * concrete design choice that makes "the terminal state and its evidence
 * honestly reflect what actually happened" true by construction rather
 * than by convention.
 */
export async function closeWorkItem(
  deps: ClosureUseCaseDeps,
  principalId: string,
  workItemId: WorkItemId,
): Promise<ClosureResult> {
  const workItem = await deps.workItems.getById(workItemId);
  if (!workItem) throw new NotFoundError('WorkItem');

  const project = await deps.projects.getById(workItem.projectId);
  if (!project) throw new NotFoundError('WorkItem');

  const membership = await resolveMembership(deps, principalId, project);
  if (!membership) throw new NotFoundError('WorkItem');

  const [testReviewEvidence, approvals, artifacts] = await Promise.all([
    gatherReleaseReadinessEvidence(deps, project.id),
    deps.approvals.listForProject(project.id),
    deps.artifacts.listForProject(project.id),
  ]);

  const releaseApprovalRow = approvals
    .filter((approval) => approval.approvalType === 'RELEASE')
    .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime())[0];

  const releaseEvidenceArtifact = latestOfType(artifacts, 'RELEASE_EVIDENCE');
  const releaseEvidenceVersions = releaseEvidenceArtifact
    ? await deps.artifactVersions.listForArtifact(releaseEvidenceArtifact.id)
    : [];
  const latestReleaseEvidenceVersion = releaseEvidenceVersions.sort(
    (a, b) => b.version - a.version,
  )[0];

  const result = evaluateClosure({
    ...testReviewEvidence,
    ...(releaseApprovalRow
      ? {
          releaseApproval: { approvalId: releaseApprovalRow.id, status: releaseApprovalRow.status },
        }
      : {}),
    ...(releaseEvidenceArtifact && latestReleaseEvidenceVersion
      ? {
          releaseEvidence: {
            artifactId: releaseEvidenceArtifact.id,
            passed: latestReleaseEvidenceVersion.metadata?.passed === true,
          },
        }
      : {}),
  });

  if (!result.closed) {
    throw new ValidationError(
      `Work item ${workItemId} cannot be closed: ${result.reasons.join(' ')}`,
    );
  }

  const closedAt = new Date().toISOString();
  await deps.closeWorkItem(
    workItemId,
    project.id,
    {
      testEvidenceArtifactId: result.evidence.testEvidence?.artifactId,
      reviewEvidenceArtifactId: result.evidence.reviewEvidence?.artifactId,
      releaseApprovalId: result.evidence.releaseApproval?.approvalId,
      releaseEvidenceArtifactId: result.evidence.releaseEvidence?.artifactId,
      closedAt,
    },
    closedAt,
  );

  return result;
}
