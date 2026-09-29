# Sprint 56 — Platform Operator Foundation

**Source:** `specs/DEVOS-ORGANISATION-ONBOARDING-BACKLOG.md` §6.1 (candidate epic E31, Organisation Onboarding, Registration Gating & Mandatory Initialisation).
**Conversion date:** 2026-09-29
**Status:** Converted per explicit user instruction ("convert devos-organisation-onboarding-backlog to specs", 2026-09-29). Per `AGENTS.md` §4.1's one-step-at-a-time discipline, only this epic's first sprint is converted — Sprints 57–60 remain unconverted until the user explicitly authorizes continuing past Sprint 56. **Conversion alone does not authorize implementation** — a separate, explicit "start sprint 56" (or equivalent) instruction is required per `AGENTS.md` §35/§4.2 before any task below is implemented.

## Goal

Give DevOS a real, principal-attached platform-operator grant — a new authorization tier that sits above and outside every organisation, since none exists in the current domain model — with **zero change to any existing route, use case, or authorization outcome**. This sprint only adds the dormant grant table, its bootstrap mechanism, and its own narrowly-scoped management routes. Nothing in this sprint reads or enforces platform-operator status anywhere else; that begins in Sprint 57 (registration-token issuance) and continues through Sprint 59 (server-side enforcement).

## Grounding (confirmed against the real, current implementation)

- `packages/domain/src/projects/membership.ts:17-26` — `Membership.organisationId: OrganisationId` is non-nullable, even for an org-level (`projectId: null`) row. There is no existing table that can represent a grant spanning or sitting outside every organisation.
- `packages/domain/src/principals/principal.ts` (migration `0045_principals.ts`, DEVOS-284) — `Principal`/`HumanProfile` are real, established tables; `Principal.id` is a plain, non-UUID-branded string (the OIDC `sub` claim, or a bare dev-mode bearer token) — `platform_operators.principal_id` reuses this exact type/convention, not a new id scheme.
- `packages/config/src/config.ts:99-116` — the existing `optional(raw.ENV_VAR)` pattern (e.g. `GEMINI_API_KEY`) is the established, single-env-var-secret convention this sprint's bootstrap mechanism (DEVOS-326) follows, per the backlog's own §2.10/§9.
- A repository-wide search for `platform-admin`/`platform-operator`/`super-admin`/`system-admin` across `specs/` and `packages/`/`apps/` source returns zero matches before this sprint — confirmed genuinely new, not an extension of an existing concept.
- The most recent structurally similar "foundation sprint" precedent is Sprint 52 (`specs/sprints/sprint-52/`, DEVOS-311–313) — a new, dormant table with a minimal repository (no update/delete yet), zero wiring into any existing route, full validation with an explicit "confirmed zero behavior change" acceptance criterion. This sprint follows the same shape.

## In scope

- **DEVOS-325** — `platform_operators` table, migration; `PlatformOperator`/`PlatformOperatorRepository` (domain); `createPlatformOperatorRepository` (database). Zero change to any existing route or use case.
- **DEVOS-326** — Deploy-time bootstrap: a new optional config value; on the named principal's first authenticated request, if zero platform operators exist yet, they are granted platform-operator status automatically.
- **DEVOS-327** — Platform-operator management: grant/revoke API (+ minimal UI), gated to existing platform operators only; blocked from revoking the last remaining operator.
- **DEVOS-328** — Validation, documentation, and gap disclosure — explicit written confirmation that no existing route's behavior changed.

## Out of scope

Everything Sprint 57 (registration tokens, the gate on `createOrganisation`), Sprint 58 (mandatory initialisation requirements), Sprint 59 (server-side enforcement), and Sprint 60 (guided UI, full-epic pilot) own — per the epic map in `specs/DEVOS-ORGANISATION-ONBOARDING-BACKLOG.md` §5. No registration-token table or concept (Sprint 57). No reading or enforcement of platform-operator status anywhere outside this sprint's own management routes (DEVOS-327) — in particular, `createOrganisation` is completely unchanged by this sprint. No change to `AuthProvider`, OIDC delegation, or any other identity/authentication mechanism.

## Task index

| ID | Story | File |
| --- | --- | --- |
| DEVOS-325 | `platform_operators` table + domain/repository | `DEVOS-325.md` |
| DEVOS-326 | Deploy-time bootstrap platform operator | `DEVOS-326.md` |
| DEVOS-327 | Platform-operator management (grant/revoke) | `DEVOS-327.md` |
| DEVOS-328 | Validation, documentation, and gap disclosure | `DEVOS-328.md` |
