# DEVOS-107 — Real OIDC-based `AuthProvider`

**Priority:** P0 | **Estimate:** 3d
**Depends on:** None (Sprint 8 complete). Independent of `DEVOS-104`–`106`.

## Scope

Build a real `AuthProvider` (`packages/identity/src/authentication/provider.ts`) implementation that validates a real OIDC-issued token against a real identity provider — `createOidcAuthProvider`, alongside the existing `createLocalAuthProvider`. Wire `apps/api` to use it by default outside test/local-dev configuration; keep `createLocalAuthProvider` available for the existing test suites, which depend on treating a bearer token as a literal principal id.

## Grounding

`DEVOS-PRODUCTION-READINESS-ROADMAP.md` C1. `Analysis/DevOS_POC_Architecture_and_Implementation_Plan_v1.0.docx` §18 ("OIDC-compatible human authentication") — the POC's own architecture always named this as the target, deliberately deferred to a local stub for the reference workflow's own sake (source §37, "Support every engineering stack" is an explicit non-goal, but a real _one_ provider was always in scope, mirroring the same "one provider initially" pattern already applied to Git/issue-tracker/CI).

## Flagged gap

`Principal` (`packages/identity/src/principals/principal.ts`) — confirm its current shape (an id, presumably) is sufficient for a real OIDC identity (which typically carries an email/subject/issuer, not just an opaque id) before assuming no changes are needed there. If it needs new fields, they must remain optional/backward-compatible with `createLocalAuthProvider`'s existing minimal `Principal` construction.

## Acceptance

A real user authenticates through a real OIDC identity provider (a real browser login redirect, a real token issued back to DevOS); `apps/api` validates that real token and resolves a real `Principal` from it; the resulting principal id is what's attributed to the workflow run and audit records the authenticated user triggers. `createLocalAuthProvider` and every existing test that depends on it are unchanged.
