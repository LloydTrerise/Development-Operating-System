import {
  runDevelopmentAgentTask,
  runDiscoveryAgentTask,
  runPlanningAgentTask,
  runRequirementsAgentTask,
  runReviewAgentTask,
  runTechnicalDesignAgentTask,
  type DevelopmentAgentTaskHandlerDeps,
  type ReviewAgentTaskHandlerDeps,
} from '@devos/application';
import {
  computeAgentVersionQuality,
  selectAgentForTask,
  type Agent,
  type AgentVersion,
  type WorkflowTask,
} from '@devos/domain';

type ProjectId = Agent['projectId'];

type RouterDeps = DevelopmentAgentTaskHandlerDeps & ReviewAgentTaskHandlerDeps;
type RoleHandler = (deps: RouterDeps, task: WorkflowTask) => Promise<Record<string, unknown>>;

/**
 * specs/architecture/organisations-and-project-types.md §6: the agent
 * behaviors below are role-specific (each publishes a specific artifact type
 * and reads specific prior-stage context), so dispatch is keyed by the
 * resolved agent's role — not by a literal agentRef string — since any
 * project's cloned or custom-created agents can use whatever keys they like
 * as long as their role is one of these six.
 */
const ROLE_HANDLERS: Record<string, RoleHandler> = {
  DISCOVERY: runDiscoveryAgentTask,
  REQUIREMENTS: runRequirementsAgentTask,
  TECHNICAL_DESIGN: runTechnicalDesignAgentTask,
  PLANNING: runPlanningAgentTask,
  DEVELOPMENT: runDevelopmentAgentTask,
  REVIEW: runReviewAgentTask,
};

/**
 * DEVOS-035: there is one 'AGENT_TASK' WorkflowNodeType, not six (now
 * DEVOS-065), so the task queue/dispatcher (unchanged since Sprint 1) can
 * only register one handler for it. This is the routing layer underneath
 * that single registration, picking which of DEVOS-031–034/057/065's task
 * handlers actually runs for a given task.
 *
 * specs/architecture/organisations-and-project-types.md §6 (closing gap G1
 * from DEVOS-PRODUCTION-READINESS-ROADMAP.md): resolves the task's agentRef
 * against the run's own project — exactly the same
 * `agents.getByProjectAndKey` + latest-published-version lookup
 * `runAgentTask` performs internally — and dispatches by that version's
 * `configuration.role`. This makes routing work for any project's own
 * cloned or custom-created agents, not just the one seeded project's six
 * literal key strings. An agentRef that doesn't resolve to an agent, or
 * resolves to one with no published version or an unrecognized role, fails
 * the task clearly rather than silently doing nothing.
 *
 * `deps` is typed as `DevelopmentAgentTaskHandlerDeps & ReviewAgentTaskHandlerDeps`
 * (a superset of what every handler needs) rather than
 * `AgentArtifactConsumerTaskHandlerDeps` — each concrete handler simply
 * ignores the fields it doesn't use.
 *
 * DEVOS-159: when a task has no literal `agentRef` (only `requiredRole`,
 * optionally `requiredCapabilities` — DEVOS-158), resolution instead goes
 * through `selectAgentForTask` against every published candidate agent in
 * the run's own project. `agentRef`, when present, always takes this
 * function's original single-key path unchanged — see
 * specs/DEVOS-AGENT-SELECTION-BACKLOG.md.
 */
/**
 * DEVOS-159: every candidate agent in the given project, paired with its own
 * latest `PUBLISHED` version — the real input `selectAgentForTask` needs. A
 * project's own agent roster is small (six in the seeded project; DEVOS-161's
 * pilot is the first to ever exceed one agent per role), so no caching.
 */
async function listPublishedCandidates(
  deps: RouterDeps,
  projectId: ProjectId,
): Promise<{ agent: Agent; version: AgentVersion }[]> {
  const agents = await deps.agents.listForProject(projectId);
  const candidates: { agent: Agent; version: AgentVersion }[] = [];
  for (const agent of agents) {
    const versions = await deps.agentVersions.listForAgent(agent.id);
    const version = versions
      .filter((candidate) => candidate.status === 'PUBLISHED')
      .sort((a, b) => b.version - a.version)[0];
    if (version) candidates.push({ agent, version });
  }
  return candidates;
}

