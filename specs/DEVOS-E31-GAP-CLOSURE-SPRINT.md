# DevOS Epic E31 Gap Closure — Single-Sprint Task Spec

**Document:** Single-sprint scope — closing disclosed gaps left open at candidate Epic E31's close, not a new epic.
**Status:** Approved for conversion, 2026-09-29 — Decisions 1–3 below resolved by explicit user choice. Converts to `specs/sprints/sprint-61/`.
**Task-ID authority:** Continues the real, continuous numbering used by every prior sprint/backlog document (`DEVOS-001`–`DEVOS-344`), starting at `DEVOS-345`.
**Requested by:** User, 2026-09-29 — close as many of Epic E31's six consolidated closing-disclosure gaps (`specs/sprints/sprint-60/DEVOS-344.md`, "Whole-epic closing disclosure") as warrant it, in the same session, following the Sprint 45 (Nocturne fidelity pass) precedent for standalone gap-closure work.

---

## 1. Purpose

Candidate Epic E31 (Sprints 56–60) closed complete and validated, but its own closing disclosure names six open items. Five are small and disparate enough to fit the Sprint 45 precedent (a standalone sprint, not a new epic); the sixth (dev-database residue) is a one-line destructive action needing its own explicit confirmation, not a spec. This document scopes the standalone sprint and surfaces the three genuine design forks found during direct-code grounding — mirroring `DEVOS-NOCTURNE-THEME-FIDELITY-SPRINT.md` §6's own "Open Decision" precedent — for the user's resolution before any conversion to `specs/sprints/sprint-61/`.

## 2. Grounding (confirmed by direct code inspection at conversion time)

### 2.1 Gap 1 — No audit trail for platform-operator grant/revoke

`packages/domain/src/audit/audit-record.ts:15` and migration `packages/database/migrations/0012_audit_records.ts:10` both make `organisationId`/`organisation_id` a required field with a `NOT NULL` FK to `organisations.id`. `grant-platform-operator.ts`/`revoke-platform-operator.ts` (Sprint 56) write no audit record at all — a platform operator sits above every organisation by design, so there is no `organisationId` value to give a would-be audit row. `AuditRecord` is read by 113 files across the codebase (list/report/route/DTO call sites), so widening the field is not contained to one file.

**This is a genuine schema fork — see Decision 1.**

### 2.2 Gap 2 — No transaction spans two different concerns; only one is mechanical

DEVOS-344's gap 2 actually names two structurally different races:

- **2a — organisation creation + token redemption** (`packages/application/src/organisations/create-organisation.ts:92-100`). This codebase already has an established, precedented "port declared in application, adapter built in database, wrapped in `withTransaction`" pattern for exactly this shape — `createDecideApprovalAndTransition` (`packages/database/src/repositories/decide-approval-and-transition.ts`, DEVOS-111) and `createOrganisationLlmProviderReorderer` (`organisation-llm-providers.ts:91-124`, DEVOS-321) both do this already. Wrapping `createOrganisation`'s create→membership→owner→redeem sequence the same way is mechanical, low-risk, and matches precedent exactly — **no open decision, included in scope directly.**
- **2b — the initialisation guard's read and the gated handler's write** (`apps/api/src/app.ts:769-777`). The guard runs at one central chokepoint (`handleRequest`), then hands off to whichever of the 47 gated routes' own handler runs next — each with its own independently-constructed, pool-bound (not transaction-bound) repository deps. Closing this for real would mean threading a shared transaction from the chokepoint through every one of those 47 handlers' own dependency injection — a large, cross-cutting refactor of request-scoped DI across the entire mutating route surface, not a mechanical fix. **This is a genuine scope fork — see Decision 2.**

### 2.3 Gap 3 — "Configuration of an already-satisfied requirement" stays gated

