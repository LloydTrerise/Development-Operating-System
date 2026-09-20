import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { computeAgentVersionQuality } from '../src/agents/compute-agent-version-quality.js';
import type { ArtifactEvidenceRow } from '../src/artifacts/artifact.js';

function row(metadata: Record<string, unknown>, artifactId?: string): ArtifactEvidenceRow {
  return {
    artifactId: (artifactId ?? randomUUID()) as ArtifactEvidenceRow['artifactId'],
    createdAt: new Date().toISOString(),
    metadata,
  };
}

describe('computeAgentVersionQuality', () => {
  it('attributes real review outcomes to the real developer agent version via the CODE_CHANGE link', () => {
    const codeChangeA = randomUUID();
    const codeChangeB = randomUUID();
    const agentVersionA = randomUUID();
    const agentVersionB = randomUUID();

    const codeChangeEvidence = [
      row({ agentVersionId: agentVersionA }, codeChangeA),
      row({ agentVersionId: agentVersionA }, codeChangeB),
    ];
    const reviewEvidence = [
      row({ decision: 'PASS', derivedFromArtifactId: codeChangeA }),
      row({ decision: 'CHANGES_REQUIRED', derivedFromArtifactId: codeChangeB }),
    ];

    const result = computeAgentVersionQuality(reviewEvidence, codeChangeEvidence);

    expect(result).toHaveLength(1);
    expect(result[0]!.agentVersionId).toBe(agentVersionA);
    expect(result[0]!.reviewCount).toBe(2);
    expect(result[0]!.passCount).toBe(1);
    expect(result[0]!.passRate).toBeCloseTo(0.5, 6);
    // agentVersionB never appears — it wrote no reviewed CODE_CHANGE.
    expect(result.find((r) => r.agentVersionId === agentVersionB)).toBeUndefined();
  });

  it('excludes a REVIEW_EVIDENCE row whose derivedFromArtifactId does not resolve to a known CODE_CHANGE', () => {
    const result = computeAgentVersionQuality(
      [row({ decision: 'PASS', derivedFromArtifactId: randomUUID() })],
      [],
    );
    expect(result).toHaveLength(0);
  });

  it('computes two distinct, correct rates for two distinct agent versions', () => {
    const codeChangeA = randomUUID();
    const codeChangeB = randomUUID();
    const agentVersionA = randomUUID();
    const agentVersionB = randomUUID();

    const codeChangeEvidence = [
      row({ agentVersionId: agentVersionA }, codeChangeA),
      row({ agentVersionId: agentVersionB }, codeChangeB),
    ];
    const reviewEvidence = [
      row({ decision: 'PASS', derivedFromArtifactId: codeChangeA }),
      row({ decision: 'CHANGES_REQUIRED', derivedFromArtifactId: codeChangeB }),
    ];

    const result = computeAgentVersionQuality(reviewEvidence, codeChangeEvidence);
    const byId = new Map(result.map((r) => [r.agentVersionId, r]));

    expect(byId.get(agentVersionA)?.passRate).toBe(1);
    expect(byId.get(agentVersionB)?.passRate).toBe(0);
  });
});
