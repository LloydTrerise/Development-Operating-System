import type { AgentConfiguration, AgentUncertainty, OrganisationId } from '@devos/contracts';

/**
 * The provider-agnostic seam between the agent runtime (DEVOS-026,
 * @devos/application's runAgentTask) and an actual LLM call. DEVOS-027
 * implements this with a real Gemini-backed adapter; nothing about the
 * runtime, task queue, or worker dispatcher needs to change when that
 * happens — same pattern as ArtifactStorage (@devos/storage) and the
 * DEVOS-016 → DEVOS-017 storage swap.
 *
 * Shape grounded in specs/api/poc-api-contracts.md §22 "Agent Execution
 * Contract" (objective, input, allowed capabilities) and §23 "Agent Result
 * Contract" (status, result, uncertainty) — not a Gemini-specific request
 * shape.
 */
export interface AgentInvocationRequest {
  configuration: AgentConfiguration;
  /**
   * DEVOS-316 (Sprint 53): the organisation this invocation is scoped to —
   * always resolvable via the calling project's own `organisationId`
   * (`run-agent-task.ts`'s sole production caller resolves it the same way
   * `maybeAlertOnBudgetExceeded` already does). Not yet consulted by any
   * concrete provider adapter (Gemini/Anthropic don't send it anywhere) or
   * by this sprint's own `createResolvingModelAdapter` — it is real,
   * per-call, and available for Sprint 54's own ranked-fallback-chain
   * resolution (reading `organisation_llm_providers`) to consult, disclosed
   * exactly as not yet wired to anything, per `specs/sprints/sprint-53/
   * README.md`.
   */
  organisationId: OrganisationId;
  promptReference?: string;
  /**
   * The resolved text of `promptReference` (DEVOS-028) — `promptReference`
   * itself stays on the request too, purely for traceability/audit (which
   * reference produced this text), since a provider adapter shouldn't need
   * to know how to resolve one.
   */
  systemInstructions?: string;
  objective: string;
  input: Record<string, unknown>;
}

/**
 * DEVOS-089: token counts as the real provider reports them — Gemini's
 * `generateContent` response includes a `usageMetadata` object with exactly
 * these three fields on every real call.
 */
export interface AgentInvocationUsage {
  promptTokens: number;
  candidatesTokens: number;
  totalTokens: number;
}

export interface AgentInvocationResult {
  status: 'SUCCEEDED' | 'FAILED';
  result?: Record<string, unknown>;
  uncertainty?: AgentUncertainty[];
  errorMessage?: string;
  modelReference?: string;
  usage?: AgentInvocationUsage;
}

export interface AgentModelAdapter {
  invoke: (request: AgentInvocationRequest) => Promise<AgentInvocationResult>;
}
