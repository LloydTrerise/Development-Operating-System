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
 *
 * DEVOS-071: a role may also be given an *array* of fixtures — each
 * invocation of that role consumes the next one in sequence, holding on
 * the last once exhausted. Needed to exercise a genuine rework loop
 * end-to-end with fixtures: the review agent's real decision is entirely
 * determined by the fixture (not reactive to its actual input), so a
 * single static fixture can't produce `CHANGES_REQUIRED` on a first
 * attempt and `PASS` on the reworked one — a sequence can. Single-fixture
 * roles are unaffected (every existing caller keeps working unchanged).
 */
export function createFixtureModelAdapter(
  fixturesByRole: Record<string, AgentFixture | AgentFixture[]>,
): AgentModelAdapter {
  const invocationCountByRole = new Map<string, number>();

  return {
    async invoke(request: AgentInvocationRequest): Promise<AgentInvocationResult> {
      const role = request.configuration.role;
      const entry = fixturesByRole[role];
      if (!entry) {
        return {
          status: 'FAILED',
          errorMessage: `No fixture recorded for role "${role}".`,
        };
      }

      let fixture: AgentFixture;
      if (Array.isArray(entry)) {
        const count = invocationCountByRole.get(role) ?? 0;
        invocationCountByRole.set(role, count + 1);
        fixture = entry[Math.min(count, entry.length - 1)]!;
      } else {
        fixture = entry;
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
