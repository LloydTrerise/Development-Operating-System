import type {
  OrganisationId,
  OrganisationLlmProviderId,
  OrganisationLlmProviderStatus,
} from '@devos/contracts';

/**
 * DEVOS-311 (Sprint 52, `specs/DEVOS-LLM-CREDENTIAL-MANAGEMENT-BACKLOG.md`
 * §5.1, candidate epic E30): one entry in an organisation's own ranked list
 * of LLM provider credentials. Dormant in this sprint — no route or use case
 * reads or writes this table yet (Sprint 53 wires per-task resolution;
 * Sprint 54 adds the write-gated settings UI). An organisation with zero
 * rows here keeps today's single-boot-time-`GEMINI_API_KEY` platform-default
 * behavior unchanged, per this sprint's own explicit "zero visible behavior
 * change" scope.
 *
 * Shape mirrors `Integration` (`packages/domain/src/integrations/
 * integration.ts`) closely on purpose — same `provider`/`credentialReference`/
 * `status` triad — but is deliberately its own table, not a widened
 * `Integration`, since `integrations` rows are project-scoped tool
 * connections (source control, CI/CD) and this is an organisation-scoped LLM
 * credential, a different kind of thing per the backlog's own §2.4 grounding.
 */
export interface OrganisationLlmProvider {
  id: OrganisationLlmProviderId;
  organisationId: OrganisationId;
  /** A provider discriminator, e.g. `gemini`/`anthropic`/`openai` — a plain
   * string, not a fixed enum, since Sprint 53 registers providers into an
   * open-ended registry rather than a hardcoded list. */
  provider: string;
  /** Resolved via `@devos/integrations`'s `CredentialResolver`, never the
   * secret itself, per `AGENTS.md` §22. By convention, kept in a namespace
   * distinct from `Integration.credentialReference` (e.g. a distinct env-var
   * prefix locally, a distinct Vault path prefix in the real backend) since
   * these reference a different kind of secret (LLM provider access, not an
   * external tool integration) — `CredentialResolver.resolve()` itself is
   * reference-string-agnostic and needs no code change to serve this. */
  credentialReference: string;
  /** Rank within the organisation's fallback chain (Sprint 54) — lower tries
   * first. Unique per organisation. */
  priority: number;
  status: OrganisationLlmProviderStatus;
  createdAt: string;
  updatedAt: string;
}

export interface OrganisationLlmProviderRepository {
  getById: (id: OrganisationLlmProviderId) => Promise<OrganisationLlmProvider | null>;
  /** Ordered by `priority` ascending — the real fallback-chain order Sprint
   * 54's resolution logic will walk. */
  listForOrganisation: (organisationId: OrganisationId) => Promise<OrganisationLlmProvider[]>;
  create: (provider: OrganisationLlmProvider) => Promise<void>;
}
