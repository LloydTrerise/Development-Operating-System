# Sprint 51 — Reconciliation, Full-Epic Re-Audit & Close-Out

**Source:** `specs/DEVOS-ACCESS-CONTROL-MODEL-BACKLOG.md` §6.6 (candidate E29 Identity & Access Control Redesign, sixth and final sprint).
**Conversion date:** 2026-09-25
**Status:** Converted and executed per explicit user instruction ("Proceed with sprint. Run through sprint fully without waiting for authorisation after each task. Stop once sprint is done", 2026-09-25, in direct response to a position report naming Sprint 51 as the recorded next action). Depends on every prior sprint in this epic (46–50) being COMPLETE — confirmed true, per `DEVOS-BUILD-STATE.md`'s own state-change-log.

## Goal

Close the epic: reconcile `audit_records` against the source document's `AUDIT_LOG` table; re-confirm that authorization is correct under the new model across the codebase (mirroring Sprint 44's route-re-audit precedent, but auditing _authorization correctness_, not UI reachability — a materially different question, since Sprint 44 already closed reachability for E28); run full validation; and produce the epic's one required closing disclosure of what was deliberately left out of scope.

## Grounding (confirmed by direct code inspection before scoping)

- **The source document was read in full** (`Analysis/DEVOS Access Control Model.docx`, extracted via its own `word/document.xml`, since no plain-text/Markdown copy exists on disk) — its permission catalogue, entity-relationship diagrams, and access rules are the literal baseline this task reconciles against, not assumed from the backlog's own summary.
- **`audit_records` (`0012_audit_records.ts`) substantially satisfies `AUDIT_LOG`** as §2.7 already found — full column-by-column reconciliation in `DEVOS-308.md`.
- **A real, significant authorization bug was found during this sprint's own re-audit, not merely disclosed — and fixed**, per this codebase's own established precedent (Sprints 48/49/50 each fixed real bugs found during their own required verification): `resolveOrganisationMembership` (`packages/application/src/organisations/membership-access.ts`), the chokepoint underneath every organisation-scoped route, has always had a documented, deliberately-tested (Sprint 39/DEVOS-254) fallback to _any project-level membership within the organisation_ when no org-level row exists — including, and specifically, a plain project `OWNER`. That fallback was reasonable when written (most organisations genuinely had no org-level membership row at the time), but Sprint 47 (DEVOS-290) has since made every organisation's real org-level `ORGANISATION_ADMIN` row guaranteed to exist (`createOrganisation`; migration `0048`'s own backfill) and given that role far greater weight — full, catalogue-driven, project-`OWNER`-equivalent authority over _every_ project in the organisation via `resolveMembership`'s own separate, correctly narrower, org-level-only fallback. Left unchanged, this meant the `OWNER` of even one project — never granted any organisation-level standing by anyone — could still rename the organisation, add or remove organisation-level co-admins (including granting _themselves_ `ORGANISATION_ADMIN`, which then unlocks every other project in the organisation), or assign/revoke organisation-held job roles. This is exactly the privilege-escalation shape §9.2/§9.3's resolved decisions were written to prevent. Full detail, fix, and live verification in `DEVOS-309.md`.
- **Every one of the six write-gated organisation-scope use cases** (`updateOrganisation`, `addOrganisationMember`, `removeOrganisationMember`, `changeOrganisationMemberRole`, `assignPrincipalJobRole`, `removePrincipalJobRole`) was individually confirmed, by direct inspection, to be the _complete_ set of `canManageMembers`/`canUpdateOrganisation` call sites reachable through `resolveOrganisationMembership` — not assumed from the two or three most obvious ones.
- **The project-scope equivalent, `resolveMembership` (`packages/application/src/projects/membership-access.ts`), was independently re-confirmed correct, not merely assumed safe by symmetry**: its own org-level fallback only ever matches a genuine `projectId: null` row (never a _different_ project's role), so it carries no analogous bug. 76 of the application layer's use-case files call it directly; every one of them inherits the same, now-reconfirmed-correct chokepoint.
- **Every route file was enumerated programmatically**: `apps/api/src/routes/*.ts` now has 25 files (unchanged file count since Sprint 44's own 24 plus this epic's new `job-roles.ts`) and 116 routes (up from 105 at Sprint 44 — the growth entirely accounted for by this epic's own new routes: 7 job-role routes, 3 work-item-assignment routes, and organisation owner/admin/transfer routes from Sprints 47–50).
- **Several real, narrow divergences between the source document's own idealized model and this codebase's actual, longstanding conventions were found and are disclosed, not fixed**, since none is named as in-scope by any of Sprints 46–51's own stories and several predate this epic entirely (e.g. `createProject`/`createOrganisation` are both deliberately, symmetrically ungated at creation time — "any authenticated principal may create one" is this codebase's own established convention, not a regression). Full list in `DEVOS-309.md`'s own disclosure table.

## In scope

- **DEVOS-308** — `AUDIT_LOG` reconciliation, recorded in `DEVOS-308.md`.
- **DEVOS-309** — Full-epic authorization re-audit, including the real organisation-admin privilege-escalation fix described above, recorded in `DEVOS-309.md`.
- **DEVOS-310** — Full monorepo validation, the full real `tests/e2e` suite, and the epic's closing disclosure, recorded in `DEVOS-310.md`.

## Out of scope

- Building a new `AUDIT_LOG` table (§2.7/§4: `audit_records` already substantially satisfies it).
- Building `DIVISION`/`DIVISION_MEMBER` or `AGENT_CREDENTIAL` — both deliberately excluded from this epic's entire scope (§4), reconfirmed still absent, not newly evaluated.
- Fixing any of the disclosed, out-of-epic-scope divergences DEVOS-309 documents (ungated project/project-type creation, `addMember` not requiring prior organisation standing, no `workitem.comment`/`workitem.delete` capability, `agent.manage` not gated to org-admin-or-accountable-owner) — none is named by any story in this epic; each is recorded for the user's own future prioritization, not silently decided here.
- Any change to the separate ABAC/tool-invocation policy engine (`packages/policy`) — confirmed unrelated throughout this epic (§2.3), reconfirmed unchanged.
- `DEVOS-BUILD-STATE.md`/`DEVOS-ROADMAP.md` updates before the user's explicit approval of this sprint's completion, per `AGENTS.md` §18/§19.

## Task index

| ID        | Story                                                             | File           |
| --------- | ----------------------------------------------------------------- | -------------- |
| DEVOS-308 | `AUDIT_LOG` reconciliation                                        | `DEVOS-308.md` |
| DEVOS-309 | Full-epic authorization re-audit (incl. the admin-escalation fix) | `DEVOS-309.md` |
| DEVOS-310 | Final validation, documentation, and gap disclosure               | `DEVOS-310.md` |
