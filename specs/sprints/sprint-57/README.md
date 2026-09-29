# Sprint 57 — Registration Token & Invite-Gated Organisation Creation

**Source:** `specs/DEVOS-ORGANISATION-ONBOARDING-BACKLOG.md` §6.2 (candidate epic E31, Organisation Onboarding, Registration Gating & Mandatory Initialisation).
**Conversion date:** 2026-09-29
**Status:** Converted per explicit user instruction. Per `AGENTS.md` §4.1's one-step-at-a-time discipline, only this sprint is converted — Sprints 58–60 remain unconverted until the user explicitly authorizes continuing past Sprint 57. **Conversion alone does not authorize implementation** — a separate, explicit "start sprint 57" (or equivalent) instruction is required per `AGENTS.md` §35/§4.2 before any task below is implemented.

## ⚠ Disclosed behavior change — read before implementing DEVOS-330

This sprint contains this repository's first-ever **reversal of a previously reconfirmed ungating decision**. `specs/sprints/sprint-51/DEVOS-310.md:46` recorded, as recently as 2026-09-27: _"`project.create`/`organisation.create` are ungated by design — 'any authenticated principal may create one and becomes its owner' is this codebase's own longstanding, symmetric convention for both entity types."_ DEVOS-330 below deliberately reverses that for `organisation.create` only (`project.create` is untouched). Per the backlog's own §3 delivery principle, this must be disclosed again, explicitly, at the exact moment DEVOS-330's implementation begins — not folded silently into a larger change, even if the user already authorized this sprint as a whole beforehand.

## Goal

Gate `createOrganisation` behind redemption of a valid, platform-operator-issued registration token, and give platform operators (Sprint 56) a real API/UI to issue, list, and revoke those tokens.

## Grounding (confirmed against the real, current implementation)

- `packages/application/src/organisations/create-organisation.ts:14-59` — the current, completely ungated use case. Any authenticated principal may call it; it creates the `Organisation` row, then an org-level `ORGANISATION_ADMIN` `Membership` (`projectId: null`), then sets `organisations.owner_principal_id` — in that order, because of a real FK-ordering constraint found during DEVOS-290's own live verification. This mechanism (the membership/ownership side effect) is reused completely unchanged by this sprint; only its precondition changes (DEVOS-330).
- `packages/domain/src/errors.ts` — the real, established application-layer error classes: `NotFoundError`, `ForbiddenError`, `ValidationError`, all extending `ApplicationError`. There is no existing `AuthorizationError` at the application layer (a same-named class exists only at the HTTP layer, `apps/api/src/http/errors.ts`, for a distinct purpose). Per Sprint 56's own disclosed precedent (`specs/sprints/sprint-56/DEVOS-328.md`'s gap disclosure) and `AGENTS.md` §7, new platform-operator-gated checks in this sprint should reuse the real `ForbiddenError`, not invent a new error class the backlog's own story text may have assumed.
- `packages/domain/src/organisations/organisation-llm-provider.ts` — the most recent precedent for "store a reference/hash, never the raw secret" (`credentialReference`, resolved via `CredentialResolver`, "never the secret itself, per `AGENTS.md` §22"). Registration tokens follow the same discipline in spirit (§9 of the backlog: "opaque random token, stored only as a hash") even though the concrete mechanism (a salted hash of a bearer token, not a `CredentialResolver` reference) is new — there is no existing raw-secret-hashing code path anywhere in this codebase to reuse directly; this is new, disclosed scope for DEVOS-329.
- `packages/database/migrations/0060_platform_operators.ts` is the most recent migration — a new `registration_tokens` migration in this sprint is `0061_registration_tokens.ts`.
- `specs/sprints/sprint-56/` (this epic's own immediately prior sprint) is the structural precedent this sprint follows: a new dormant-then-wired table, a platform-operator-gated management API + minimal UI, and a closing validation/disclosure task.

## In scope

- **DEVOS-329** — `registration_tokens` table, migration. Issuable only via DEVOS-331's platform-operator-gated route.
- **DEVOS-330** — `createOrganisation` gated behind a valid, unredeemed registration token. **The disclosed reversal — see the warning above.**
- **DEVOS-331** — Platform-operator UI/API: issue, list, revoke registration tokens.
- **DEVOS-332** — Validation, documentation, and gap disclosure.

## Out of scope

Everything Sprint 58 (mandatory initialisation requirements), Sprint 59 (server-side enforcement), and Sprint 60 (guided UI, full-epic pilot) own — per the epic map in `specs/DEVOS-ORGANISATION-ONBOARDING-BACKLOG.md` §5. No change to `project.create`'s existing ungated behavior (backlog §2.7/§4). No token-based invitation mechanism for _joining_ an existing organisation — that is the separate, already-existing `addMember`/`addOrganisationMember` path (Sprint 39, E29), untouched here. No change to `AuthProvider`, OIDC delegation, or any other identity/authentication mechanism (backlog §2.1, Decision 1a).

## Task index

| ID        | Story                                                                    | File           |
| --------- | ------------------------------------------------------------------------ | -------------- |
| DEVOS-329 | `registration_tokens` table, migration                                   | `DEVOS-329.md` |
| DEVOS-330 | `createOrganisation` gated behind a valid, unredeemed registration token | `DEVOS-330.md` |
| DEVOS-331 | Platform-operator UI/API: issue, list, revoke registration tokens        | `DEVOS-331.md` |
| DEVOS-332 | Validation, documentation, and gap disclosure                            | `DEVOS-332.md` |
