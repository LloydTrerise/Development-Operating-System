# DevOS Organisation Onboarding, Registration Gating & Mandatory Initialisation — Backlog & Sprint Plan

**Document:** Candidate Epic (E31 — Organisation Onboarding, Registration Gating & Mandatory Initialisation) Backlog & Sprint Plan
**Version:** 2.0 — revised after the user resolved all open decisions from v1.0 (§11 records each resolution and why). v1.0 scoped a small, single-sprint UI wrapper around the existing, unchanged `createOrganisation` call; the resolved decisions replaced that with a materially larger scope — a new platform-operator tier, invite/registration-token-gated organisation creation (a deliberate reversal of a previously ungated, repeatedly-reconfirmed design decision), mandatory first-run setup requirements, and genuine server-side enforcement. v1.0's grounding (§2) is retained and extended, not discarded.
**Status:** Decisions resolved — scope agreed at the epic-map/story level. Still not authorized for implementation. Per `AGENTS.md` §35/§4.2, converting this into `specs/sprints/sprint-56/` (or any sprint below) and any implementation still requires the user's separate, explicit authorization to begin.
**Source:** A user-flagged product gap (2026-09-28): on a fresh deployment, an organisation must be registered and at least one Admin user set up before the application can be considered "initialised" for that organisation. No spec anywhere in `specs/` (product, architecture, or any prior backlog document) named a first-run/onboarding/initialisation or platform-operator capability as scoped work before this document.
**Predecessor:** None directly. Adjacent, settled work this document builds on and must not silently re-open: `specs/DEVOS-ACCESS-CONTROL-MODEL-BACKLOG.md` (E29, Sprints 46–51, closed 2026-09-27) built the real `PRINCIPAL`/`ORGANISATION_ADMIN`/transferable-`ownerPrincipalId` model this document reuses unchanged; `specs/DEVOS-LLM-CREDENTIAL-MANAGEMENT-BACKLOG.md` (E30, Sprints 52–55, closed 2026-09-28) is the most recently closed epic and confirms the repository's current position (`DEVOS-BUILD-STATE.md`'s 2026-09-28 (Sprint 55) state-change-log entry: "No further sprint or epic is currently authorized or scoped").
**Task-ID authority:** Continues the real, continuous numbering used by every prior sprint/backlog document (`DEVOS-001`–`DEVOS-324`), starting at `DEVOS-325`.

---

## 1. Purpose

Today, nothing gates who can create an organisation, nothing in the data model records whether an organisation has completed any first-run setup, and nothing above the organisation tier exists to administer the platform itself. This document scopes closing all three gaps together, per the user's resolved decisions (§11):

