# Sprint 9 — Production Provider Integration

**Source:** `specs/DEVOS-POST-POC-BACKLOG-AND-SPRINT-PLAN.md` §7, itself a direct decomposition of `DEVOS-PRODUCTION-READINESS-ROADMAP.md` §A and §C (items A1, A2, A3, C1).
**Conversion date:** 2026-08-28
**Status:** Proposed — not yet approved to begin (`DEVOS-BUILD-STATE.md` still records Sprint 9 as undefined; this directory's existence defines it, per `specs/sprints/README.md`, but does not itself authorize starting it).

## Goal

Replace every simulated external system the reference workflow touches with a real one: a real GitHub pull request, a real external deployment target, a real secret-management backend, and real OIDC authentication. Every prior sprint (4 through 8) carried forward an explicit, user-authorized decision to stay local-only here — this sprint is what cashes that decision in.

## Grounding — current real state, confirmed by direct inspection

- `PullRequestProvider` (`packages/integrations/src/pull-requests/pull-request-provider.ts`) has exactly one implementation, `createLocalPullRequestProvider` — real and locally verifiable, never a real GitHub API call.
- `DeploymentProvider` (`packages/integrations/src/deployment/deployment-provider.ts`) has exactly one implementation, `createLocalStagingDeploymentProvider` — its `DeployRequest` shape (`repositoryPath`, `environment`, `revision`) is local-filesystem semantics, not a real cloud/container deploy's natural input shape. **This interface will likely need to change, not just gain a second implementation** — flagged here rather than discovered mid-task.
- `CredentialResolver` (`packages/integrations/src/credential-resolver.ts`) has exactly one implementation, `createEnvCredentialResolver` — resolves an `Integration.credentialReference` from a same-named environment variable. No production code path calls it with a reference that isn't already a plain env var.
- `AuthProvider` (`packages/identity/src/authentication/provider.ts`) has exactly one implementation, `createLocalAuthProvider` — treats the bearer token directly as the principal id.
- `Integration.configuration` (`packages/domain/src/integrations/integration.ts`) is an untyped `Record<string, unknown>` JSONB bag — a real GitHub integration's owner/repo target, and a real deployment target's cluster/registry config, both need a place to live; this is it, per the existing `credentialReference`-via-`Integration` precedent.

## In scope

A real `PullRequestProvider` backed by the GitHub REST/GraphQL API (or a GitHub App); a real `DeploymentProvider` for one actual external target platform; `CredentialResolver` wired to a real secret-management backend; a real OIDC-based `AuthProvider`; one real end-to-end run proving all four work together.

## Out of scope / deferred

Every item named in `specs/DEVOS-POST-POC-BACKLOG-AND-SPRINT-PLAN.md` §13 (E20–E27) — no new workflow type, no designer, no governance/cost/analytics/marketplace work. Supporting more than one Git provider, more than one deployment target platform, or more than one identity provider — this sprint proves the adapter pattern works for real, it does not build an adapter catalogue.

## Sprint-wide acceptance criteria

- A real PR exists on a real GitHub repository, opened by DevOS through the Tool Gateway.
- A real deployment reaches a real external target through the Tool Gateway.
- The credential each of the above used was resolved through `CredentialResolver` from a real secret-management backend, not an inline environment variable read.
- A real user signs in through a real OIDC identity provider and that identity is the one attributed to the resulting workflow run and audit records.
- `DEVOS-PRODUCTION-READINESS-ROADMAP.md` items A1, A2, A3, and C1 are updated from open to closed, each with a decision-log entry citing the real verification evidence.

## Quality gates

Every claim above is proven with a real external call in this sprint's own decision log (a real PR URL, a real deployment reference, a real OIDC login trace) — screenshots or logs of the real provider's own response, not just a passing unit test against a fake.

## Key risks

- **Credential handling** — a real secret-management backend is the first time this codebase touches a real live secret anywhere; redact aggressively in logs and error messages, per `AGENTS.md` §22.
- **Interface drift** — `DeploymentProvider`'s current shape may not survive contact with a real target platform unchanged (see Grounding above); if it must change, update every existing caller and test, don't leave the local implementation behind a stale contract.
- **Scope creep** — one real Git provider, one real deployment target, one real identity provider. Resist "while we're at it" additions from E20–E27.
- **Provider flakiness** — real external APIs fail in ways a local fake never does; the existing retry/idempotency-key patterns (`idempotencyKey` already threaded through `PullRequestProvider`) must actually be exercised against the real provider, not assumed to work.

## Exit criteria

Sprint 9 is complete when its sprint-wide acceptance criteria are all met, the full monorepo validation gate is green, and `DEVOS-PRODUCTION-READINESS-ROADMAP.md`'s P0 row is empty.
