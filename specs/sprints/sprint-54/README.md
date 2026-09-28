# Sprint 54 — Ranked Fallback & Access Control UI

**Source:** `specs/DEVOS-LLM-CREDENTIAL-MANAGEMENT-BACKLOG.md` §5.3 (candidate epic E30, Organisation LLM Provider & Credential Gateway).
**Conversion date:** 2026-09-25
**Status:** Converted and executed per explicit user authorization ("mark sprint 53 complete and then Proceed with sprint. Run through sprint fully without waiting for authorisation after each task. Stop once sprint is done", 2026-09-25), given in the same instruction that approved marking Sprint 53 complete, in direct response to a position report confirming Sprint 53 complete and Sprint 54 as the recorded next item.

## Goal

Make `request.organisationId` — real and threaded through every model-invocation call since Sprint 53, but genuinely unconsulted — actually differentiate which LLM provider gets used: a real, deterministic, priority-ordered fallback chain over Sprint 52's own dormant `organisation_llm_providers` table, falling through to today's platform-wide default when an organisation has no configured providers, none succeed, or an individual entry is disabled/unconfigured/failing. Gate who can manage that list to organisation admins. Give it a real settings UI.

## Grounding (confirmed by direct code inspection at conversion time)

- `packages/agents/src/providers/resolving-model-adapter.ts`'s `createResolvingModelAdapter` (Sprint 53) always resolves to `options.defaultProvider`/`options.defaultCredential` — `request.organisationId` is accepted on the interface but never read. This sprint's own real, disclosed job is to make it read.
- `OrganisationLlmProviderRepository` (`packages/domain/src/organisations/organisation-llm-provider.ts`, Sprint 52) is deliberately minimal: `getById`/`listForOrganisation` (ordered by `priority` ascending)/`create` only — no `update`/`delete`, exactly as DEVOS-313's own gap disclosure named, deferred to "the first sprint whose UI actually needs to mutate a row." That sprint is this one.
- `organisation_llm_providers`'s own composite unique constraint on `(organisation_id, priority)` (migration `0059`) is a plain, non-deferred Postgres constraint — a naive single-row priority swap between two rows can collide mid-transaction. `packages/database/src/repositories/close-work-item.ts`/`decide-approval-and-transition.ts` establish this codebase's own precedent for a dedicated, transactional, multi-statement primitive (via `withTransaction`) living alongside — not inside — a plain-CRUD repository, for exactly this class of operation.
- `apps/worker/src/main.ts` already constructs a real `credentialResolver: CredentialResolver` at module scope (lines 104–110), already threaded into `DevelopmentAgentTaskHandlerDeps`/`ToolTaskHandlerDeps` for Git/Deployment integration credentials — the same real instance this sprint's fallback-chain resolution reuses for LLM provider credentials, needing no new resolver construction.
- `resolveOrganisationAdminMembership` + `canUpdateOrganisation` (`organisation.update` permission, migrations `0047`/`0048`) — the exact org-admin-only write gate `updateOrganisation.ts` already uses for organisation-settings changes — fits this sprint's own "manage the org's LLM provider list" action directly (a settings change, not a membership/access grant like `canManageMembers`'s own job-role/member precedent). No new permission or migration is needed; reused as-is, per the backlog's own explicit "if it fits directly" instruction (§5.3, DEVOS-320).
- `OrganisationsPage.tsx`'s `MembersPanel`/`OrganisationRow` (inline per-row `Collapse` toggle, list/add/remove, loading/error state, admin-only affordances) is the real UI convention the backlog names for DEVOS-321 to mirror.
- `Integration.credentialReference` (the closest sibling field) is a reference _name_, never the secret itself, and is already shown as plain text in `IntegrationsPage.tsx`'s own create form — confirming "masked" in the backlog's own DEVOS-321 acceptance text means "never displays a resolved secret" (already true, nothing to build), not a literal `****` obfuscation of the reference name, which would be inconsistent with this codebase's own established `Integration` precedent. Disclosed correction, mirroring Sprint 29's own DEVOS-203 status-tint correction.
- `packages/application` already depends on `@devos/agents` (`AgentTaskHandlerDeps.modelAdapter`) — `isLlmProviderKey`/`LLM_PROVIDER_KEYS` can be reused directly to validate a provider's `provider` field at creation time, rejecting an unregistered provider key with a clear `ValidationError` rather than silently creating a dead row no factory could ever construct.

