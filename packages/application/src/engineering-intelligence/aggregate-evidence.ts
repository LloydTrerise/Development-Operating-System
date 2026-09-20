import {
  computeDoraReleaseMetrics,
  computeLeadTimeMs,
  computeReleaseRecoveryProxyMs,
  summarizeLeadTimes,
  type ArtifactEvidenceRow,
  type DoraReleaseMetrics,
  type LeadTimeSummary,
  type RecoveryProxySummary,
  type WorkItemReworkCount,
} from '@devos/domain';

export interface EvidenceRows {
  review: ArtifactEvidenceRow[];
  test: ArtifactEvidenceRow[];
  securityScan: ArtifactEvidenceRow[];
  release: ArtifactEvidenceRow[];
  /**
   * DEVOS-168: real `CODE_CHANGE` rows — **corrected during implementation**:
   * `getArtifactProvenance` (DEVOS-095) does not actually walk
   * `derivedFromArtifactId` (it only returns an artifact's own
   * `workflowRunId`/`workflowTaskId`, confirmed by direct inspection, not
   * assumed). The real chain is simpler than originally planned: every
   * evidence-writing task handler (`run-validation-task.ts`/
   * `run-security-scan-task.ts`/`run-review-agent-task.ts`/
   * `run-release-task.ts`) independently sets `derivedFromArtifactId` to
   * the *same* project's latest `CODE_CHANGE` artifact directly — a flat
   * one-hop link from each evidence type to its originating code change,
   * not a linear multi-hop chain. So lead time only needs this one extra
   * artifact type, fetched via DEVOS-163's existing generic
   * `listEvidenceForProject`/`listEvidenceForOrganisation('CODE_CHANGE')` —
   * no provenance-walk extension needed.
   */
  codeChange: ArtifactEvidenceRow[];
  reworkCycles: WorkItemReworkCount[];
}

export interface QualityReport {
  reviewCount: number;
  reviewPassCount: number;
  reviewPassRate: number;
  testCount: number;
  testPassCount: number;
  testPassRate: number;
  securityScanCount: number;
  securityScanPassCount: number;
  securityScanPassRate: number;
  deployCount: number;
  rollbackCount: number;
  reworkCycleCount: number;
  /** DEVOS-167: deployment frequency / change failure rate over the report's own period. */
  dora: DoraReleaseMetrics;
  /** DEVOS-168: real lead-time-for-changes distribution — see `EvidenceRows.codeChange`'s own doc comment for how it's matched. */
  leadTime: LeadTimeSummary;
  /** DEVOS-169: the release-based time-to-restore proxy (every project); the Incident Response proxy is added separately at the use-case level, project-scope only. */
  releaseRecoveryProxy: RecoveryProxySummary;
}

/** DEVOS-167: the default reporting window — a disclosed, unstated-by-any-spec default, not fabricated data. */
export const DEFAULT_DORA_PERIOD_DAYS = 30;

function rate(passCount: number, total: number): number {
  return total === 0 ? 0 : passCount / total;
}

/**
 * DEVOS-164/167: a pure aggregation over DEVOS-163's real evidence rows —
 * no I/O, no fabricated fields. `REVIEW_EVIDENCE.decision` is `'PASS' |
 * 'CHANGES_REQUIRED'` (never `'APPROVED'` — see
 * `specs/DEVOS-ENGINEERING-INTELLIGENCE-BACKLOG.md` §2's own correction);
 * `TEST_EVIDENCE`/`SECURITY_SCAN_EVIDENCE`/`RELEASE_EVIDENCE` each carry a
 * real `passed: boolean`; `RELEASE_EVIDENCE` additionally carries
 * `action: 'deploy' | 'rollback'` and a real `completedAt`, read here for
 * `computeDoraReleaseMetrics`'s own period filter.
 */
export function aggregateEngineeringEvidence(
  rows: EvidenceRows,
  period: { start: string; end: string },
): QualityReport {
  const reviewPassCount = rows.review.filter((row) => row.metadata.decision === 'PASS').length;
  const testPassCount = rows.test.filter((row) => row.metadata.passed === true).length;
  const securityScanPassCount = rows.securityScan.filter(
    (row) => row.metadata.passed === true,
  ).length;
  const deployCount = rows.release.filter((row) => row.metadata.action === 'deploy').length;
  const rollbackCount = rows.release.filter((row) => row.metadata.action === 'rollback').length;
  const reworkCycleCount = rows.reworkCycles.reduce((sum, row) => sum + row.reworkCount, 0);

  const dora = computeDoraReleaseMetrics(
    rows.release.map((row) => ({
      action: typeof row.metadata.action === 'string' ? row.metadata.action : '',
      passed: row.metadata.passed === true,
      completedAt:
        typeof row.metadata.completedAt === 'string' ? row.metadata.completedAt : row.createdAt,
    })),
    period.start,
    period.end,
  );

  const codeChangeGeneratedAtById = new Map<string, string>(
    rows.codeChange.map((row) => [
      row.artifactId,
      typeof row.metadata.generatedAt === 'string' ? row.metadata.generatedAt : row.createdAt,
    ]),
  );
  const leadTimeSamplesMs = rows.release
    .filter((row) => row.metadata.passed === true)
    .map((row) => {
      const derivedFromArtifactId =
        typeof row.metadata.derivedFromArtifactId === 'string'
          ? row.metadata.derivedFromArtifactId
          : undefined;
      const codeChangeGeneratedAt = derivedFromArtifactId
        ? codeChangeGeneratedAtById.get(derivedFromArtifactId)
        : undefined;
      if (!codeChangeGeneratedAt) return undefined;
      const releaseCompletedAt =
        typeof row.metadata.completedAt === 'string' ? row.metadata.completedAt : row.createdAt;
      return computeLeadTimeMs(codeChangeGeneratedAt, releaseCompletedAt);
    })
    .filter((sample): sample is number => sample !== undefined);
  const leadTime = summarizeLeadTimes(leadTimeSamplesMs);

  const releaseRecoveryProxy = computeReleaseRecoveryProxyMs(
    rows.release.map((row) => ({
      action: typeof row.metadata.action === 'string' ? row.metadata.action : '',
      passed: row.metadata.passed === true,
      completedAt:
        typeof row.metadata.completedAt === 'string' ? row.metadata.completedAt : row.createdAt,
    })),
  );

  return {
    reviewCount: rows.review.length,
    reviewPassCount,
    reviewPassRate: rate(reviewPassCount, rows.review.length),
    testCount: rows.test.length,
    testPassCount,
    testPassRate: rate(testPassCount, rows.test.length),
    securityScanCount: rows.securityScan.length,
    securityScanPassCount,
    securityScanPassRate: rate(securityScanPassCount, rows.securityScan.length),
    deployCount,
    rollbackCount,
    reworkCycleCount,
    dora,
    leadTime,
    releaseRecoveryProxy,
  };
}
