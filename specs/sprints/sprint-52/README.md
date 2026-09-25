# Sprint 52 — Organisation LLM Provider Foundation

**Source:** `specs/DEVOS-LLM-CREDENTIAL-MANAGEMENT-BACKLOG.md` §5.1 (candidate epic E30, Organisation LLM Provider & Credential Gateway).
**Conversion date:** 2026-09-25
**Status:** Converted and executed per explicit user authorization ("Proceed with sprint. Run through sprint fully without waiting for authorisation after each task. Stop once sprint is done", 2026-09-25), in direct response to a position report confirming E29 closed (Sprint 51 + its scope extension) and E30 fully scoped but not yet authorized, per `AGENTS.md` §35/§4.2.

## Goal

Give every organisation a real, dormant place to configure a ranked list of LLM providers/credentials, with **zero change to any existing route, use case, or task-execution behavior** — the worker's single boot-time `GEMINI_API_KEY`-backed adapter (`apps/worker/src/main.ts:101-107`) stays exactly as it is today. This sprint only adds the data model and confirms the existing `CredentialResolver` contract needs no widening to serve it. Real per-task resolution is Sprint 53's job.

## Grounding (confirmed by direct code inspection at implementation time)

- `packages/integrations/src/credential-resolver.ts`'s `CredentialResolver.resolve(reference): Promise<string | null>` contract is already reference-string-agnostic — it doesn't know or care what kind of entity owns the reference it's given. No interface change was needed to serve a second kind of reference; the "widening" DEVOS-312 refers to is scope (a new call-site/kind of thing referencing it), not a code change to the resolver itself.
- The only two production call sites that construct a `CredentialResolver` (`apps/worker/src/main.ts:101-107`) already choose between `createEnvCredentialResolver()`/`createVaultCredentialResolver()` once at boot and pass the single instance down — confirmed no additional wiring exists or is needed for this sprint's dormant table.
- `packages/domain/src/integrations/integration.ts`'s `Integration` is the closest structural precedent (`credentialReference: string`, `provider: string`, `status` as a two-state `ACTIVE`/`DISABLED` enum via `packages/contracts/src/status.ts`'s `integrationStatuses`/`ToolCapabilityStatus` pattern) — `OrganisationLlmProvider` reuses the identical shape and status enum values, scoped to `organisation_id` instead of `project_id`.
- `packages/database/src/repositories/job-roles.ts`'s `JobRoleRepository` (list/get/create only, no update/delete yet) is the closest precedent for a "foundation sprint" repository that intentionally defers write/reorder operations to the sprint that actually needs them (here, Sprint 54's UI) — `OrganisationLlmProviderRepository` follows the same minimal shape.
- No test in `packages/database` unit-tests a repository directly against real Postgres (confirmed: `packages/database/tests/` contains only `client.test.ts`, which deliberately never connects) — every prior sprint's repository correctness is proven either through application-layer in-memory fakes (not applicable here — no application layer touches this table yet) or through live verification against a real running Postgres during the sprint itself. This sprint's evidence is the latter, recorded in `DEVOS-313.md`.

## Design choice disclosed: namespace is a documented convention, not enforced code

DEVOS-312's acceptance text asks for `credential_reference` to be "kept in a namespace distinct from `Integration.credentialReference`." Since `CredentialResolver.resolve()` treats every reference as an opaque string, this is a naming *convention* (e.g., a distinct env-var prefix locally, a distinct Vault path prefix in the real backend), documented on `OrganisationLlmProvider.credentialReference` itself, not a schema or interface constraint — there is no natural place in this codebase's existing architecture to enforce two reference strings never collide across two unrelated tables, and the backlog itself (§9.7) confirms the resolver's own contract is "reused unchanged."

## In scope

- **DEVOS-311** — `organisation_llm_providers` table, migration `0059`; `OrganisationLlmProviderId` (contracts), `OrganisationLlmProviderStatus` (contracts); `OrganisationLlmProvider`/`OrganisationLlmProviderRepository` (domain); `createOrganisationLlmProviderRepository` (database). Zero change to any existing route, use case, or the worker's boot-time adapter construction.
- **DEVOS-312** — Confirmed, not re-implemented, that `CredentialResolver`'s existing contract needs no code change; the organisation-scoped LLM-credential namespace is documented as a convention on the new domain type; live-verified in `DEVOS-313.md` that a real organisation-scoped reference resolves correctly through the existing `createEnvCredentialResolver()`.
- **DEVOS-313** — Validation, documentation, and gap disclosure, including live verification against real Postgres.

## Out of scope

Everything Sprint 53 (provider registry/factory, per-task resolution, `AgentInvocationRequest` widening, pricing), Sprint 54 (fallback-chain resolution, access-role gating, settings UI), and Sprint 55 (end-to-end pilot, closing disclosure) own — per the epic map in `specs/DEVOS-LLM-CREDENTIAL-MANAGEMENT-BACKLOG.md` §4, this sprint's own table has no route, no UI, and no reader anywhere in production code yet. No reorder/update/delete repository methods (deferred to Sprint 54, the first sprint that actually needs them). No change to `packages/agents`, `apps/worker`, or `packages/agents/src/pricing.ts`.

## Task index

| ID        | Story                                                              | File           |
| --------- | ------------------------------------------------------------------- | -------------- |
| DEVOS-311 | `organisation_llm_providers` table, migration                       | `DEVOS-311.md` |
| DEVOS-312 | `CredentialResolver` confirmed reusable for an org-scoped namespace | `DEVOS-312.md` |
| DEVOS-313 | Validation, documentation, and gap disclosure                      | `DEVOS-313.md` |
