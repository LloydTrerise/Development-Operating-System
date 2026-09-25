# DEVOS-312 — `CredentialResolver` confirmed reusable for an org-scoped namespace

**Priority:** P1
**Depends on:** DEVOS-311 (the table `credential_reference` values belong to).
**Depended on by:** Sprint 53 (the first sprint that actually calls `resolve()` on one of these rows during a real task).

## Scope

Confirm `@devos/integrations`'s existing `CredentialResolver.resolve(reference): Promise<string | null>` contract needs no widening to serve `OrganisationLlmProvider.credentialReference` — reused unchanged, per the backlog's own §9.7 resolution — and document the "distinct namespace" requirement as a convention, since the interface itself is reference-string-agnostic and has no concept of namespaces to enforce.

## Implementation

No code change to `packages/integrations/src/credential-resolver.ts` — direct inspection confirmed both `createEnvCredentialResolver()` and `createVaultCredentialResolver()` already treat `credentialReference` as an opaque string; neither cares what table or entity it came from. The only two production call sites that construct a `CredentialResolver` (`apps/worker/src/main.ts:101-107`) already select one instance once at boot and pass it down — this sprint adds no second call site, since no code path calls `.resolve()` on an `OrganisationLlmProvider` row yet (that begins in Sprint 53).

The "distinct namespace" requirement is documented directly on `OrganisationLlmProvider.credentialReference` (`packages/domain/src/organisations/organisation-llm-provider.ts`): by convention, a distinct env-var prefix locally (e.g. `LLM_PROVIDER_*`, as opposed to whatever name an `Integration` row's own `credentialReference` happens to use) and a distinct Vault path prefix in the real backend — not a schema constraint, since there is no shared table or code path across `integrations` and `organisation_llm_providers` that could enforce two arbitrary reference strings never collide, and the resolver contract itself has no notion of a "kind" of reference.

## Out of scope

Any actual call site resolving one of these rows during task execution (Sprint 53). Any change to `CredentialResolver`'s interface or either concrete resolver implementation — confirmed unnecessary, not merely deferred.

## Acceptance

A real environment-variable-backed reference in the documented namespace convention resolves correctly through the existing, unmodified `createEnvCredentialResolver()` — proving the "contract reused unchanged" claim with real evidence, not just an assertion.

## Actual results

Confirmed via a real, disposable verification script (deleted after use, see `DEVOS-313.md`): a real `OrganisationLlmProvider` row's `credentialReference` (`LLM_PROVIDER_DEVOS_DEV_GEMINI`), set as a real environment variable, resolved correctly through `createEnvCredentialResolver()` with zero code change to the resolver — the exact same contract `Integration.credentialReference` already uses today. No further implementation was needed; this task's real work was confirmation and documentation, not new code.
