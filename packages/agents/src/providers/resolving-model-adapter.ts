import type {
  AgentInvocationRequest,
  AgentInvocationResult,
  AgentModelAdapter,
} from '../model-adapter.js';
import {
  createModelAdapterForProvider,
  isLlmProviderKey,
  type LlmProviderKey,
  type ModelAdapterCredentialOptions,
} from './registry.js';

/**
 * DEVOS-319 (Sprint 54): the narrow shape this module needs from an
 * organisation's own ranked provider row — deliberately not
 * `@devos/domain`'s `OrganisationLlmProvider` (id/status/timestamps and
 * all), keeping `@devos/agents` exactly as decoupled from `@devos/domain`/
 * `@devos/database` as it was before this sprint. The caller (`apps/worker/
 * src/main.ts`) is responsible for `ACTIVE`-filtering and priority-ordering
 * before handing candidates here — this module tries them in the order
 * given, nothing more.
 */
export interface RankedLlmProviderCandidate {
  provider: string;
  credentialReference: string;
}

export interface ResolvingModelAdapterOptions {
  /**
   * The platform-wide default provider/credential — `apps/worker`'s own
   * resolved `GEMINI_API_KEY`/`ANTHROPIC_API_KEY` today, selected via the
   * new `LLM_DEFAULT_PROVIDER` config value (defaults to `'gemini'`,
   * preserving today's exact behavior).
   */
  defaultProvider: LlmProviderKey;
  defaultCredential: string;
  /** Per-provider base URL override — tests/pilots only; unset uses each provider's own real default. */
  baseUrlsByProvider?: Partial<Record<LlmProviderKey, string>>;
  /** Injectable for tests — defaults to the global fetch. */
  fetchImpl?: typeof fetch;
  /**
   * DEVOS-319 (Sprint 54): an organisation's own ranked provider list,
   * ordered priority-ascending, `ACTIVE`-only — optional and additive,
   * mirroring this codebase's own established `auditRecords?`/
   * `organisations?` precedent (DEVOS-098/155): omitted, `invoke()` behaves
   * exactly as Sprint 53 left it. `apps/worker/src/main.ts` supplies the
   * real implementation backed by `OrganisationLlmProviderRepository`.
   */
  listProvidersForOrganisation?: (
    organisationId: AgentInvocationRequest['organisationId'],
  ) => Promise<RankedLlmProviderCandidate[]>;
  /**
   * Resolves a `credentialReference` to a real secret value — `null` means
   * unconfigured (skip this candidate). `apps/worker/src/main.ts` supplies
   * the same real `CredentialResolver.resolve` instance already used for
   * Git/Deployment integration credentials (DEVOS-104/106).
   */
  resolveCredential?: (credentialReference: string) => Promise<string | null>;
}

function buildCredentialOptions(
  options: ResolvingModelAdapterOptions,
  provider: LlmProviderKey,
  apiKey: string,
): ModelAdapterCredentialOptions {
  const baseUrl = options.baseUrlsByProvider?.[provider];
  return {
    apiKey,
    ...(baseUrl !== undefined ? { baseUrl } : {}),
    ...(options.fetchImpl !== undefined ? { fetchImpl: options.fetchImpl } : {}),
  };
}

/**
 * DEVOS-316 (Sprint 53): replaces `apps/worker/src/main.ts`'s own boot-time
 * `const modelAdapter = await resolveAgentModelAdapter()` (the backlog's own
 * §2.1-named gap) — this `AgentModelAdapter`'s `invoke()` constructs a real
 * concrete provider adapter fresh on every call via the DEVOS-314 registry,
 * instead of one instance built once at boot and reused for the process's
 * lifetime.
 *
 * DEVOS-319 (Sprint 54): `request.organisationId` now genuinely
 * differentiates provider selection — if `listProvidersForOrganisation` is
 * supplied, its real ranked candidates are tried in order first. A
 * candidate is skipped (not thrown) when: its `provider` isn't a registered
 * `LlmProviderKey`; its `credentialReference` resolves to `null`
 * (unconfigured); or its own `invoke()` call throws (failing — network
 * error, non-ok response, malformed body). Exhausting the candidate list —
 * or having none at all, the unchanged Sprint 53 behavior for any
 * organisation with no configured providers — falls through to the
 * platform-wide `defaultProvider`/`defaultCredential`, unchanged.
 */
export function createResolvingModelAdapter(
  options: ResolvingModelAdapterOptions,
): AgentModelAdapter {
  return {
    async invoke(request: AgentInvocationRequest): Promise<AgentInvocationResult> {
      const candidates =
        (await options.listProvidersForOrganisation?.(request.organisationId)) ?? [];

      for (const candidate of candidates) {
        if (!isLlmProviderKey(candidate.provider)) continue;
        const credential =
          (await options.resolveCredential?.(candidate.credentialReference)) ?? null;
        if (credential === null) continue;

        try {
          const adapter = createModelAdapterForProvider(
            candidate.provider,
            buildCredentialOptions(options, candidate.provider, credential),
          );
          const result = await adapter.invoke(request);
          // Every concrete provider adapter (gemini.ts/anthropic.ts) catches
          // its own network/HTTP errors internally and returns a `FAILED`
          // result rather than throwing — so "failing" must be checked on
          // the result's own status, not just on a thrown exception, for
          // this candidate to genuinely fall through to the next one.
          if (result.status === 'SUCCEEDED') return result;
          continue;
        } catch {
          continue;
        }
      }

      const adapter = createModelAdapterForProvider(
        options.defaultProvider,
        buildCredentialOptions(options, options.defaultProvider, options.defaultCredential),
      );
      return adapter.invoke(request);
    },
  };
}