/**
 * DEVOS-179 (Sprint 23): the real per-agent-version quality signal
 * (E25's own `computeAgentVersionQuality`, DEVOS-174), reused here as
 * `selectAgentForTask`'s optional second sort key. `deps.artifacts` is
 * already a required dependency of every real caller of this router (both
 * `DevelopmentAgentTaskHandlerDeps` and `ReviewAgentTaskHandlerDeps`
 * already require it) — no new dependency added; only the optional
 * `listEvidenceForProject` method (DEVOS-163) may be absent on a fake.
 */
async function getQualityByAgentVersionId(
  deps: RouterDeps,
  projectId: ProjectId,
): Promise<Map<string, number>> {
  if (!deps.artifacts.listEvidenceForProject) return new Map();

  const [reviewEvidence, codeChangeEvidence] = await Promise.all([
    deps.artifacts.listEvidenceForProject(projectId, 'REVIEW_EVIDENCE'),
    deps.artifacts.listEvidenceForProject(projectId, 'CODE_CHANGE'),
  ]);
  const quality = computeAgentVersionQuality(reviewEvidence, codeChangeEvidence);
  return new Map(quality.map((row) => [row.agentVersionId, row.passRate]));
}

export async function routeAgentTask(
  deps: RouterDeps,
  task: WorkflowTask,
): Promise<Record<string, unknown>> {
  const agentRef = task.input.agentRef;
  const requiredRole = task.input.requiredRole;
  const hasAgentRef = typeof agentRef === 'string' && agentRef.trim().length > 0;
  const hasRequiredRole = typeof requiredRole === 'string' && requiredRole.trim().length > 0;

  if (!hasAgentRef && !hasRequiredRole) {
    throw new Error(`Task ${task.id} has no agentRef or requiredRole configured.`);
  }

  const run = await deps.workflowRuns.getById(task.workflowRunId);
  if (!run) throw new Error(`Workflow run ${task.workflowRunId} not found.`);

  let selected: { agent: Agent; version: AgentVersion } | null;

  if (hasAgentRef) {
    const agent = await deps.agents.getByProjectAndKey(run.projectId, agentRef as string);
    if (!agent) {
      throw new Error(
        `No agent handler registered for agentRef "${agentRef}" (task ${task.id}): no agent with that key exists in project ${run.projectId}.`,
      );
    }
    const versions = await deps.agentVersions.listForAgent(agent.id);
    const version = versions
      .filter((candidate) => candidate.status === 'PUBLISHED')
      .sort((a, b) => b.version - a.version)[0];
    if (!version) {
      throw new Error(
        `No agent handler registered for agentRef "${agentRef}" (task ${task.id}): agent has no published version.`,
      );
    }
    selected = { agent, version };
  } else {
    // DEVOS-159: no literal agentRef — resolve by role/capability instead.
    const requiredCapabilities = Array.isArray(task.input.requiredCapabilities)
      ? (task.input.requiredCapabilities as string[])
      : [];
    const candidates = await listPublishedCandidates(deps, run.projectId);
    const qualityByAgentVersionId = await getQualityByAgentVersionId(deps, run.projectId);
    selected = selectAgentForTask(
      candidates,
      requiredRole as string,
      requiredCapabilities,
      qualityByAgentVersionId,
    );
    if (!selected) {
      throw new Error(
        `No agent handler registered for requiredRole "${requiredRole}" (task ${task.id}): no published agent in project ${run.projectId} matches that role and capabilities [${requiredCapabilities.join(', ')}].`,
      );
    }
  }

  const handler = ROLE_HANDLERS[selected.version.configuration.role];
  if (!handler) {
    const ref = hasAgentRef ? `agentRef "${agentRef}"` : `requiredRole "${requiredRole}"`;
    throw new Error(
      `No agent handler registered for ${ref} (task ${task.id}): unrecognized role "${selected.version.configuration.role}".`,
    );
  }

  // DEVOS-159: `runAgentTask` (packages/application/src/tasks/run-agent-task.ts,
  // called by every ROLE_HANDLERS entry) independently re-resolves
  // `task.input.agentRef` for its own execution-record bookkeeping — it has
  // no knowledge of role/capability resolution. Rather than changing that
  // already-proven resolution path (used identically by every existing
  // agentRef-only workflow), a role-targeted task is handed to the handler
  // with `agentRef` set to the real agent's own key this router just
  // resolved — `runAgentTask` then re-derives the exact same agent/version
  // deterministically, with zero change to its own logic.
  const resolvedTask: WorkflowTask = hasAgentRef
    ? task
    : { ...task, input: { ...task.input, agentRef: selected.agent.key } };

  return handler(deps, resolvedTask);
}