1. A new **platform-operator** tier — a principal-level grant that exists above and outside any single organisation, since none exists in the current domain model (§2.8) and a registration-token gate needs someone able to issue tokens, including for the very first organisation on a fresh deployment.
2. **Registration-token-gated organisation creation** — `createOrganisation` stops being callable by any authenticated principal (§2.7's longstanding ungated design) and instead requires redeeming a valid, platform-operator-issued registration token. This is a deliberate, disclosed reversal of that design, not an oversight.
3. **Mandatory first-run initialisation** — an organisation is not considered `INITIALISED` until it has a first `ProjectType`, a default LLM provider (`organisation_llm_providers`, E30), and an initial `Policy`, each genuinely created, not just acknowledged.
4. **Genuine server-side enforcement** — mutating API routes scoped to an organisation that is not yet `INITIALISED` are rejected, not merely hidden behind a UI nudge.

---

## 2. Grounding — confirmed against the real, current implementation

Per `AGENTS.md` §7/§8, this section states what is actually true today, verified by direct code inspection. §2.1–§2.7 are carried forward unchanged from v1.0; §2.8–§2.10 are new, added to ground the expanded v2.0 scope.

### 2.1 There is no self-service registration flow; identity is fully delegated to an external provider

`packages/identity/src/authentication/oidc-provider.ts` (`createOidcAuthProvider`, production) validates a real OIDC-issued JWT and derives `Principal.id` from its `sub` claim; `packages/identity/src/authentication/local-provider.ts` (`createLocalAuthProvider`, local dev only) trusts any bearer-token string as a principal id with zero credential verification. **DevOS itself never creates, stores, or verifies a login credential** — a principal simply exists the moment an external identity provider (or, in dev, any bearer string) successfully authenticates a request. Per the resolved Decision 1 (§11), this document does **not** change that: DevOS still never stores a password or issues its own login. What changes is what a successfully-authenticated principal is *permitted to do* (create an organisation) — an authorization gate, not a new authentication mechanism.

### 2.2 Organisation creation is a single, currently-ungated step — becoming Admin is its unannounced side effect

`createOrganisation` (`packages/application/src/organisations/create-organisation.ts:14-59`) lets any authenticated principal create an organisation. In the same transaction, it creates an org-level `Membership` (`projectId: null`, `role: 'ORGANISATION_ADMIN'`) for that principal and sets `organisations.owner_principal_id` (DEVOS-290, E29). This mechanism is reused unchanged by this epic — what changes is the precondition for calling it (§2.7, §5.2), not the mechanism itself.

### 2.3 The create-organisation UI already exists and works

`apps/web/src/features/organisations/OrganisationsPage.tsx:579-660` renders a working "New organisation" form (name + slug), reachable via the always-present `/organisations` nav item (`apps/web/src/App.tsx:119`), calling the unchanged `createOrganisation` use case. This confirms the underlying create mechanism already works end-to-end; this epic changes its precondition (a valid registration token, §5.2) and wraps it in a guided flow (§5.5), it does not rebuild it.

### 2.4 DevOS is multi-tenant by design — "fresh deployment" must be evaluated per-principal, not per-installation

`specs/architecture/domain-model.md` §5.1: an organisation is the top-level tenancy boundary, with no stated ceiling on how many an installation may hold; the real schema and every existing membership/access-control path (E29) confirm organisations already coexist side by side. A second, third, or Nth organisation can legitimately be created at any time. Registration-token gating (§5.2) must therefore work for *every* new organisation, not just the first — reflected in the epic's own separation between the one-time platform-operator bootstrap (§5.1) and ongoing, repeatable token issuance (§5.2).

### 2.5 No "initialised" concept exists anywhere in the data model

`Organisation.status` (`packages/domain/src/organisations/organisation.ts:3-23`) is an untyped `string`, set to the literal `'ACTIVE'` by `createOrganisation` and never anything else today. There is no `PENDING_SETUP`/`INITIALISED` status value anywhere. §5.3 gives this a real, persisted meaning for the first time.

### 2.6 The only existing "bootstrap" mechanism is a fixed local-dev demo seed, not a production admin-setup path

`packages/database/src/seed.ts` creates one hardcoded demonstration organisation for local development only, unparameterised for a real deployment's first admin, and unrelated to the real `createOrganisation` path (§2.2–2.3).

### 2.7 Organisation creation being ungated was, until this document, a deliberate, repeatedly-reconfirmed design decision

`specs/sprints/sprint-51/DEVOS-310.md:46`: *"`project.create`/`organisation.create` are ungated by design — 'any authenticated principal may create one and becomes its owner' is this codebase's own longstanding, symmetric convention for both entity types, predating this epic."* Re-confirmed as recently as E29's own closing disclosure (Sprint 51, 2026-09-27). **The resolved Decision 2 (§11) explicitly, deliberately reverses this for organisation creation** — the first time any epic in this repository has reversed a previously reconfirmed ungating decision. `project.create` is untouched — the reversal is scoped to `organisation.create` only, since a project is created *inside* an already-gated, already-initialised organisation and has its own existing membership-based authorization.

### 2.8 Nothing above Organisation exists today — a platform-operator tier is a genuinely new concept, not an extension of an existing one

Every access-control concept in this codebase is scoped to an organisation or below. `Membership` (`packages/domain/src/projects/membership.ts:17-26`) has a non-nullable `organisationId: OrganisationId` — even an org-level (`projectId: null`) membership still belongs to exactly one organisation; there is no way to represent a grant that spans or sits outside every organisation using the existing table. A repository-wide search for `platform-admin`/`platform-operator`/`super-admin`/`system-admin` across `specs/` and `packages/`/`apps/` source returns zero matches. `PRINCIPAL`/`HUMAN_PROFILE` (E29, Sprint 46, migration `0045_principals.ts`) do exist as real tables and are reused as the identity a platform-operator grant attaches to (§5.1), but the grant itself needs a new table — confirmed, not assumed.

### 2.9 The three required first-run setup items already exist as real, independent entities — none currently required

- `ProjectType`/`ProjectTypeWorkflow`/`ProjectTypeAgent` (Sprints 13–14, 22–23) are real, global, cross-tenant template resources (`specs/sprints/sprint-51/DEVOS-310.md:45`: *"entirely ungated... a consistent, pre-existing architectural choice"*) — a project picks one when created; nothing today requires an organisation to have touched a `ProjectType` at all.
- `organisation_llm_providers` (E30, Sprints 52–55) is real and optional — per `specs/DEVOS-LLM-CREDENTIAL-MANAGEMENT-BACKLOG.md` §5.1 (DEVOS-311), "no row required to exist — an org with none keeps today's platform-default behavior." Making one mandatory for initialisation is new, additive scope this epic introduces, not a reversal of E30's own design (E30's platform-default fallback behavior for an *already-initialised* organisation that later removes all its providers is unaffected — §4).
- `Policy` (`packages/domain/src/policy/policy.ts:12-29`) already supports an organisation-wide row (`projectId` is optional/nullable "so an organisation-wide policy remains representable later" per its own existing code comment) — but the current CRUD API (DEVOS-043) only ever creates project-scoped policies in practice. An organisation-wide policy-creation path does not yet exist end-to-end and is real, new scope (§5.3).

