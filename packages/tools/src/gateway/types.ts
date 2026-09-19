import type { AgentVersionId, WorkflowVersionId } from '@devos/contracts';

export interface ProviderAdapterResult {
  outputMetadata: Record<string, unknown>;
  providerReference?: string;
}

/**
 * The Provider Adapter step of the chain (specs/api/poc-api-contracts.md
 * §56). No concrete adapter exists yet — DEVOS-054 supplies the real Git
 * adapter, DEVOS-058 the PR-creation one — so the gateway takes adapters as
 * an injected, per-capability-key map (`ToolGatewayDeps.adapters`) rather
 * than importing `@devos/integrations` directly, keeping the gateway
 * algorithm itself provider-agnostic per the package-boundary split
 * recorded in `DEVOS-SPRINT4-DECISIONS.md`.
 */
export interface ProviderAdapter {
  invoke: (
    target: Record<string, unknown>,
    parameters: Record<string, unknown>,
  ) => Promise<ProviderAdapterResult>;
}

export interface InvokeToolInput {
  capabilityKey: string;
  target: Record<string, unknown>;
  parameters: Record<string, unknown>;
  idempotencyKey: string;
  /**
   * DEVOS-085: the agent version whose proposed action this invocation is
   * carrying out, if any. When present, the gateway checks the capability
   * key against that version's `configuration.allowedCapabilities` before
   * reaching the provider adapter — closing the gap where
   * `allowedCapabilities` was validated and stored on create but never
   * enforced anywhere at runtime. Omitted for system-originated invocations
   * that are not carrying out any agent's proposal (e.g. build/test/deploy
   * task handlers, which never call `runAgentTask` at all).
   */
  agentVersionId?: AgentVersionId;
  /**
   * DEVOS-138: the workflow version whose run is carrying out this
   * invocation, if any — mirrors `agentVersionId` exactly. When present
   * (every real production call site already holds its own `WorkflowRun`
   * in scope and supplies `run.workflowVersionId`), the gateway resolves
   * the real `WorkflowVersion` and includes its `workflowDefinitionId`/
   * `version` in the policy-evaluation request, so a policy can be scoped
   * to a specific workflow definition/version. Omitted for any caller with
   * no workflow run in scope (there are none today, but the field stays
   * optional for the same reason `agentVersionId` is).
   */
  workflowVersionId?: WorkflowVersionId;
  /**
   * DEVOS-088: the correlation id of the API request that ultimately
   * caused this invocation, if one is known (threaded from the workflow
   * run/task that carried it — see `run-creation.ts`). Recorded on the
   * resulting audit record's own `correlationId` field and in
   * `inputMetadata`, so a single id joins the API request, the workflow
   * run, and this tool invocation.
   */
  correlationId?: string;
}
