# Sprint 58 — Mandatory Initialisation Requirements

**Source:** `specs/DEVOS-ORGANISATION-ONBOARDING-BACKLOG.md` §6.3 (candidate epic E31, Organisation Onboarding, Registration Gating & Mandatory Initialisation).
**Conversion date:** 2026-09-29
**Status:** Converted and authorized for implementation in the same session, per explicit user instruction ("Proceed with sprint. Run through sprint fully without waiting for authorisation after each task. Stop once sprint is done", 2026-09-29). Per `AGENTS.md` §4.1's one-step-at-a-time discipline, only this sprint is converted — Sprints 59–60 remain unconverted until the user explicitly authorizes continuing past Sprint 58.

## ⚠ Disclosed decision — persistence shape (read before implementing DEVOS-333)

`specs/DEVOS-ORGANISATION-ONBOARDING-BACKLOG.md` §9 left this sprint's own persistence shape open at conversion time, naming two options: widen `Organisation.status` (`packages/domain/src/organisations/organisation.ts:7`, today a bare, untyped `string` always set to the literal `'ACTIVE'`), or add a new dedicated tracking table. Direct inspection of the real, current implementation at conversion time found a third option is the better fit, and this sprint uses it instead of either named option:

**Decision: no new column and no new table. `INITIALISED` and its three underlying requirements are computed live, on every read, directly from the three already-real, already-persisted tables that back them** (`projects`, `organisation_llm_providers`, `policies` — all three already expose a `listForOrganisation(organisationId)` repository method, confirmed by direct inspection, none of which required any change for this sprint to use).

Reasoning, disclosed per `AGENTS.md` §7:

- **Widening `Organisation.status` was rejected.** `status` today is an unrelated, orthogonal concept (whether an organisation is active/disabled) with zero existing branded type or enum anywhere in the codebase (unlike `PolicyStatus`/`RegistrationTokenStatus`/`OrganisationLlmProviderStatus`, which are all real `packages/contracts/src/status.ts` unions). Overloading it with initialisation-progress values would conflate two independent lifecycles and require inventing enum values with no existing precedent for this specific field.
- **A new dedicated tracking table was rejected.** All three underlying facts already exist as real, independently-persisted rows the moment they happen (a `Project` row, an `organisation_llm_providers` row, a `Policy` row with `projectId` null) — a fourth, denormalized summary table would need to be kept in sync from three separate, currently-unrelated write call sites (`createProject`, `createOrganisationLlmProvider`, `createOrganisationPolicy`), introducing a real staleness/synchronization risk for zero functional benefit at this system's current scale.
- **This mirrors this same epic's own established precedent.** Sprint 57 (`specs/sprints/sprint-57/DEVOS-332.md`'s gap disclosure) deliberately computes a registration token's `EXPIRED` status at read time from `expiresAt` rather than storing it as a separately-transitioned value, for the identical reason (no writer in scope ever needs to write it, and deriving it live is simpler and cannot go stale).
- **Forward note for Sprint 59 (not in this sprint's scope):** its own server-side enforcement guard will need to call this sprint's new read (three lightweight indexed queries) per mutating request rather than reading one cached column. Disclosed here so a future implementer isn't surprised — not a blocker for this sprint, and not a decision this sprint needs to revisit (if request-path cost ever becomes a real, measured problem, caching can be introduced then, against a real, measured need, per `AGENTS.md` §8's "don't design for hypothetical future requirements").

## ⚠ Disclosed correction — DEVOS-335's premise is already satisfied (read before implementing DEVOS-335)

The backlog's own §2.9/§6.3 states organisation-wide policy creation "does not yet exist end-to-end" and frames DEVOS-335 as widening "the existing project-scoped-only `Policy` creation path." Direct inspection at conversion time found this premise **factually incorrect for the current codebase** — organisation-wide policy creation already exists completely end-to-end, predating this epic:

- `packages/application/src/policy/create-organisation-policy.ts` (`createOrganisationPolicy`) — a real use case creating a `Policy` with no `projectId` at all, distinct from the project-scoped `createPolicy`.
- `apps/api/src/routes/policies.ts` already exposes `POST ${prefix}/organisations/:organisationId/policies`, explicitly commented `DEVOS-139: the organisation-scoped mirror` of the project-scoped route.
- `apps/web/src/components/PolicyAuthoringForm.tsx` already has a "Scope" selector with a `"This project's organisation"` option wired to `createOrganisationPolicy`, and `apps/web/src/features/governance/GovernancePage.tsx` already lists both project and organisation-wide policies side by side.

This is disclosed here rather than silently reflected only in `DEVOS-335.md`, per `AGENTS.md` §7 ("repository state over conflicting prior text") and mirroring Sprint 57/`DEVOS-332.md`'s own precedent for correcting an earlier, unverified assumption once direct inspection contradicted it. DEVOS-335's real, remaining scope in this sprint is **verification and disclosure that this already-existing mechanism genuinely satisfies the "initial organisation-wide policy" requirement DEVOS-334 detects against**, not new construction.

