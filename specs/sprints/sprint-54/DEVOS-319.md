# DEVOS-319 — Ranked fallback-chain resolution

**Priority:** P1
**Depends on:** Sprint 53 (DEVOS-316's real per-task resolution seam), Sprint 52 (DEVOS-311's `organisation_llm_providers` table).
**Depended on by:** DEVOS-322 (live-verifies the fallback ordering).

## Scope

For a given organisation, providers are tried in `priority` order; an unconfigured, disabled, or failing entry falls through to the next; if none succeed (or none are configured at all), falls back to the platform-wide default — the resolved cascading-fallback decision (backlog §9.3).

## Implementation

`packages/agents/src/providers/resolving-model-adapter.ts`:

- New, narrow, package-local types: `RankedLlmProviderCandidate { provider: string; credentialReference: string }`.
- `ResolvingModelAdapterOptions` gains two optional fields: `listProvidersForOrganisation?: (organisationId: OrganisationId) => Promise<RankedLlmProviderCandidate[]>` and `resolveCredential?: (credentialReference: string) => Promise<string | null>`. Both optional and additive — omitted, `invoke()` behaves exactly as Sprint 53 left it (byte-for-byte), the same "optional and additive" precedent this epic has followed since DEVOS-098.
- `invoke(request)`: if `listProvidersForOrganisation` is supplied, fetches the organisation's candidates (already `ACTIVE`-filtered and priority-ordered by the caller, per README's package-boundary design note) and, for each in order: resolves its credential via `resolveCredential` (skip on `null` — unconfigured); skips silently if `provider` isn't a registered `LlmProviderKey` (an org could reference a provider key this deployment's registry doesn't know); otherwise constructs a real adapter via `createModelAdapterForProvider` and calls `invoke()`, returning its result immediately on success, or catching and moving to the next candidate on throw (failing). Exhausting the candidate list (or `listProvidersForOrganisation` being absent, or the list being empty) falls through to the existing `defaultProvider`/`defaultCredential` construction, unchanged.

`apps/worker/src/main.ts`: the `createResolvingModelAdapter(...)` construction (inside `resolveAgentModelAdapter()`'s non-fixture branch) gains:

- `listProvidersForOrganisation: async (organisationId) => (await organisationLlmProviders.listForOrganisation(organisationId)).filter((row) => row.status === 'ACTIVE').map((row) => ({ provider: row.provider, credentialReference: row.credentialReference }))`, where `organisationLlmProviders = createOrganisationLlmProviderRepository(database.db)` (new construction alongside this file's own many other repository constructions).
- `resolveCredential: credentialResolver.resolve` — the same real `credentialResolver` instance already constructed at module scope for Git/Deployment integration credentials (DEVOS-104/106).

## Out of scope

Access-role gating on who configures the list (DEVOS-320). Any UI (DEVOS-321). Cost-attribution reflecting the actually-used provider (Sprint 55, DEVOS-323).

## Acceptance

`pnpm --filter @devos/agents build`/`typecheck`/`lint`/`test` clean. Real unit tests in `resolving-model-adapter.test.ts` confirm: an empty/absent candidate list falls through to the default provider unchanged; a single `ACTIVE`, correctly-credentialed top-priority candidate is used instead of the default; a candidate whose credential resolves to `null` is skipped and the next candidate (or the default) is used; a candidate whose `invoke()` throws is skipped and the next candidate (or the default) is used; candidates are tried in ascending `priority` order, not list order.

## Actual results

Implemented as planned. `pnpm --filter @devos/agents build`/`typecheck`/`lint`/`test` all clean. See `DEVOS-322.md` for full monorepo validation and the real end-to-end proof.
