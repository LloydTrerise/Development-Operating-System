# DEVOS-106 — Wire `CredentialResolver` to a real secret-management backend

**Priority:** P0 | **Estimate:** 2d
**Depends on:** Should land before or alongside `DEVOS-104`/`DEVOS-105` — both need a real credential to authenticate with their real provider.

## Scope

Build a real `CredentialResolver` (`packages/integrations/src/credential-resolver.ts`) implementation backed by an actual secret-management backend (a cloud provider's own secret manager, or Vault) — `createXSecretManagerCredentialResolver`, alongside the existing `createEnvCredentialResolver`. Wire it into `apps/api`/`apps/worker`'s composition so `DEVOS-104`'s GitHub adapter and `DEVOS-105`'s deployment adapter resolve their live credentials through it.

## Grounding

`specs/architecture/repository-code-structure.md` §47 ("Provider adapters receive credentials through injected interfaces") and `DEVOS-PRODUCTION-READINESS-ROADMAP.md` A3. `CredentialResolver`'s own doc comment already flags that no secret-management mechanism is named anywhere in the spec corpus — this task makes the real choice.

## Flagged gap

`Integration.credentialReference` is currently just "the name of an environment variable" per its own doc comment — resolving it against a real secret manager means the _meaning_ of that string changes (a secret path/key in the real backend, not an env var name). Confirm this doesn't silently break `createEnvCredentialResolver`'s continued use in tests/local dev — both resolvers should keep satisfying the same `resolve(credentialReference): Promise<string | null>` contract, with the interpretation of the reference string documented per implementation.

## Acceptance

A real secret is created in the real secret-management backend; `DEVOS-104`'s and `DEVOS-105`'s real provider calls authenticate using a credential resolved from it, not an inline environment variable; redaction is confirmed (the resolved secret value never appears in a log line or error message, per `AGENTS.md` §22).