Per `specs/sprints/sprint-59/DEVOS-338.md`'s completed audit table, `POST .../llm-providers` (create) is the only exempt-setup route; `PATCH .../llm-providers/:providerId` (which both disables *and* re-activates an existing provider) is **Gated**, not exempt. Tracing the real consequence: if an organisation's only LLM provider is disabled via that `PATCH` route, `hasLlmProvider` becomes false and the organisation loses `INITIALISED` status — including for that same `PATCH` route itself, since only the *create* route is exempt. The only way back to `INITIALISED` is creating a brand-new provider row (the exempt route), not re-activating the disabled one — a real, disclosed, deliberate-but-unexercised edge case, not obviously a bug. Backlog §11 decision 3 already resolved "genuine server-side enforcement" as the general policy; this is a narrower question about one specific recovery path.

**This is a genuine, narrow behavior fork — see Decision 3.**

### 2.4 Gap 4 — dev-database residue (handled separately, not part of this sprint's spec) — RESOLVED, deleted

Direct query against the real dev Postgres database (`postgresql://devos:devos@localhost:5432/devos`) found **one** `organisations` row named `Other Org 7a3f465d-…` (id `0511a6ef-824a-4661-9a89-58693813b13b`, created `2026-09-25T07:07:49Z`) — not two, correcting `DEVOS-340.md`'s own disclosure. Its only real foreign-key footprint was 4 rows in `job_roles`; `memberships`/`projects`/`audit_records`/`organisation_llm_providers`/`policies` all showed zero references. Per the user's explicit confirmation (2026-09-29), both the 4 `job_roles` rows and the `organisations` row itself were deleted in one transaction, outside this sprint's own scope. Verified gone by re-query afterward. A second, unrelated residue row (`Cost Budget Pilot Org …`, not named in any E31 disclosure) still exists but is out of this epic's scope and was left untouched.

### 2.5 Gap 5 — checklist "Configure an AI provider" has no scroll-to behavior

`OrganisationSetupChecklist.tsx`'s "Configure an AI provider" action opens the same row's own `AiProvidersPanel` — correct behavior, just no scroll-into-view if that row is off-screen. Small, mechanical, one component. **No open decision.**

### 2.6 Gap 6 — pre-existing `@devos/api` test stderr noise

Confirmed unrelated to E31: present in every `@devos/api#test` run since long before Sprint 56, already disclosed and left untouched by every prior sprint in this epic (and several before it). **Out of scope for this sprint** — fixing it now would be unrelated cleanup with no current-task justification, against `AGENTS.md` §8.

## 3. Scope (Decisions 1–3 resolved — see §6)

| #         | Story                                                                      | Files (expected)                                                                 | Depends on |
| --------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------- |
| DEVOS-345 | Platform-operator grant/revoke audit trail — new `platform_audit_records` table + repository + listing route (Decision 1, Option B) | New migration, `packages/domain/src/audit/platform-audit-record.ts` (new), `packages/database/src/repositories/platform-audit-records.ts` (new), `grant-platform-operator.ts`/`revoke-platform-operator.ts`, a new `GET /platform-audit-records` route | — |
| DEVOS-346 | Transactional organisation creation + token redemption (gap 2a)             | `packages/database/src/repositories/create-organisation.ts` (new), `organisations/deps.ts`, `apps/api/src/app.ts` wiring | — |
| DEVOS-347 | `OrganisationSetupChecklist` scroll-to-panel fix (gap 5)                     | `apps/web/src/features/organisations/OrganisationSetupChecklist.tsx` (or equivalent) | — |
| DEVOS-348 | Narrow re-activation exemption for a zero-active-provider organisation (Decision 3, Option B) | `apps/api/src/routes/organisation-llm-providers.ts` (`resolveOrganisationId`/exemption check) | — |
| DEVOS-349 | Validation, documentation, and closing disclosure                           | —                                                                                   | DEVOS-345–348 |

## 4. What NOT to Build in This Sprint

- No fix for gap 2b (guard-read/handler-write atomicity across all 47 gated routes) — per Decision 2, left as an accepted, disclosed race, consistent with the identical disclosed race already accepted for gap 2a's own prior state and for token redemption (Sprint 57).
- No touch to the dev-database residue (gap 4) — already resolved and deleted separately, outside this sprint (see §2.4).
- No fix for gap 6 (pre-existing test stderr noise) — confirmed unrelated to this epic.
- No broader re-audit of Epic E31's already-closed decisions (backlog §11) beyond the one narrow question Decision 3 raises.
- No new platform-operator console features beyond whatever Decision 1 requires for auditing grant/revoke.

