import type {
  AgentInvocationRequest,
  AgentInvocationResult,
  AgentModelAdapter,
} from '../model-adapter.js';
import type { AgentFixture } from './fixture-repository.js';

/**
 * DEVOS-037: an AgentModelAdapter that replays recorded fixtures instead of
 * calling a live provider — keyed by role, since that's how this codebase's
 * seeded agents (discovery-agent, requirements-agent, etc.) already
 * distinguish themselves (see apps/worker/src/agent-task-router.ts's
 * equivalent routing-by-agentRef). An unrecognized role fails clearly,
 * exactly like a real provider reporting an error, rather than silently
 * returning nothing.
 */
export function createFixtureModelAdapter(
  fixturesByRole: Record<string, AgentFixture>,
): AgentModelAdapter {
  return {
    async invoke(request: AgentInvocationRequest): Promise<AgentInvocationResult> {
      const fixture = fixturesByRole[request.configuration.role];
      if (!fixture) {
        return {
          status: 'FAILED',
          errorMessage: `No fixture recorded for role "${request.configuration.role}".`,
        };
      }

      return {
        status: 'SUCCEEDED',
        result: fixture.result,
        modelReference: `${fixture.provider}:${fixture.modelRef} (fixture recorded ${fixture.recordedAt})`,
        ...(fixture.uncertainty !== undefined ? { uncertainty: fixture.uncertainty } : {}),
      };
    },
  };
}
