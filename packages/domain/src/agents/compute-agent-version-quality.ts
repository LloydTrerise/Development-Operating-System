import type { ArtifactEvidenceRow } from '../artifacts/artifact.js';

export interface AgentVersionQuality {
  agentVersionId: string;
  reviewCount: number;
  passCount: number;
  passRate: number;
}

/**
 * DEVOS-174: a real per-developer-agent-version review pass rate — a pure
 * computation, no I/O. `CODE_CHANGE.metadata.agentVersionId` already
 * records the real developer `AgentVersion` that wrote a change;
 * `REVIEW_EVIDENCE.metadata.derivedFromArtifactId` already points back at
 * that same `CODE_CHANGE` (confirmed by direct inspection before this was
 * written — a real, already-captured one-hop link, not new capture, the
 * same shape as E24's own `computeLeadTimeMs`). A `REVIEW_EVIDENCE` row
 * whose `derivedFromArtifactId` doesn't resolve to a known `CODE_CHANGE`
 * is excluded, never fabricated into a `0`.
 */
export function computeAgentVersionQuality(
  reviewEvidence: ArtifactEvidenceRow[],
  codeChangeEvidence: ArtifactEvidenceRow[],
): AgentVersionQuality[] {
  const developerAgentVersionByCodeChangeId = new Map<string, string>(
    codeChangeEvidence
      .filter((row) => typeof row.metadata.agentVersionId === 'string')
      .map((row) => [row.artifactId, row.metadata.agentVersionId as string]),
  );

  const totalsByAgentVersionId = new Map<string, { reviewCount: number; passCount: number }>();

  for (const row of reviewEvidence) {
    const derivedFromArtifactId =
      typeof row.metadata.derivedFromArtifactId === 'string'
        ? row.metadata.derivedFromArtifactId
        : undefined;
    const agentVersionId = derivedFromArtifactId
      ? developerAgentVersionByCodeChangeId.get(derivedFromArtifactId)
      : undefined;
    if (!agentVersionId) continue;

    const existing = totalsByAgentVersionId.get(agentVersionId) ?? {
      reviewCount: 0,
      passCount: 0,
    };
    totalsByAgentVersionId.set(agentVersionId, {
      reviewCount: existing.reviewCount + 1,
      passCount: existing.passCount + (row.metadata.decision === 'PASS' ? 1 : 0),
    });
  }

  return Array.from(totalsByAgentVersionId.entries()).map(
    ([agentVersionId, { reviewCount, passCount }]) => ({
      agentVersionId,
      reviewCount,
      passCount,
      passRate: reviewCount === 0 ? 0 : passCount / reviewCount,
    }),
  );
}
