import { randomUUID } from 'node:crypto';
import type { OrganisationId, ToolCapabilityRiskClass } from '@devos/contracts';
import type {
  Approval,
  ApprovalRepository,
  ArtifactVersionRepository,
  PolicyRepository,
  ProjectRepository,
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
  /**
   * DEVOS-146: only required to resolve risk-tiered approval requirements
   * from a real organisation policy when a node's own `config.riskClass` is
   * set. Optional — omitted entirely in every existing test/caller that
   * never configures a `riskClass`, mirroring `ToolGatewayDeps.agentVersions`'s
   * own optional-dependency pattern.
   */
  projects?: ProjectRepository;
  policies?: PolicyRepository;
}

interface ApprovalNodeConfig {
  approvalType?: string;
  /** Default 2s — how soon to re-check a still-`PENDING` approval's own status. */
  pollIntervalSeconds?: number;
  /**
   * DEVOS-146: an author-specified risk tier for this gate — the same kind
   * of real graph-authoring input `WAIT`'s `waitType`/`CONDITION`'s `rule`
   * already are. When set, and `projects`/`policies` are both supplied, the
   * organisation's own published policy for this `approvalType` is
   * consulted for `requiredApprovers`/`enforceSeparationOfDuties`.
   */
  riskClass?: ToolCapabilityRiskClass;
}

/**
 * DEVOS-146: mirrors `evaluatePolicies`'s own "highest published version per
 * key" precedence for the one matching rule found (a direct, small
 * duplication of that shape rather than exporting evaluator internals
 * across the `@devos/policy`/`@devos/application` package boundary — this
 * needs the rule's own extra `requiredApprovers`/`enforceSeparationOfDuties`
 * fields, not just its `effect`, which `evaluatePolicies`'s own return value
 * never surfaces).
 */
async function resolveApprovalRequirements(
  deps: ApprovalTaskHandlerDeps,
  organisationId: OrganisationId,
  approvalType: string,
  riskClass: ToolCapabilityRiskClass | undefined,
): Promise<{ requiredApprovers: number; enforceSeparationOfDuties: boolean; requiredRejections: number }> {
  const defaults = { requiredApprovers: 1, enforceSeparationOfDuties: false, requiredRejections: 1 };
  if (!riskClass || !deps.policies) return defaults;

  const policies = await deps.policies.listForOrganisation(organisationId);
  const byKey = new Map<string, (typeof policies)[number]>();
  for (const policy of policies) {
    if (policy.status !== 'PUBLISHED') continue;
    const current = byKey.get(policy.key);
    if (!current || policy.version > current.version) byKey.set(policy.key, policy);
  }

  for (const policy of [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key))) {
    const definition = policy.definition as unknown as {
      rules?: Array<{
        action: string;
        condition?: { riskClass?: string };
        requiredApprovers?: number;
        enforceSeparationOfDuties?: boolean;
        requiredRejections?: number;
      }>;
    };
    const rule = definition.rules?.find(
      (candidate) =>
        candidate.action === approvalType && candidate.condition?.riskClass === riskClass,
    );
    if (rule) {
      return {
        requiredApprovers: rule.requiredApprovers ?? defaults.requiredApprovers,
        enforceSeparationOfDuties:
          rule.enforceSeparationOfDuties ?? defaults.enforceSeparationOfDuties,
        requiredRejections: rule.requiredRejections ?? defaults.requiredRejections,
      };
    }
  }

  return defaults;
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
    // DEVOS-146: risk-tiered routing — real defaults unless the node names
    // a riskClass and the project's own organisation has a real published
    // policy naming stricter requirements for it.
    const project = deps.projects ? await deps.projects.getById(run.projectId) : null;
    const { requiredApprovers, enforceSeparationOfDuties, requiredRejections } = project
      ? await resolveApprovalRequirements(
          deps,
          project.organisationId,
          approvalType,
          config?.riskClass,
        )
      : { requiredApprovers: 1, enforceSeparationOfDuties: false, requiredRejections: 1 };
    const created: Approval = {
      id: randomUUID() as Approval['id'],
      projectId: run.projectId,
      workflowRunId: run.id,
      approvalType,
      status: 'PENDING',
      requestedBy: SYSTEM_ACTOR_ID,
      // Gap revisit: real ABAC context, sourced from data already resolved
      // above — the node's own author-specified riskClass, and the real
      // workflow version this run is actually executing.
      ...(config?.riskClass !== undefined ? { riskClass: config.riskClass } : {}),
      workflowId: version.workflowDefinitionId,
      workflowVersion: version.version,
      evidenceReference: {
        artifactVersionIds,
        scopeHash: computeScopeHash(artifactVersionIds),
      },
      requestedAt: now,
      requiredApprovers,
      enforceSeparationOfDuties,
      requiredRejections,
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

  // DEVOS-145: expiry is a permanent failure exactly like rejection — the
  // existing queue.fail()/resolveTaskFailure() path (including DEVOS-120's
  // tolerant-JOIN semantics) decides whether that fails just this branch or
  // the whole run.
  if (approval.status === 'EXPIRED') {
    throw new NonRetryableTaskError(
      `Approval for node "${task.taskKey}" expired before it was decided.`,
    );
  }

  return { status: 'SUCCEEDED', approvalId: approval.id, decidedBy: approval.decidedBy };
}
