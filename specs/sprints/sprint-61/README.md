# Sprint 61 — Epic E31 Gap Closure

**Source:** `specs/DEVOS-E31-GAP-CLOSURE-SPRINT.md` (single-sprint scoping document, not part of any epic).
**Conversion date:** 2026-09-29
**Status:** Converted per explicit user authorization (2026-09-29) — Decisions 1–3 in the source document's own §6 resolved: platform-operator audit gets a separate `platform_audit_records` concept (Decision 1, Option B); only the organisation-creation/token-redemption transaction is added, the guard-vs-47-handler race stays an accepted, disclosed risk (Decision 2, Option A); the LLM-provider re-activation edge case gets a narrow exemption (Decision 3, Option B).

## Goal

Close four of the six gaps `specs/sprints/sprint-60/DEVOS-344.md`'s "Whole-epic closing disclosure" left open at candidate Epic E31's close: no audit trail for platform-operator grant/revoke; no transaction spanning organisation creation and token redemption; the "disable your only LLM provider, then get stuck" recovery edge case; and the setup checklist's missing scroll-to behavior. The other two (dev-database residue; pre-existing, unrelated `@devos/api` test stderr noise) are explicitly out of this sprint's scope — the former was already resolved and deleted separately (2026-09-29, outside this sprint, see the source document §2.4), the latter remains disclosed and untouched, confirmed unrelated to this epic.

## Grounding (confirmed by direct code inspection at conversion time)

See `specs/DEVOS-E31-GAP-CLOSURE-SPRINT.md` §2 for the full grounding behind every story below, including the real file/line citations for each gap and the reasoning behind Decisions 1–3. Not re-derived here.

## In scope

- **DEVOS-345** — A new, separate `platform_audit_records` table/repository/route, closing gap 1 without widening the existing `AuditRecord.organisationId` invariant.
- **DEVOS-346** — Wrap organisation creation + token redemption in one real database transaction, closing gap 2a. Gap 2b (the initialisation guard's read vs. the gated handler's write, across all 47 gated routes) stays an accepted, disclosed race per Decision 2 — no code change.
- **DEVOS-347** — Originally scoped per Decision 3 as a narrow re-activation exemption for gap 3's "stuck after disabling your only provider" edge case. **Superseded during implementation**: the scenario does not reproduce against the real code (`hasLlmProvider` checks row existence, not `status` — disabling never removes the row). Reverted to no code change; a corrected regression test was kept instead. See `DEVOS-347.md` for the full account.
- **DEVOS-348** — `OrganisationSetupChecklist`'s "Configure an AI provider" action scrolls its own row into view before opening the panel, closing gap 5.
- **DEVOS-349** — Validation, documentation, and closing disclosure.

## Out of scope

Gap 2b's full transaction-threading refactor (Decision 2, Option A not chosen). Any change to gap 3's other configuration actions beyond the one narrow re-activation case (Decision 3's own narrow scope). The dev-database residue (already handled, outside this sprint). The pre-existing `@devos/api` test stderr noise (confirmed unrelated to this epic). Any re-opening of Epic E31's own already-closed backlog decisions (`specs/DEVOS-ORGANISATION-ONBOARDING-BACKLOG.md` §11) beyond Decision 3's narrow question.

## Task index

| ID        | Story                                                          | File           |
| --------- | --------------------------------------------------------------- | -------------- |
| DEVOS-345 | Platform-operator grant/revoke audit trail (new, separate concept) | `DEVOS-345.md` |
| DEVOS-346 | Transactional organisation creation + token redemption          | `DEVOS-346.md` |
| DEVOS-347 | Narrow LLM-provider re-activation exemption                     | `DEVOS-347.md` |
| DEVOS-348 | Setup checklist scroll-to-panel fix                              | `DEVOS-348.md` |
| DEVOS-349 | Validation, documentation, and closing disclosure                | `DEVOS-349.md` |