## Goal

Give `Organisation` a real way to determine whether it has completed first-run setup — a first `Project` (which always carries a `ProjectType`, defaulted if the caller doesn't pick one), a default LLM provider (`organisation_llm_providers`), and an initial organisation-wide `Policy` — each independently detectable from real writes to the tables that already back them, plus a derived `INITIALISED` boolean once all three are true. No enforcement of this status against any route is introduced in this sprint (that is Sprint 59's own scope) — this sprint only makes the status genuinely computable and readable.

## Grounding (confirmed against the real, current implementation)

- `packages/domain/src/organisations/organisation.ts:3-24` — `Organisation.status` is a bare `string`, set only to the literal `'ACTIVE'` by `createOrganisation`; nothing else in the codebase branches on a specific value (confirmed by a full grep of `.status` on `Organisation` objects across `packages/` and `apps/`).
- `packages/domain/src/projects/project.ts` / `packages/application/src/projects/create-project.ts:24` — `Project.projectTypeId` is non-nullable; `createProject` defaults it to the seeded `SOFTWARE_DEVELOPMENT_PROJECT_TYPE_ID` when the caller doesn't supply one. Every `Project` therefore always carries *some* `ProjectType` — "has this organisation touched a `ProjectType`" is equivalent to "does this organisation have at least one `Project`," confirmed via `ProjectRepository.listForOrganisation(organisationId)` (already implemented, already used elsewhere).
- `packages/domain/src/organisations/organisation-llm-provider.ts` (Sprint 52, DEVOS-311) — `OrganisationLlmProviderRepository.listForOrganisation(organisationId)` already exists and is already used by the "AI Providers" panel (Sprint 54).
- `packages/domain/src/policy/policy.ts` / `packages/database/src/repositories/policies.ts:79-89` — `PolicyRepository.listForOrganisation(organisationId)` already exists and is already implemented to filter `project_id IS NULL` at the SQL level — i.e. it already returns exactly the organisation-wide policies this sprint needs to detect, with no change required.
- `packages/application/src/organisations/membership-access.ts:29-43` — `resolveOrganisationMembership`, the existing, established pattern for "read-only org-wide visibility routes" (its own doc comment names cost/audit/engineering-report reads and **policy listing** as its precedent), is reused unchanged for this sprint's own new read rather than inventing a new authorization check.
- `packages/application/src/organisations/deps.ts:42-55` — `OrganisationLlmProviderUseCaseDeps`'s own doc comment (DEVOS-321) explicitly states the established convention this sprint follows: **a narrow, dedicated deps type per new use case, not widening the shared `OrganisationUseCaseDeps`** — "not every `OrganisationUseCaseDeps` test fake needs a new field it never uses."
- `apps/api/src/routes/organisation-llm-providers.ts` — the structural precedent for this sprint's own new route file: a narrow, dedicated deps type, one file, registered separately in `apps/api/src/app.ts`.

## In scope

- **DEVOS-333** — `OrganisationInitialisationStatus` shape and the disclosed persistence-shape decision (no new migration; computed live from three already-real, already-persisted tables).
- **DEVOS-334** — `getOrganisationInitialisationStatus` use case wiring real completion detection to the three existing subsystems, plus its own narrow deps type and a new, minimal read-only API route.
- **DEVOS-335** — Verification and disclosure that organisation-wide policy creation (already existing, DEVOS-139) genuinely satisfies the "initial policy" requirement — no new production code.
- **DEVOS-336** — Validation, documentation, and gap disclosure.

## Out of scope

Everything Sprint 59 (server-side enforcement against non-`INITIALISED` organisations) and Sprint 60 (guided setup wizard UI, full-epic pilot) own — per the epic map in `specs/DEVOS-ORGANISATION-ONBOARDING-BACKLOG.md` §5. No new migration (per the disclosed decision above). No change to `createOrganisation`, `Organisation.status`, or any existing route's behavior. No UI — Sprint 60 (DEVOS-342) owns surfacing this sprint's new read as a guided wizard; this sprint's new route exists so the status is genuinely readable and live-verifiable, not to be user-facing yet.

## Task index

| ID        | Story                                                                    | File           |
| --------- | ------------------------------------------------------------------------ | -------------- |
| DEVOS-333 | `Organisation` initialisation-status shape and persistence-shape decision | `DEVOS-333.md` |
| DEVOS-334 | Wire real completion detection to the three existing subsystems          | `DEVOS-334.md` |
| DEVOS-335 | Organisation-wide policy creation — verification, not new construction   | `DEVOS-335.md` |
| DEVOS-336 | Validation, documentation, and gap disclosure                            | `DEVOS-336.md` |
