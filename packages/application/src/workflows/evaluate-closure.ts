import {
  evaluateReleaseReadiness,
  type ReleaseReadinessEvidence,
} from './evaluate-release-readiness.js';

export interface ClosureApprovalEvidence {
  approvalId: string;
  status: string;
}

export interface ClosureReleaseEvidence {
  artifactId: string;
  passed: boolean;
}

export interface ClosureEvidence extends ReleaseReadinessEvidence {
  releaseApproval?: ClosureApprovalEvidence;
  releaseEvidence?: ClosureReleaseEvidence;
}

export interface ClosureResult {
  closed: boolean;
  reasons: string[];
  evidence: ClosureEvidence;
}

/**
 * Stage 12 — Closure (specs/workflows/software-change-workflow.md §23):
 * "Closure occurs only when the required workflow success criteria are
 * satisfied." Deliberately a pure function — no model call — matching
 * DEVOS-044/069's evaluator precedent exactly (the same evidence always
 * yields the same verdict, Workflow Principle 12, §8). Composes DEVOS-069's
 * `evaluateReleaseReadiness` rather than re-checking test/review evidence a
 * second way: closure's own two additional requirements (§22's "required
 * approval," §23's "release evidence") are checked on top of it, since
 * closure is release-readiness plus what release itself produced.
 *
 * §23 also lists "final artifacts," "execution history," and "audit
 * information" among what closure publishes — those are properties of
 * *what closure does when it succeeds* (linking artifact/approval ids,
 * writing an audit record — see `createWorkItemCloser`,
 * `packages/database/src/repositories/close-work-item.ts`), not additional
 * pass/fail checks this evaluator itself performs.
 */
export function evaluateClosure(evidence: ClosureEvidence): ClosureResult {
  const releaseReadiness = evaluateReleaseReadiness({
    ...(evidence.testEvidence !== undefined ? { testEvidence: evidence.testEvidence } : {}),
    ...(evidence.reviewEvidence !== undefined ? { reviewEvidence: evidence.reviewEvidence } : {}),
    ...(evidence.securityScanEvidence !== undefined
      ? { securityScanEvidence: evidence.securityScanEvidence }
      : {}),
  });
  const reasons = [...releaseReadiness.reasons];

  if (!evidence.releaseApproval) {
    reasons.push('No release approval found.');
  } else if (evidence.releaseApproval.status !== 'APPROVED') {
    reasons.push(`Release approval is "${evidence.releaseApproval.status}", not "APPROVED".`);
  }

  if (!evidence.releaseEvidence) {
    reasons.push('No release evidence found.');
  } else if (!evidence.releaseEvidence.passed) {
    reasons.push('Release evidence shows a failing post-release validation.');
  }

  return { closed: reasons.length === 0, reasons, evidence };
}
