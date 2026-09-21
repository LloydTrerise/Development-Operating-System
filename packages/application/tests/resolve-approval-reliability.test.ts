import { randomUUID } from 'node:crypto';
import type { ArtifactEvidenceRow } from '@devos/domain';
import type { ProjectId } from '@devos/contracts';
import { describe, expect, it } from 'vitest';
import {
  resolveApprovalReliability,
  type ArtifactEvidenceReader,
} from '../src/approval/resolve-approval-reliability.js';

function row(metadata: Record<string, unknown>, artifactId?: string): ArtifactEvidenceRow {
  return {
    artifactId: (artifactId ?? randomUUID()) as ArtifactEvidenceRow['artifactId'],
    createdAt: new Date().toISOString(),
    metadata,
  };
}

describe('resolveApprovalReliability', () => {
  it('wires real REVIEW_EVIDENCE/CODE_CHANGE evidence into the pure reliability signal', async () => {
    const projectId = randomUUID() as ProjectId;
    const agentVersionId = randomUUID();
    const codeChangeA = randomUUID();
    const codeChangeB = randomUUID();
    const codeChangeC = randomUUID();

    const codeChangeEvidence = [
      row({ agentVersionId }, codeChangeA),
      row({ agentVersionId }, codeChangeB),
      row({ agentVersionId }, codeChangeC),
    ];
    const reviewEvidence = [
      row({ decision: 'PASS', derivedFromArtifactId: codeChangeA }),
      row({ decision: 'PASS', derivedFromArtifactId: codeChangeB }),
      row({ decision: 'PASS', derivedFromArtifactId: codeChangeC }),
    ];

    const artifacts: ArtifactEvidenceReader = {
      listEvidenceForProject: async (_projectId, artifactType) =>
        artifactType === 'REVIEW_EVIDENCE' ? reviewEvidence : codeChangeEvidence,
    };

    const signal = await resolveApprovalReliability(
      { artifacts },
      projectId,
      agentVersionId,
      0.8,
      3,
    );

    expect(signal).toBe('MET');
  });

  it('returns INSUFFICIENT_SAMPLE when no artifacts dependency is supplied', async () => {
    const signal = await resolveApprovalReliability(
      {},
      randomUUID() as ProjectId,
      randomUUID(),
      0.8,
      3,
    );

    expect(signal).toBe('INSUFFICIENT_SAMPLE');
  });

  it('returns UNMET when real evidence exists but the pass rate is below the minimum', async () => {
    const projectId = randomUUID() as ProjectId;
    const agentVersionId = randomUUID();
    const codeChangeA = randomUUID();
    const codeChangeB = randomUUID();
    const codeChangeC = randomUUID();

    const codeChangeEvidence = [
      row({ agentVersionId }, codeChangeA),
      row({ agentVersionId }, codeChangeB),
      row({ agentVersionId }, codeChangeC),
    ];
    const reviewEvidence = [
      row({ decision: 'PASS', derivedFromArtifactId: codeChangeA }),
      row({ decision: 'CHANGES_REQUIRED', derivedFromArtifactId: codeChangeB }),
      row({ decision: 'CHANGES_REQUIRED', derivedFromArtifactId: codeChangeC }),
    ];

    const artifacts: ArtifactEvidenceReader = {
      listEvidenceForProject: async (_projectId, artifactType) =>
        artifactType === 'REVIEW_EVIDENCE' ? reviewEvidence : codeChangeEvidence,
    };

    const signal = await resolveApprovalReliability(
      { artifacts },
      projectId,
      agentVersionId,
      0.8,
      3,
    );

    expect(signal).toBe('UNMET');
  });
});