## Design choice disclosed: what "failing" means in the fallback chain

The backlog's own §5.3 acceptance text for DEVOS-319 says an entry may be "unconfigured/disabled/failing." This sprint defines each precisely: **unconfigured** — `credentialReference` resolves to `null` via `CredentialResolver.resolve()`; **disabled** — `status !== 'ACTIVE'`, filtered out before the candidate list is even built; **failing** — the constructed provider adapter's own `invoke()` call throws (network failure, non-2xx HTTP response, a malformed response body — anything `createGeminiModelAdapter`/`createAnthropicModelAdapter` themselves already treat as an error). All three fall through to the next candidate in `priority` order; exhausting the list (including the case of zero rows at all) falls through to the platform-wide default exactly as Sprint 53 already behaves — byte-for-byte unchanged for any organisation with no configured providers, the same "zero visible behavior change for the common case" discipline Sprint 52/53 both already established.

## Design choice disclosed: `@devos/agents` package boundary preserved

Rather than giving `@devos/agents` a new dependency on `@devos/database`/`@devos/integrations` to read `organisation_llm_providers` or call `CredentialResolver` directly, `createResolvingModelAdapter`'s own options gain two narrow, optional, plain-function dependencies (`listProvidersForOrganisation?`/`resolveCredential?`) using a small local candidate shape (`provider`/`credentialReference` only) — not an import of `@devos/domain`'s own `OrganisationLlmProvider` type. `apps/worker/src/main.ts` supplies the real implementations (the real repository's `listForOrganisation`, filtered to `ACTIVE` and mapped to the narrow shape; the real `credentialResolver.resolve`), keeping `@devos/agents` exactly as decoupled as it was before this sprint. Mirrors `packages/application/src/tasks/deps.ts`'s own established "declared separately here per this package's existing boundary" precedent (`RecordContextManifest`, `PublishArtifact`).

## Design choice disclosed: priority changes go through `reorder` only, never a single-row `update`

`update` on `OrganisationLlmProviderRepository` is scoped to `credentialReference`/`status` only — changing a single row's `priority` directly through it re-introduces the exact unique-constraint collision class this sprint's own grounding (above) flags. A full, atomic, transactional `reorderOrganisationLlmProviders(organisationId, orderedIds)` primitive (two-phase: negative-offset pass, then final-value pass, both inside one `withTransaction`) is the only way a provider's rank changes — the UI's up/down affordances call it with the full desired order, not a single-row edit.

## In scope

- **DEVOS-319** — Ranked fallback-chain resolution in `createResolvingModelAdapter`.
- **DEVOS-320** — Access-role gating for managing an organisation's provider list (reusing `resolveOrganisationAdminMembership`/`canUpdateOrganisation`, disclosed above).
- **DEVOS-321** — Repository `update`/`delete`/reorder primitives, application use cases, API routes, and an "AI Providers" settings panel on `OrganisationsPage.tsx`.
- **DEVOS-322** — Validation, documentation, and gap disclosure, including live-verified fallback ordering and access gating against real Postgres.

## Out of scope

Everything Sprint 55 (full-epic pilot proving cost attribution reflects the provider actually used, closing disclosure) owns. Any dynamic/cost/quality/latency-based routing algorithm — the chain is manually admin-ranked only, per the backlog's own settled §9.5 decision. Any change to budget-alert behavior (§9.6, stays informational). A credential-testing/validation console (§3).

## Task index

| ID        | Story                                           | File           |
| --------- | ----------------------------------------------- | -------------- |
| DEVOS-319 | Ranked fallback-chain resolution                | `DEVOS-319.md` |
| DEVOS-320 | Access-role gating                              | `DEVOS-320.md` |
| DEVOS-321 | Organisation settings UI — "AI Providers" panel | `DEVOS-321.md` |
| DEVOS-322 | Validation, documentation, and gap disclosure   | `DEVOS-322.md` |
