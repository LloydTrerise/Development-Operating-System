import { randomUUID } from 'node:crypto';
import type { OrganisationId, ToolCapabilityRiskClass } from '@devos/contracts';
import type {
  Approval,
  ApprovalRepository,
  ArtifactVersionRepository,
  PolicyRepository,
  ProjectRepository,
  WorkflowRun,
  WorkflowRunRepository,
  WorkflowTask,
  WorkflowTaskRepository,
  WorkflowVersionRepository,
} from '@devos/domain';
import { NonRetryableTaskError } from '@devos/domain';
import { computeScopeHash } from '../approval/request-approval.js';
import {
  resolveApprovalReliability,
  type ArtifactEvidenceReader,
} from '../approval/resolve-approval-reliability.js';

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
  /**
   * DEVOS-199: only required to resolve a node's own `config.reliabilityReduction`
   * against real captured reliability evidence (DEVOS-198). Optional —
   * omitted entirely in every existing test/caller that never configures a
   * `reliabilityReduction`, mirroring this same file's own `projects`/`policies`
   * optional-dependency pattern.
   */
  artifacts?: ArtifactEvidenceReader;
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
  /**
   * DEVOS-199: an additive, floor-protected reduction of `requiredApprovers`
   * — applied only when the named agent version's own real reliability
   * evidence (DEVOS-198) meets `minPassRate` with at least `minSampleSize`
   * reviews. `requiredApprovers` can never be reduced below 1 by this
   * mechanism, regardless of `reducedRequiredApprovers`'s own value.
   */
  reliabilityReduction?: {
    agentVersionId: string;
    minPassRate: number;
    minSampleSize: number;
    reducedRequiredApprovers: number;
  };
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
async function resolvePolicyTieredRequirements(
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

/**
 * DEVOS-199: applies `resolvePolicyTieredRequirements`'s existing
 * static/policy-tiered resolution first, unchanged, then — as one further,
 * purely additive step — consults `resolveApprovalReliability` (DEVOS-198)
 * when the node itself configured a `reliabilityReduction` and an
 * `artifacts` dependency is available. A `'MET'` signal can only ever
 * lower `requiredApprovers` (`Math.min` against the already-resolved
 * value) and never below the unconditional `Math.max(1, ...)` floor;
 * `'UNMET'`/`'INSUFFICIENT_SAMPLE'`, a missing `reliabilityReduction`, or a
 * missing `artifacts` dependency all leave `requiredApprovers` completely
 * untouched from the static/policy-tiered result.
 */
async function resolveApprovalRequirements(
  deps: ApprovalTaskHandlerDeps,
  organisationId: OrganisationId | undefined,
  projectId: WorkflowRun['projectId'],
  approvalType: string,
  riskClass: ToolCapabilityRiskClass | undefined,
  reliabilityReduction: ApprovalNodeConfig['reliabilityReduction'],
): Promise<{
  requiredApprovers: number;
  enforceSeparationOfDuties: boolean;
  requiredRejections: number;
  reliabilityEvidence?: Approval['reliabilityEvidence'];
}> {
  const resolved = organisationId
    ? await resolvePolicyTieredRequirements(deps, organisationId, approvalType, riskClass)
    : { requiredApprovers: 1, enforceSeparationOfDuties: false, requiredRejections: 1 };

  if (!reliabilityReduction || !deps.artifacts) return resolved;

  const signal = await resolveApprovalReliability(
    deps,
    projectId,
    reliabilityReduction.agentVersionId,
    reliabilityReduction.minPassRate,
    reliabilityReduction.minSampleSize,
  );

  if (signal !== 'MET') {
    return {
      ...resolved,
      reliabilityEvidence: { agentVersionId: reliabilityReduction.agentVersionId, signal },
    };
  }

  const requiredApprovers = Math.max(
    1,
    Math.min(resolved.requiredApprovers, reliabilityReduction.reducedRequiredApprovers),
  );
  return {
    ...resolved,
    requiredApprovers,
    reliabilityEvidence: {
      agentVersionId: reliabilityReduction.agentVersionId,
      signal,
      appliedReducedRequiredApprovers: requiredApprovers,
    },
  };
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
    // policy naming stricter requirements for it. DEVOS-199: a further,
    // additive reliability-conditioned reduction, applied after the above,
    // resolved from `run.projectId` directly so it works whether or not
    // `deps.projects` is supplied.
    const project = deps.projects ? await deps.projects.getById(run.projectId) : null;
    const { requiredApprovers, enforceSeparationOfDuties, requiredRejections, reliabilityEvidence } =
      await resolveApprovalRequirements(
        deps,
        project?.organisationId,
        run.projectId,
        approvalType,
        config?.riskClass,
        config?.reliabilityReduction,
      );
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
      ...(reliabilityEvidence !== undefined ? { reliabilityEvidence } : {}),
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