### 2.10 Config already has a precedent for exactly one deploy-time bootstrap secret

`packages/config/src/config.ts` reads `GEMINI_API_KEY` via `optional(raw.GEMINI_API_KEY)` into a typed config object — a single, optional, deploy-time environment variable read once at process startup. §9's disclosed bootstrap-platform-operator mechanism (§5.1) follows this exact, already-established pattern rather than inventing a new configuration mechanism.

---

## 3. Delivery Principles (carried forward, prior epic backlogs' own §3)

- Every sprint is independently, really verified against a real running system before being marked complete — not asserted from code review alone.
- No sprint changes the identity/authentication model (§2.1) — `AuthProvider`, OIDC delegation, and the "no DevOS-verified credential" contract stay exactly as they are today throughout this epic.
- The existing `createOrganisation`/membership/ownership mechanism (§2.2) is reused unchanged; this epic gates its precondition and wraps it in a guided UI, it does not replace or duplicate it.
- Every behavior change that narrows what an already-onboarded, already-initialised organisation or its members can do is staged so nothing already working silently breaks — matching E29's own backward-compatible sequencing discipline (`AGENTS.md` §4.1).
- The reversal of organisation-creation ungating (§2.7) is disclosed at the exact sprint that makes it real (§5.2/DEVOS-330), not buried in a later sprint's incidental change.

## 4. What NOT to Build in This Epic

