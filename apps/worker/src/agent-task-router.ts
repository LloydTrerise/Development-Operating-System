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
import type { WorkflowTask } from '@devos/domain';

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
 */
export async function routeAgentTask(
  deps: RouterDeps,
  task: WorkflowTask,
): Promise<Record<string, unknown>> {
  const agentRef = task.input.agentRef;
  if (typeof agentRef !== 'string' || agentRef.trim().length === 0) {
    throw new Error(`Task ${task.id} has no agentRef configured.`);
  }

  const run = await deps.workflowRuns.getById(task.workflowRunId);
  if (!run) throw new Error(`Workflow run ${task.workflowRunId} not found.`);

  const agent = await deps.agents.getByProjectAndKey(run.projectId, agentRef);
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

  const handler = ROLE_HANDLERS[version.configuration.role];
  if (!handler) {
    throw new Error(
      `No agent handler registered for agentRef "${agentRef}" (task ${task.id}): unrecognized role "${version.configuration.role}".`,
    );
  }

  return handler(deps, task);
}