## 5. Definition of Done

- Every task's own acceptance criteria demonstrated before moving to the next, per `AGENTS.md` §4.1.
- Full monorepo validation (`pnpm turbo run typecheck lint test build --filter='!@devos/e2e-tests' --force`) green, matching Sprint 60's 76/76 baseline plus this sprint's new tests.
- Full real `tests/e2e` suite (`pnpm --filter @devos/e2e-tests test`) green, with any needed update disclosed.
- `DEVOS-BUILD-STATE.md`/`DEVOS-ROADMAP.md` updated only on the user's own explicit approval, per `AGENTS.md` §18/§19/§31 — this document does not authorize touching either.

---

## 6. Decisions (resolved by the user, 2026-09-29)

### Decision 1 — Platform-operator audit trail shape (gap 1) — RESOLVED: Option B

- **Option A — widen `AuditRecord.organisationId` to optional.** Smaller new surface (one field change, one migration, `null`-handling in `toDomain`/readers), but weakens an invariant 113 files currently rely on being always-present, and platform-operator audit rows would need a new listing path (`listForOrganisation`/`listForProject` both filter by a value these rows wouldn't have).
- **Option B (chosen) — a separate, dedicated platform-level audit concept** (new `platform_audit_records` table + narrow repository + a small platform-operator-scoped listing route). Zero change to the existing, heavily-used `AuditRecord` shape or its invariant; mirrors this codebase's own established precedent of adding a *new* table for a *new* tier rather than widening an existing one (`platform_operators`, `registration_tokens` — both Sprint 56/57 — did exactly this rather than widening `organisations`/`memberships`).

### Decision 2 — Scope of gap 2's transaction-boundary fix — RESOLVED: Option A

- **Option A (chosen) — fix only 2a** (organisation creation + token redemption, mechanical, precedented, low risk); leave 2b (guard-read/handler-write across 47 routes) as an accepted, disclosed race, same as it is today.
- **Option B — also attempt 2b**, which requires threading a shared transaction from `handleRequest`'s chokepoint through every one of the 47 gated routes' own handler dependency injection — realistically its own multi-sprint effort given the surface DEVOS-338's audit table shows, not a small gap-closure item. Not chosen.

### Decision 3 — Gap 3's "stuck after disabling your only LLM provider" edge case — RESOLVED: Option B, then SUPERSEDED by a correction during implementation

- **Option A (leave as designed)** — not chosen.
- **Option B (chosen, narrow exemption)** — treat `PATCH .../llm-providers/:providerId` as exempt *only* when it reactivates a provider on an organisation that currently has zero active providers. Implemented, then its own route-level test failed: `getOrganisationInitialisationStatus`'s `hasLlmProvider` (`packages/application/src/organisations/get-organisation-initialisation-status.ts:61`) checks row *existence* (`llmProviders.length > 0`), never `status` — disabling a provider never removes its row, so the organisation never actually loses `INITIALISED` status from disabling its only provider. The scenario this whole decision was scoped to close **does not reproduce against the real code** — a factually inaccurate premise inherited from `DEVOS-340.md`/`DEVOS-344.md`'s own prior disclosure, not independently verified against `hasLlmProvider`'s real implementation until this sprint's own test caught it.
- **Correction (2026-09-29, resolved directly with the user once discovered):** the exemption was fully reverted — no code change. A corrected, permanent regression test was kept instead, proving disabling an organisation's only provider leaves it `INITIALISED`. See `specs/sprints/sprint-61/DEVOS-347.md` for the full account.

### Gap 4 (dev-database residue) — RESOLVED: deleted, 2026-09-29 (see §2.4) — not a sprint-61 task.

Per `AGENTS.md` §35/§4.2, these resolutions authorize conversion to `specs/sprints/sprint-61/`, which follows.