- **No DevOS-native password/credential store or login flow.** Authentication stays fully delegated to the configured `AuthProvider` (§2.1, resolved Decision 1). A registration token is an authorization gate on *organisation creation*, never a login credential.
- **No change to `project.create`'s existing ungated behavior** (§2.7) — the reversal is scoped to `organisation.create` only.
- **No change to E30's own platform-default LLM fallback behavior** for a project/organisation with no configured provider — mandatory-at-initialisation (§2.9) is a new precondition for *becoming* `INITIALISED`, not a removal of the existing fallback for an organisation that later has none configured after the fact.
- **No general-purpose multi-tenant admin console beyond what §5.1/§5.2 scope** — platform-operator management is limited to granting/revoking operator status and issuing/listing/revoking registration tokens; broader platform-wide analytics/billing/ops tooling is explicitly out of scope.
- **No token-based invitation mechanism for *joining* an existing organisation** — that is the separate, already-existing `addMember`/`addOrganisationMember` path (Sprint 39, E29), untouched by this epic. Registration tokens gate *creating a new* organisation only.
- **No requirement that every *existing* organisation (created before this epic ships) retroactively complete the new mandatory setup before continuing to operate** — §5.4's enforcement applies to organisations created after this epic ships; pre-existing organisations are backfilled to `INITIALISED` directly (disclosed explicitly, not silently grandfathered without record) so nothing already in production use is suddenly blocked.
- **No self-service platform-operator elevation** — every platform operator beyond the disclosed bootstrap principal (§5.1/§9) is granted by an existing platform operator; there is no request/approval workflow beyond that direct grant in this epic.

---

## 5. Epic Map

Staged so every intermediate sprint leaves the system fully working and backward-compatible, per `AGENTS.md` §4.1 — the gate (§5.2) is not turned on until the tier that can administer it (§5.1) exists; enforcement (§5.4) is not turned on until there is something real to enforce (§5.3).

