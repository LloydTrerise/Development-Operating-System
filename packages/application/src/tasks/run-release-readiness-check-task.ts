import type { WorkflowTask } from '@devos/domain';
import {
  evaluateReleaseReadiness,
  gatherReleaseReadinessEvidence,
} from '../workflows/evaluate-release-readiness.js';
import type { ToolTaskHandlerDeps } from './deps.js';

/**
 * The single node of the seeded `release-path` workflow (DEVOS-073): a
 * deterministic gate, not an agent — reuses DEVOS-069's evaluator and
 * evidence-gathering exactly, rather than recomputing readiness a second
 * way. Unlike `runValidationTask` (where a failing build/test is expected,
 * meaningful *data* the published evidence artifact exists to capture),
 * "not ready" here has nothing further to capture — there is no release
 * readiness evidence artifact, only the already-published `TEST_EVIDENCE`/
 * `REVIEW_EVIDENCE` this re-checks — so this task simply fails when the
 * release is not ready, which fails the run before it can ever reach the
 * release-approval gate (`maybeCompleteRun`, `packages/database/src/repositories/task-queue.ts`):
 * a human is never asked to approve a release with no passing evidence
 * behind it (Sprint-wide acceptance criterion, `specs/sprints/sprint-06/README.md`).
 *
 * On success, this task's only output is that it succeeded — the run's one
 * task now being SUCCEEDED is exactly what lets `maybeCompleteRun` proceed
 * to check the run's `release-approval` policy marker instead of completing
 * outright, mirroring DEVOS-047's planning-approval gate precedent.
 */
export async function runReleaseReadinessCheckTask(
  deps: ToolTaskHandlerDeps,
  task: WorkflowTask,
): Promise<Record<string, unknown>> {
  const run = await deps.workflowRuns.getById(task.workflowRunId);
  if (!run) throw new Error(`Workflow run ${task.workflowRunId} not found.`);

  const evidence = await gatherReleaseReadinessEvidence(deps, run.projectId);
  const result = evaluateReleaseReadiness(evidence);

  if (!result.ready) {
    throw new Error(
      `Release is not ready for project ${run.projectId}: ${result.reasons.join(' ')}`,
    );
  }

  return {
    status: 'SUCCEEDED',
    ready: result.ready,
    evidence: result.evidence,
  };
}
