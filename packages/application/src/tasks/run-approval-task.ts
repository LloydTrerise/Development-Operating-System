import { randomUUID } from 'node:crypto';
import type {
  Approval,
  ApprovalRepository,
  ArtifactVersionRepository,
  WorkflowRunRepository,
  WorkflowTask,
  WorkflowTaskRepository,
  WorkflowVersionRepository,
} from '@devos/domain';
import { NonRetryableTaskError } from '@devos/domain';
import { computeScopeHash } from '../approval/request-approval.js';

export interface ApprovalTaskHandlerDeps {
  workflowRuns: WorkflowRunRepository;
  workflowVersions: WorkflowVersionRepository;
  workflowTasks: WorkflowTaskRepository;
  artifactVersions: ArtifactVersionRepository;
  approvals: ApprovalRepository;
}

interface ApprovalNodeConfig {
  approvalType?: string;
  /** Default 2s — how soon to re-check a still-`PENDING` approval's own status. */
  pollIntervalSeconds?: number;
}

const SYSTEM_ACTOR_ID = 'devos-worker';
const DEFAULT_POLL_INTERVAL_SECONDS = 2;

/**
 * Resolves the latest `ArtifactVersion` id for every artifact this run's own
 * prior tasks have produced so far — the same `output.artifactId`
 * convention `run-condition-task.ts`'s artifact-source rule already reads —
 * so a node-scoped approval binds real evidence the same way the two
 * existing whole-run gates do (`task-queue.ts`'s
 * `collectRunArtifactVersionIds`), without a new `ArtifactRepository` port:
 * every artifact-producing task handler in this codebase already returns
 * `artifactId` in its own output.
 */
async function collectRunArtifactVersionIds(
  deps: ApprovalTaskHandlerDeps,
  workflowRunId: WorkflowTask['workflowRunId'],
): Promise<string[]> {
  const tasks = await deps.workflowTasks.listForRun(workflowRunId);
  const artifactIds = new Set<string>();
  for (const candidate of tasks) {
    const artifactId = candidate.output?.artifactId;
    if (typeof artifactId === 'string') artifactIds.add(artifactId);
  }

  const versionIds: string[] = [];
  for (const artifactId of artifactIds) {
    const versions = await deps.artifactVersions.listForArtifact(
      artifactId as Parameters<ArtifactVersionRepository['listForArtifact']>[0],
    );
    const latest = versions.reduce<(typeof versions)[number] | undefined>(
      (max, candidate) => (!max || candidate.version > max.version ? candidate : max),
      undefined,
    );
    if (latest) versionIds.push(latest.id);
  }
  return versionIds;
}

/**
 * DEVOS-122: an `APPROVAL` node's real handler. Creates a real, policy-gated
 * approval request — decided through the existing, completely unchanged
 * DEVOS-110/111 decision path (`decideApproval`/`transitionAfterApprovalDecisionInTrx`)
 * — at the point in the graph it's actually placed, gating only its own
 * downstream dependents via the existing `dependsOn` barrier, not the whole
 * run. Reuses DEVOS-121's `WAIT` mechanism verbatim: "not decided yet" is
 * reported via the reserved `waitUntil` output key, so the dispatcher parks
 * this task `WAITING` and resumes it on the same periodic tick `WAIT`
 * already uses — no new task-queue machinery.
 *
 * Every call re-resolves its own approval via `approvals.listForRun()`
 * filtered by this node's own deterministic `approvalType`, rather than
 * round-tripping the created approval's id through the task's own `output`
 * — `TaskQueue.markWaiting()` (DEVOS-121) only ever persists `{ waitUntil }`
 * across a WAITING/resume cycle, discarding any other key a handler
 * returned, so `approvalId` would not survive being parked.
 *
 * The run's own `AWAITING_APPROVAL` status is never touched by this
 * handler. `transitionAfterApprovalDecisionInTrx`'s existing
 * `run.status !== 'AWAITING_APPROVAL'` guard already makes deciding a
 * non-gating approval a safe no-op on the run — exactly what a node-scoped
 * approval is, since the run stays `PENDING` the whole time this task is
 * awaiting its own decision. A `REJECTED` decision instead throws
 * `NonRetryableTaskError`, so the normal `queue.fail()`/`resolveTaskFailure()`
 * path (including DEVOS-120's tolerant-`JOIN` semantics) decides whether
 * that fails just this branch or the whole run — identical to any other
 * permanently-failed task.
 */
export async function runApprovalTask(
  deps: ApprovalTaskHandlerDeps,
  task: WorkflowTask,
): Promise<Record<string, unknown>> {
  const run = await deps.workflowRuns.getById(task.workflowRunId);
  if (!run) throw new Error(`Workflow run ${task.workflowRunId} not found.`);

  const version = await deps.workflowVersions.getById(run.workflowVersionId);
  if (!version) throw new Error(`Workflow version ${run.workflowVersionId} not found.`);

  const node = version.definition.nodes.find((candidate) => candidate.id === task.taskKey);
  if (!node) throw new Error(`APPROVAL node "${task.taskKey}" not found in workflow definition.`);

  const config = node.config as unknown as ApprovalNodeConfig | undefined;
  const pollIntervalSeconds = config?.pollIntervalSeconds ?? DEFAULT_POLL_INTERVAL_SECONDS;
  const approvalType = config?.approvalType
    ? `${config.approvalType}:${task.taskKey}`
    : task.taskKey;

  const runApprovals = await deps.approvals.listForRun(task.workflowRunId);
  const approval = runApprovals.find((candidate) => candidate.approvalType === approvalType);

  if (!approval) {
    const artifactVersionIds = await collectRunArtifactVersionIds(deps, task.workflowRunId);
    const now = new Date().toISOString();
    const created: Approval = {
      id: randomUUID() as Approval['id'],
      projectId: run.projectId,
      workflowRunId: run.id,
      approvalType,
      status: 'PENDING',
      requestedBy: SYSTEM_ACTOR_ID,
      evidenceReference: {
        artifactVersionIds,
        scopeHash: computeScopeHash(artifactVersionIds),
      },
      requestedAt: now,
    };
    await deps.approvals.create(created);

    const waitUntil = new Date(Date.now() + pollIntervalSeconds * 1000).toISOString();
    return { approvalId: created.id, waitUntil };
  }

  if (approval.status === 'PENDING') {
    const waitUntil = new Date(Date.now() + pollIntervalSeconds * 1000).toISOString();
    return { approvalId: approval.id, waitUntil };
  }

  if (approval.status === 'REJECTED') {
    throw new NonRetryableTaskError(
      `Approval for node "${task.taskKey}" was rejected${
        approval.decisionReason ? `: ${approval.decisionReason}` : '.'
      }`,
    );
  }

  return { status: 'SUCCEEDED', approvalId: approval.id, decidedBy: approval.decidedBy };
}