| Sprint | Outcome | Depends on |
| --- | --- | --- |
| 56 — Platform Operator Foundation | A new, principal-attached platform-operator grant, bootstrapped via a single deploy-time secret (§9); zero visible behavior change to any existing route | — |
| 57 — Registration Token & Invite-Gated Organisation Creation | `registration_tokens` table; `createOrganisation` gated behind redeeming a valid, platform-operator-issued token — the disclosed reversal of §2.7; platform-operator UI/API to issue/revoke tokens | 56 |
| 58 — Mandatory Initialisation Requirements | A real, persisted `INITIALISED` status on `Organisation`, computed from three genuine requirements (first `ProjectType`, a default LLM provider, an initial organisation-wide `Policy`) | — (independent of 57; both depend only on 56's principal/org model being unchanged) |
| 59 — Server-Side Enforcement | Mutating API routes scoped to a non-`INITIALISED` organisation are genuinely rejected, except the setup routes themselves; existing organisations backfilled to `INITIALISED` so nothing already in production breaks | 58 |
| 60 — Guided First-Run UI & Full-Epic Pilot | Token redemption + guided mandatory-setup wizard UI; a real end-to-end pilot proving the whole chain (bootstrap operator → issue token → redeem → create org+admin → complete all three requirements → previously-blocked routes now succeed); final validation and disclosure | 56, 57, 58, 59 |

Sprint 58 is written to not depend on Sprint 57 so the two could, if the user prefers, be reordered or parallelised at conversion time — flagged as a small, disclosed implementation choice (§9), not a blocking decision.

---

## 6. Product Backlog

### 6.1 Sprint 56 — Platform Operator Foundation (DEVOS-325–328)

| ID | Story | Acceptance summary |
| --- | --- | --- |
| DEVOS-325 | `platform_operators` table + domain/repository | New table: `principal_id` (FK to `principals`, unique), `granted_at`, `granted_by_principal_id` (nullable, for the one bootstrap grant that has no human grantor). A principal with no row is not a platform operator — confirmed additive, zero change to any existing authorization path. |
| DEVOS-326 | Deploy-time bootstrap platform operator | A single new optional config value (mirroring `GEMINI_API_KEY`'s pattern, §2.10 — e.g. `DEVOS_BOOTSTRAP_PLATFORM_OPERATOR_SUBJECT`, matching the bootstrap principal's `sub`/dev-token id) is read once at startup; on that principal's first authenticated request, if zero platform operators exist yet, they are granted platform-operator status automatically. Disclosed as this epic's own resolved assumption (§9) — confirm/override at conversion time. |
| DEVOS-327 | Platform-operator management (grant/revoke) | API (+ minimal UI) letting an existing platform operator grant operator status to another principal, or revoke an existing one — blocked from revoking the last remaining operator (mirrors `Organisation.ownerPrincipalId`'s existing "never leave zero owners" discipline, DEVOS-290). |
| DEVOS-328 | Validation, documentation, and gap disclosure | Full monorepo validation green; explicit written confirmation that no existing route's behavior changed — this sprint only adds a new, dormant grant table and its own narrowly-scoped management routes. |

### 6.2 Sprint 57 — Registration Token & Invite-Gated Organisation Creation (DEVOS-329–332)

| ID | Story | Acceptance summary |
| --- | --- | --- |
| DEVOS-329 | `registration_tokens` table, migration | New table: `token_hash` (never store the raw token), `issued_by_platform_operator_id` (FK), `status` (Active/Redeemed/Revoked/Expired), `expires_at`, `redeemed_by_principal_id`/`redeemed_organisation_id` (nullable until redeemed), timestamps. Issuable only via DEVOS-331's platform-operator-gated route. |
| DEVOS-330 | `createOrganisation` gated behind a valid, unredeemed registration token | The existing use case (§2.2) is widened to require a token argument; an invalid/expired/already-redeemed/revoked token is rejected with a clear error, mirroring `CredentialResolver`'s existing "never leak the secret value in an error" discipline (`AGENTS.md` §22). A successful call atomically creates the organisation + `ORGANISATION_ADMIN` membership (unchanged, §2.2) and marks the token `Redeemed`, recording which organisation/principal redeemed it. **This is the disclosed, deliberate reversal of §2.7** — called out explicitly in this task's own acceptance evidence, not folded silently into a larger change. |
| DEVOS-331 | Platform-operator UI/API: issue, list, revoke registration tokens | Mirrors E30's `organisation_llm_providers` UI conventions (masked/never-displayed-again token value on issuance, per `AGENTS.md` §22) and E29's organisation-admin-management UI patterns. |
| DEVOS-332 | Validation, documentation, and gap disclosure | Full monorepo validation green; live-verified against real Postgres that organisation creation now genuinely fails with no token, fails with an already-redeemed/expired/revoked token, and succeeds exactly once per valid token. |

### 6.3 Sprint 58 — Mandatory Initialisation Requirements (DEVOS-333–336)

| ID | Story | Acceptance summary |
| --- | --- | --- |
| DEVOS-333 | `Organisation` gains a real, persisted initialisation state | Widens `Organisation.status` (§2.5) or adds a dedicated tracking row (decided and disclosed at conversion time, §9) recording, per requirement: first `ProjectType` touched, default LLM provider configured, initial organisation-wide `Policy` created — each independently `true`/`false`, plus a derived `INITIALISED` boolean/status once all three are `true`. |
| DEVOS-334 | Wire real completion detection to each of the three existing subsystems | Computed from real writes to existing tables (a project created against any `ProjectType`, a row existing in `organisation_llm_providers`, a `Policy` row existing with `projectId` null for that organisation) — not a separate, disconnected manual checklist a user can tick without actually doing the thing. |
| DEVOS-335 | Organisation-wide policy creation, end-to-end | Per §2.9's disclosed gap, the existing project-scoped-only `Policy` creation path is widened to also support a real organisation-wide (`projectId: null`) policy, reusing `Policy`'s already-nullable field rather than a new table. |
| DEVOS-336 | Validation, documentation, and gap disclosure | Full monorepo validation green; live-verified against real Postgres that completing each of the three requirements, and only all three together, flips a real organisation from not-initialised to `INITIALISED`. |

### 6.4 Sprint 59 — Server-Side Enforcement (DEVOS-337–340)

| ID | Story | Acceptance summary |
| --- | --- | --- |
| DEVOS-337 | New initialisation-gate middleware/guard | Rejects mutating requests scoped to an organisation that is not yet `INITIALISED`, with a distinct, disclosed error shape (not a generic 403) naming which requirement(s) are still outstanding — read-only status checks and the setup routes themselves (ProjectType selection, LLM provider configuration, policy creation, token redemption) are explicitly exempted. |
| DEVOS-338 | Wire the guard into every existing organisation/project/workflow/agent/knowledge mutating route | A real, route-by-route pass over the existing ~105-route surface (mirroring E28 Sprint 44's/E29 Sprint 51's own full-route-re-audit precedent), confirming exactly which routes are gated and which are exempt — not assumed blanket coverage. |
| DEVOS-339 | Backfill every existing (pre-epic) organisation to `INITIALISED` | Per §4 — nothing already in production use is suddenly blocked by this sprint shipping; disclosed explicitly, not silently grandfathered without record, mirroring E29's own `ASSIGNEE = reporter_id` backfill-before-restriction precedent (DEVOS-305). |
| DEVOS-340 | Validation, documentation, and gap disclosure | Full monorepo validation green; live-verified against real Postgres that a genuinely non-`INITIALISED` organisation's mutating routes are really rejected, every setup route still succeeds, and every backfilled pre-existing organisation is unaffected. |

### 6.5 Sprint 60 — Guided First-Run UI & Full-Epic Pilot (DEVOS-341–344)

| ID | Story | Acceptance summary |
| --- | --- | --- |
| DEVOS-341 | Guided registration-token redemption + organisation-creation UI | Replaces the now-gated plain "New organisation" form (§2.3) with a flow that asks for a registration token first, then name/slug, explicitly disclosing in-product that completing this makes the current principal that organisation's Admin (§2.2) — the first time this side effect is shown to the user, not left silent. |
| DEVOS-342 | Guided mandatory-setup wizard | Surfaces DEVOS-333/334's three requirements as explicit, required (not optional) steps with real-time completion status, each linking to its real existing creation surface (ProjectType selection, the E30 "AI Providers" panel, organisation-wide policy creation from DEVOS-335). |
| DEVOS-343 | Real end-to-end pilot | Starting from a genuinely fresh state: the bootstrap platform operator (DEVOS-326) issues a real registration token (DEVOS-331), a second, previously-unaffiliated principal redeems it to create a real organisation (DEVOS-330/341), completes all three mandatory requirements (DEVOS-342), and is confirmed — via a real, direct attempt — to have been blocked from a mutating route beforehand and to succeed at it afterward (DEVOS-337/338). |
| DEVOS-344 | Final validation, documentation, and closing disclosure | Full monorepo `pnpm turbo run typecheck lint test build` and the full real `tests/e2e` suite green; a single written closing disclosure of everything deliberately left out of scope (§4), including the disclosed bootstrap-mechanism assumption (§9) and any implementation-time decisions made under §9's flagged small choices. |

---

## 7. Dependencies

- Sprint 57 depends on Sprint 56 — a token needs a platform operator to issue it.
- Sprint 58 depends only on Sprint 56 being unchanged underneath it (no direct dependency on Sprint 57's own tables) — order with Sprint 57 is a disclosed, non-blocking implementation choice (§5, §9).
- Sprint 59 depends on Sprint 58 — enforcement needs a real `INITIALISED` state to enforce.
- Sprint 60 depends on all four prior sprints — the guided UI and pilot exercise the token gate, the requirements, and the enforcement together.

## 8. Definition of Done

- Every acceptance summary in §6 independently, really verified against a real running system and real Postgres data — not asserted from code review alone.
- Full monorepo validation stays green after every sprint, including confirmation at each stage that no previously-working, already-`INITIALISED` organisation's behavior silently regresses.
- `DEVOS-BUILD-STATE.md`/`DEVOS-ROADMAP.md` are updated only on the user's explicit approval of each step, per `AGENTS.md` §18/§19 — this document does not authorize touching either.

---

## 9. Disclosed assumptions and small implementation details (deliberately not blocking scoping)

Per `AGENTS.md` §7, flagged explicitly rather than silently decided, but not re-looped through further questions given the user's own resolved direction (§11) already supplies enough signal to proceed to sprint conversion with these named and open to correction at that time:

- **Bootstrap platform-operator mechanism** (DEVOS-326): a single deploy-time environment variable naming the bootstrap principal, auto-granted on their first authenticated request while zero platform operators exist — the lowest-invention option consistent with this codebase's existing single-env-var-secret precedent (§2.10). If a different bootstrap mechanism is wanted (e.g., a one-time CLI/migration command instead of an env-var-triggered auto-grant), say so before Sprint 56 conversion.
- **Registration token lifetime/format**: single-use, expiring (a sensible default such as 7 days, made configurable rather than hardcoded), opaque random token, stored only as a hash (§2.10-adjacent, `AGENTS.md` §22) — the same shape as this codebase's existing bearer-token/credential-reference conventions, not a new pattern.
- **Sprint 58/59's exact persistence shape** (a widened `Organisation.status` vs. a new dedicated tracking table) — left to be decided and disclosed during Sprint 58 conversion, the same way several prior sprints left one named implementation choice open at conversion time.
- **Sprint 57 vs. Sprint 58 ordering** — independent of each other (§7); run in either order, or in parallel, at the user's preference.

---

## 10. Scope approval

If the five-sprint, twenty-story breakdown in §5–6 is the wrong shape (different split, added/removed story, different priority, different sprint ordering), say so now rather than after Sprint 56 begins.

---

## 11. Decisions

All open forks raised in v1.0 (and the follow-up forks its own resolutions exposed) have been resolved by the user. Recorded here, per `AGENTS.md` §28 (auditability) — preserved as history, not deleted, even though resolved.

1. **What "set up an Admin user" means.** Resolved: **DevOS gains a real credential-creation capability** — specifically (Decision 1a below), kept scoped to *organisation-creation gating*, not a new login mechanism. This is a materially larger departure than v1.0's default proposed shape (a UI-only wrapper with no new gate), and reshapes the entire epic (§1, §5–6).
   - **1a. Credential mechanism.** Resolved: **keep OIDC/external login exactly as-is; add DevOS-side gating on top.** DevOS never stores a password or issues its own login — the "credential" that's new is a registration token gating organisation creation, not an authentication credential (§2.1, §5.2).
   - **1b. Gating mechanism.** Resolved: **invite code / registration token** (not a platform-operator manual-approval workflow) gates organisation creation (§5.2).
   - **1c. Token issuance / bootstrap.** Resolved: **a new platform-operator role**, not reuse of the existing `ORGANISATION_ADMIN` concept — since no organisation (and therefore no `ORGANISATION_ADMIN`) exists yet for the very first registration token, and the user's resolution explicitly chose a new tier over reusing an existing one (§2.8, §5.1).
2. **What "initialise the application" requires.** Resolved: **all three** — a first `ProjectType`, a default LLM provider, and an initial policy are each mandatory, not optional, before an organisation is `INITIALISED` (§2.9, §5.3).
3. **Enforcement level.** Resolved: **genuine server-side enforcement** — mutating API routes for a non-`INITIALISED` organisation are rejected server-side, not merely hidden by a client-side UI nudge (§5.4).

Per `AGENTS.md` §35/§4.2, this document's decisions being resolved does **not** itself authorize conversion to `specs/sprints/sprint-56/` or any implementation — that is a separate, explicit approval, still pending.
