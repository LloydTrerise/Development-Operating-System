import type { ProjectId } from '@devos/contracts';
import {
  computeAgentVersionQuality,
  resolveReliabilitySignal,
  type ArtifactRepository,
  type ReliabilitySignal,
} from '@devos/domain';

/**
 * DEVOS-198: the minimal shape `resolveApprovalReliability` actually needs
 * — the same `listEvidenceForProject` read `getAgentQuality` already makes
 * (`agents/get-agent-quality.ts`), not a widened `ArtifactRepository`.
 */
export type ArtifactEvidenceReader = Pick<ArtifactRepository, 'listEvidenceForProject'>;

export interface ResolveApprovalReliabilityDeps {
  artifacts?: ArtifactEvidenceReader;
}

/**
 * DEVOS-198: the I/O-performing wrapper around `resolveReliabilitySignal` —
 * fetches the same `REVIEW_EVIDENCE`/`CODE_CHANGE` evidence
 * `getAgentQuality` already fetches, computes `computeAgentVersionQuality`
 * (unchanged), and delegates the threshold read to the pure function.
 * A missing `artifacts` dependency (or a fake lacking
 * `listEvidenceForProject`) reports `'INSUFFICIENT_SAMPLE'`, matching
 * `getAgentQuality`'s own no-op-when-absent convention.
 */
export async function resolveApprovalReliability(
  deps: ResolveApprovalReliabilityDeps,
  projectId: ProjectId,
  agentVersionId: string,
  minPassRate: number,
  minSampleSize: number,
): Promise<ReliabilitySignal> {
  if (!deps.artifacts?.listEvidenceForProject) return 'INSUFFICIENT_SAMPLE';

  const [reviewEvidence, codeChangeEvidence] = await Promise.all([
    deps.artifacts.listEvidenceForProject(projectId, 'REVIEW_EVIDENCE'),
    deps.artifacts.listEvidenceForProject(projectId, 'CODE_CHANGE'),
  ]);

  const qualities = computeAgentVersionQuality(reviewEvidence, codeChangeEvidence);
  return resolveReliabilitySignal(qualities, agentVersionId, minPassRate, minSampleSize);
}
