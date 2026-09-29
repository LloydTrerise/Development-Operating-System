# DEVOS-343 — Real end-to-end pilot

**Priority:** P1
**Depends on:** DEVOS-341, DEVOS-342 (the guided flows this pilot exercises the mechanism of — see this sprint's README's own disclosed decision on why the pilot's *proof* is direct HTTP, not a driven browser). Sprints 56–59 (bootstrap operator, token issuance, initialisation status, enforcement guard — all unchanged).
**Depended on by:** DEVOS-344 (final validation references this task's own live-proof evidence).

## Scope

A real, live pilot against the real dev Postgres and a real running `apps/api` server, starting from a genuinely fresh actor (a principal with no prior platform-operator grant, no prior organisation membership): the bootstrap platform operator issues a real registration token; a second, previously-unaffiliated principal redeems it to create a real organisation; that principal completes all three mandatory requirements; a genuinely gated mutating route (one of the 47 DEVOS-338 wired the guard into — not one of the 3 exempt setup routes) is confirmed rejected before setup completes and confirmed to succeed after.

## Implementation

Mirrors `specs/sprints/sprint-59/DEVOS-340.md`'s own 11-step live-proof structure exactly (steps 1-3, 8-11 below reuse that sprint's already-proven mechanism unchanged; steps 4-7 are this sprint's own new contribution — the full chain driven by a second principal end-to-end):

1. Start the real `apps/api` server against real Postgres with `DEVOS_BOOTSTRAP_PLATFORM_OPERATOR_SUBJECT` set to a fresh bootstrap-operator subject.
2. Bootstrap the platform operator (`GET /me`, Sprint 56, unchanged) and issue a real registration token (`POST /registration-tokens`, Sprint 57, unchanged) as that operator.
3. As a **second, previously-unaffiliated principal** (a distinct bearer subject with zero prior platform-operator grant or organisation membership), redeem the token: `POST /organisations` with `{ name, slug, registrationToken }` — succeeds, creating the organisation and this principal's own `ORGANISATION_ADMIN` membership (Sprint 57, unchanged mechanism; DEVOS-341's own UI is the same call, this pilot performs it directly per this sprint's own disclosed decision).
4. **Pre-setup gate proof**: as this same second principal, attempt a genuinely gated mutating route against the new organisation (e.g. `PATCH /organisations/:id`, or a via-project route) — confirm `403 DEVOS_ORGANISATION_NOT_INITIALISED` with `details.missingRequirements` naming all three outstanding requirements.
5. Complete requirement 1: `POST /projects` against the new organisation — succeeds (exempt setup route, Sprint 59, unchanged). Confirm `GET .../initialisation-status` now shows `hasProjectType: true`.
6. Complete requirement 2: `POST /organisations/:id/llm-providers` — succeeds (exempt setup route). Confirm `hasLlmProvider: true`.
7. Complete requirement 3: `POST /organisations/:id/policies` (organisation-wide, `projectId` absent) — succeeds (exempt setup route). Confirm `GET .../initialisation-status` now shows `initialised: true`.
8. **Post-setup unblocking proof**: repeat the exact same gated mutating request from step 4 — confirm it now succeeds (`200`), with no other change to the request.
9. **Zero-regression spot-check**: confirm one "exempt, not organisation-scoped" route (e.g. `POST /project-types`) is unaffected throughout, mirroring Sprint 59's own step 10.
10. Cleanup: delete every row this pilot created, in dependency order, mirroring Sprint 59's own disclosed cleanup ordering; confirm zero residue via a final count.
11. Record every step's real request/response evidence in this file's own "Real end-to-end proof" section (appended after running the pilot), per this epic's own established evidentiary standard.

## Out of scope

Any new browser-automation test harness (see this sprint's README's own disclosed decision). Any change to the mechanisms this pilot exercises (Sprints 56–59, and DEVOS-341/342's own UI) — this task proves the existing chain works end-to-end, it does not alter any part of it.

## Acceptance

All 11 steps above genuinely performed against a real running server and real Postgres, with real request/response evidence recorded in this file. Step 4's block and step 8's unblock are both against the same gated route with the same request shape, differing only in the organisation's real completion state — proving the guard's own live behavior, not a stubbed or fixture-based approximation. Full cleanup confirmed with zero residue.

## Real end-to-end proof (run 2026-09-29)

Real Postgres (`docker-postgres-1`), migrations confirmed current (`0062_organisations_add_initialisation_enforcement_exempt` applied, latest of 62). Real `apps/api` server started (`node apps/api/dist/main.js`, port 3000) with `DEVOS_BOOTSTRAP_PLATFORM_OPERATOR_SUBJECT=sprint60-bootstrap-operator`. Pre-run check confirmed zero pre-existing platform operators, so this run is a genuine bootstrap, not a reuse of an already-elevated principal.

1. **Bootstrap**: `GET /me` as `sprint60-bootstrap-operator` → `{"id":"sprint60-bootstrap-operator"}`. `GET /platform-operators` confirmed exactly one operator, this principal, `grantedByPrincipalId` absent (bootstrap grant).
2. **Issue token**: `POST /registration-tokens` as the operator → `201`-equivalent body with `status: "ACTIVE"`, a real `rawToken`, `expiresAt` one week out.
3. **Redeem, as a second, previously-unaffiliated principal** (`sprint60-alice`, zero prior platform-operator grant or membership): `POST /organisations` with `{name: "Sprint60 Pilot Org", slug: "sprint60-pilot-org", registrationToken: <raw>}` → `200`, organisation `8b524e6e-…`, `ownerPrincipalId: "sprint60-alice"`.
4. **Pre-setup gate proof**: `PATCH /organisations/8b524e6e-…` as `sprint60-alice` → genuinely rejected, `403 DEVOS_ORGANISATION_NOT_INITIALISED`, `details.missingRequirements: ["hasProjectType","hasLlmProvider","hasPolicy"]`.
5. **Requirement 1**: `POST /projects` (`organisationId: 8b524e6e-…`) → `200`, project `566e90be-…` (exempt setup route, succeeded despite non-initialised organisation). `GET .../initialisation-status` → `hasProjectType: true`, the other two still `false`.
   - **Bonus live proof (via-project resolver, re-evaluated)**: `PATCH /projects/566e90be-…` → still rejected, but `details.missingRequirements` now correctly lists only `["hasLlmProvider","hasPolicy"]` — confirms the guard re-reads live status on every request rather than caching the first rejection.
6. **Requirement 2**: `POST /organisations/8b524e6e-…/llm-providers` (`provider: "gemini"`) → `200` (exempt setup route). Status → `hasLlmProvider: true`.
7. **Requirement 3**: `POST /organisations/8b524e6e-…/policies` (organisation-wide, no `projectId`, `key: "sprint60-pilot-policy"`) → `200`, `status: "DRAFT"` (exempt setup route — creation alone satisfies `hasPolicy`, publish not required, matching Sprint 59's own grounding). Status → `initialised: true`.
8. **Unblocking proof**: the exact same `PATCH /organisations/8b524e6e-…` request from step 4, unchanged, now → `200`, name genuinely updated.
9. **Zero-regression spot-check**: `POST /project-types` (exempt, not organisation-scoped) as `sprint60-alice` on this same non-owner-of-any-other-organisation principal → `200`, unaffected by any organisation's status.
10. **Cleanup**: every row this run created was deleted directly against real Postgres, in real dependency order (discovered live via the real FK errors returned, each fixed forward rather than guessed in advance): `audit_records` (actor-scoped) → `policies` → `organisation_llm_providers` → `memberships` → `agent_executions`/`agent_versions`/`agent_profiles`/`agents` (the project-type clone pipeline's own real output, scoped to the pilot project) → `workflow_versions`/`workflow_definitions` (same clone pipeline) → `projects` → `registration_tokens` → `organisations` → `project_types` → `platform_operators` → `human_profiles` → `principals`. A final `SELECT count(*)` across every one of these tables for every id this run created confirmed **zero residue**. The server process was located by PID (`netstat`) and force-stopped; a follow-up request confirmed the port was no longer listening.

**Disclosed, non-blocking finding**: step 10's cleanup needed two more table categories than Sprint 59's own precedent listed (`agent_executions`/`agent_versions`/`agent_profiles`/`agents` and `workflow_versions`/`workflow_definitions`) — Sprint 59's own pilot organisation apparently never had `POST /projects` called against it with the real, current `software-development` `ProjectType`'s full clone pipeline (which clones both agents and workflow definitions/versions into every new project), while this pilot's step 5 did. Not a defect — the real clone pipeline (Sprints 2–4) has always done this; it was simply not exercised by name in Sprint 59's own narrower proof. Recorded here so a future sprint's own pilot does not have to rediscover the same FK chain from scratch.
