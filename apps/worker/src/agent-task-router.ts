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
  SEED_DEVELOPMENT_AGENT_KEY,
  SEED_DISCOVERY_AGENT_KEY,
  SEED_PLANNING_AGENT_KEY,
  SEED_REQUIREMENTS_AGENT_KEY,
  SEED_REVIEW_AGENT_KEY,
  SEED_TECHNICAL_DESIGN_AGENT_KEY,
} from '@devos/database';
import type { WorkflowTask } from '@devos/domain';

/**
 * DEVOS-035: there is one 'AGENT_TASK' WorkflowNodeType, not six (now
 * DEVOS-065), so the task queue/dispatcher (unchanged since Sprint 1) can
 * only register one handler for it. This is the routing layer underneath
 * that single registration, picking which of DEVOS-031–034/057/065's task
 * handlers actually runs for a given task, keyed by its agentRef (already
 * threaded into task.input by run-creation.ts). An unrecognized agentRef
 * fails the task clearly rather than silently doing nothing.
 *
 * `deps` is typed as `DevelopmentAgentTaskHandlerDeps & ReviewAgentTaskHandlerDeps`
 * (a superset of what every handler needs) rather than
 * `AgentArtifactConsumerTaskHandlerDeps` — each concrete handler simply
 * ignores the fields it doesn't use.
 */
export async function routeAgentTask(
  deps: DevelopmentAgentTaskHandlerDeps & ReviewAgentTaskHandlerDeps,
  task: WorkflowTask,
): Promise<Record<string, unknown>> {
  const agentRef = task.input.agentRef;

  switch (agentRef) {
    case SEED_DISCOVERY_AGENT_KEY:
      return runDiscoveryAgentTask(deps, task);
    case SEED_REQUIREMENTS_AGENT_KEY:
      return runRequirementsAgentTask(deps, task);
    case SEED_TECHNICAL_DESIGN_AGENT_KEY:
      return runTechnicalDesignAgentTask(deps, task);
    case SEED_PLANNING_AGENT_KEY:
      return runPlanningAgentTask(deps, task);
    case SEED_DEVELOPMENT_AGENT_KEY:
      return runDevelopmentAgentTask(deps, task);
    case SEED_REVIEW_AGENT_KEY:
      return runReviewAgentTask(deps, task);
    default:
      throw new Error(
        `No planning-path agent handler registered for agentRef "${String(agentRef)}" (task ${task.id}).`,
      );
  }
}
