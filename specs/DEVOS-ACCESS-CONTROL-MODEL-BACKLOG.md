# DevOS Access Control Model — Backlog & Sprint Plan

**Document:** Candidate E29 (Identity & Access Control Redesign) Backlog & Sprint Plan
**Version:** 2.0 — revised after the user resolved all open decisions from v1.0 (§9 below records each resolution and why).
**Status:** Decisions resolved — scope agreed. Still not authorized for implementation. Per `AGENTS.md` §35/§4.2, converting this into `specs/sprints/sprint-46/` (or any sprint below) and any implementation still requires the user's separate, explicit authorization to begin.
**Source:** `Analysis/DEVOS Access Control Model.docx` (dated Sep 23, 2026), extracted and read in full for this document.
**Predecessor:** `DEVOS-BUILD-STATE.md`'s own 2026-09-23 (Sprint 44) entry named "real user identity/invite/suspend/role management" as permanently out of E28's scope, "a candidate future epic starting with identity/auth design." This document is that epic.
**Task-ID authority:** Continues the real, continuous numbering used by every prior sprint/backlog document (`DEVOS-001`–`DEVOS-283`), starting at `DEVOS-284`.

---

## 1. Purpose

The source document proposes a full identity/authorization model: a four-tier scope hierarchy (Organization → Division → Project → Work item), a unified `PRINCIPAL` entity covering both humans and agents, two independent role axes (job roles vs. access roles), agents as credentialed first-class actors, and a 17-permission role/permission catalogue. It is a **complete replacement of DevOS's current authorization core**, not an incremental feature — every one of the ~105 existing API routes authorizes against the model this document proposes changing.

Version 1.0 of this document grounded every one of the source document's claims against the real codebase (§2) and raised nine open decisions rather than silently resolving them, per `AGENTS.md` §7. The user has since resolved all nine (§9). Two of those resolutions materially reshaped the scope from v1.0:

- **Organisation and Division are the same tier, not two.** Each organisation is its own install/tenant; there is no separate Division layer above Project. This removes an entire table pair (`DIVISION`/`DIVISION_MEMBER`) from the plan — what the source document calls "division owner/admin" now applies to the existing `ORGANIZATION` tier instead, reusing Sprint 39's already-shipped organisation-level membership rather than building a new tier.
- **Agents never authenticate.** Agents run autonomously off workflow assignment; they are never issued their own login credentials and never present a bearer token as themselves. This removes `AGENT_CREDENTIAL` and the "agent authentication path" story entirely — agents get an identity (`AGENT_PROFILE`) for audit attribution and an accountable owner only, never a login mechanism.

The epic map (§5) and backlog (§6) below reflect these resolutions directly — this is not the same 7-sprint, 33-task shape v1.0 proposed; it is 6 sprints, 27 tasks.

---

## 2. Grounding — confirmed against the real, current implementation

Per `AGENTS.md` §7/§8, this section states what is actually true today, verified by direct code inspection, not assumed from the source document's own diagrams. Unchanged from v1.0 except where noted.

### 2.1 Scope hierarchy — no Division tier exists, and none will be built

Today: `organisations` (`packages/database/migrations/0001_organisations.ts:8`) → `projects` (`0002_projects.ts:9-19`, FK directly to `organisations.id`) → `work_items` (`0004_work_items.ts:8-22`, FK to `projects.id` only). Two tiers, not three. `grep -r "Division" specs/` returns zero matches anywhere in the approved specification set. **Resolved (§9.2): this stays a two-tier hierarchy.** Each organisation is its own tenant/install, so "division owner/admin" and "computed project access without an explicit membership row" (the source document's Option B) are built at the `ORGANIZATION` tier instead of a new tier above `PROJECT`.

### 2.2 No unified Principal — humans have no row of their own; agents are definitions, not identities

`memberships.principal_id` (`0003_memberships.ts:8-17`) is an opaque `text` column with no table of its own behind it — a human today is identified only by whatever subject/email string the `AuthProvider` returns (`packages/identity/src/principals/principal.ts:9-12`, `{ id: string; email?: string }`), never persisted as its own row. Agents are a completely separate, unrelated entity: `agents`/`agent_versions` (`0015_agents.ts:8-36`) are project-scoped **configuration definitions** (`key`/`name`/`configuration`/`prompt_reference`), with no credential, no login mechanism, and no identity distinct from whichever human or run triggered their execution. The `PRINCIPAL`/`HUMAN_PROFILE`/`AGENT_PROFILE` unification is genuinely new on both sides, not an extension of either. **Resolved (§9.7): `AGENT_PROFILE` is an identity for audit attribution and ownership only — it never gains a login/authentication mechanism.**

### 2.3 Roles today are a hardcoded 2-value enum, not a catalogue

`export const membershipRoles = ['OWNER', 'MEMBER'] as const;` (`packages/domain/src/projects/membership.ts:3`). Every permission check is a hardcoded pure function (`canManageMembers`, `canUpdateProject`, `canDecideApproval`, `canPublishAgent`, `canPublishWorkflow`, `canManageToolCapabilities` — `packages/domain/src/projects/authorization.ts:3-48`), called directly from the application/use-case layer (e.g. `packages/application/src/projects/add-member.ts:22-24`). There is no `PERMISSION`/`ROLE_PERMISSION` table anywhere. Sprint 15's/16's "real ABAC" (`packages/policy/src/evaluator/policy-evaluation.ts:33-42,72-82`) is a separate axis entirely — it evaluates `agentId`/`workflowId`/`riskClass` conditions for tool-invocation policy decisions (ALLOW/DENY/REQUIRE_APPROVAL), and never touches org/project membership or role. The proposed `ACCESS_ROLE`/`PERMISSION`/`ROLE_PERMISSION` catalogue is a real, new, data-driven layer that replaces the hardcoded functions — not the ABAC engine, which stays untouched throughout this epic.

### 2.4 Sprint 39's organisation-level membership is the foundation for organisation owner/admin, not a casualty of it

Sprint 39 (DEVOS-254/255) already added organisation-scoped membership rows (`memberships` with `project_id: null`), with the same `OWNER`/`MEMBER` roles one scope up, plus UI on `OrganisationsPage.tsx`. **Resolved (§9.2/§9.3):** with Division folded into Organisation, the source document's "division owner (one, transferable) vs. division admins (many, co-equal)" distinction now applies here. Existing org-level `OWNER` rows become the co-admin pool; a new `organisations.owner_principal_id` column adds the single transferable owner the source document's model requires but Sprint 39 never had. Existing org-level `MEMBER` rows (no admin rights) are dropped — they have no access on their own once effective project access is computed by rule (§9.3), matching the source document's own "no match = no access" default.

### 2.5 Work items have no assignee field of any kind today

`WorkItem` (`packages/domain/src/work-items/work-item.ts:3-17`) has no `assigneeId`/`reviewerId`/`approverId` and no `parent_id` column (absent from both `0004_work_items.ts` and `0013_work_items_add_metadata.ts`). Today, any project member can edit any work item — there is no work-item-scoped restriction at all in the current authorization functions. The `WORK_ITEM_ASSIGNMENT` table and its "edit only if ASSIGNEE" rule narrows current behavior. **Resolved (§9.6):** every existing work item is backfilled with its own `reporter_id` as its initial `ASSIGNEE` before the restriction takes effect, so nothing already in flight becomes suddenly uneditable.

### 2.6 Auth is already provider-agnostic; USER_IDENTITY's multi-provider table does not exist

`packages/identity/src/authentication/` has `createLocalAuthProvider` (dev-only) and `createOidcAuthProvider` (`oidc-provider.ts:67-103`) — a real, generic OIDC/JWKS verifier that already works against any OIDC issuer, including Entra ID or Google, without a branded per-provider implementation. SSO itself is already structurally supported; what's missing is a `USER_IDENTITY` table letting one human hold multiple login methods and recording which provider a given login came from.

### 2.7 What's already effectively satisfied — no new work needed

`audit_records` (`0012_audit_records.ts:8-21`) already has `correlation_id` (line 19, indexed at line 44) and generic `actor_type`/`actor_id` columns — the proposed `AUDIT_LOG` table is, on inspection, **already substantially built**. Disclosed here explicitly rather than scoping a redundant new table.

### 2.8 The proposal's own internal numbers check out

Independently recounted, not assumed: the entity-relationship section names exactly **19 tables** and the permission catalogue lists exactly **17 permissions** — both match the document's own stated counts.

### 2.9 Naming: DevOS, not AEOS; UK spelling throughout

**Resolved (§9.1):** the source document's one "AEOS" reference is a copy-paste artifact — treated as DevOS everywhere in this plan. **Resolved (§9.8):** all new tables use this codebase's existing UK spelling convention (`organisation`, not `organization`), matching every existing table and identifier (`0001_organisations.ts:8`).

---

## 3. Delivery Principles (carried forward, prior epic backlogs' own §3)

- Every sprint is independently, really verified against a real running system before being marked complete — not asserted from code review alone.
- Nothing is hard-deleted; the source document's own "archive, deactivate, soft-remove" rule matches this codebase's existing convention exactly (`removed_at`, `revoked_at`, archived status columns already used throughout).
- Backward-incompatible behavior changes (§2.4, §2.5) are backfilled before they take effect, never shipped as a silent regression.
- No sprint in this epic touches the separate ABAC/tool-invocation policy engine (§2.3) — that axis is confirmed unrelated and stays untouched throughout.
- No sprint gives an agent a login, a bearer credential, or any new autonomous-execution capability (§2.2, §9.7) — agent identity is for attribution and ownership only.

## 4. What NOT to Build in This Epic

- No `DIVISION`/`DIVISION_MEMBER` tables or any third scope tier — resolved as unnecessary; Organisation already is the tenant/install boundary (§2.1, §9.2).
- No `AGENT_CREDENTIAL` table, no agent authentication/login path, no agent-presented bearer token of any kind — agents act exclusively through the existing internal workflow/task-handler execution path when assigned work; `AGENT_PROFILE` is attribution/ownership metadata only (§2.2, §9.7).
- No change to `packages/policy`'s ABAC condition engine or the `ALLOW`/`DENY`/`REQUIRE_APPROVAL` tool-invocation decision path — confirmed unrelated (§2.3).
- No change to the existing `agents`/`agent_versions` versioning/marketplace model (Sprints 22/23/37) — `AGENT_PROFILE` sits alongside it as one profile per named agent (§9.4), not a replacement of agent version history.
- No new `AUDIT_LOG` table — `audit_records` already satisfies it (§2.7); at most a disclosure/verification task.
- No SSO admin console or per-organisation Entra/Google tenant configuration UI — the underlying OIDC provider is already generic; per-org SSO configuration (if wanted) is a separate, unscoped ops feature, not named by the source document's data model.

---

## 5. Epic Map

The real dependency order is staged so every intermediate sprint leaves the system in a fully working, backward-compatible state, per `AGENTS.md` §4.1's one-step-at-a-time discipline.

| Sprint | Outcome | Depends on |
| --- | --- | --- |
| 46 — Principal & Human Identity Foundation | Every human gets a real `PRINCIPAL`/`HUMAN_PROFILE`/`USER_IDENTITY` row; zero visible behavior change | — |
| 47 — Access Role Catalogue & Organisation Owner/Admin | `ACCESS_ROLE`/`PERMISSION`/`ROLE_PERMISSION` replace the hardcoded `OWNER`/`MEMBER` functions; a transferable `owner_principal_id` plus co-admins added at organisation scope, reusing Sprint 39's membership rows; `effective_project_access` view | 46 |
| 48 — Agent Principal & Attribution | Agents become real principals (`AGENT_PROFILE`) with an accountable human owner — identity only, no credentials, no login | 46, 47 |
| 49 — Job Role Catalogue | `JOB_ROLE`/`PRINCIPAL_JOB_ROLE`/`PROJECT_MEMBER_JOB_ROLE`, kept explicitly distinct from the existing agent workflow-role dispatch key | 46, 48 |
| 50 — Work Item Assignment & Hierarchy | `WORK_ITEM_ASSIGNMENT` (assignee/reviewer/approver), `parent_id`, backfilled before the new edit restriction takes effect | 46, 47 |
| 51 — Reconciliation, Full-Epic Re-Audit & Close-Out | `AUDIT_LOG` disclosure, full-model re-audit (mirrors Sprint 44's precedent), final validation | all above |

## 6. Product Backlog

### 6.1 Sprint 46 — Principal & Human Identity Foundation (DEVOS-284–287)

| ID | Story | Acceptance summary |
| --- | --- | --- |
| DEVOS-284 | `PRINCIPAL` + `HUMAN_PROFILE` tables, human backfill | New tables; one `PRINCIPAL`+`HUMAN_PROFILE` row backfilled for every distinct human actor-id currently referenced by `memberships`/`audit_records`, keyed by email where resolvable. Zero change to any existing route's behavior. |
| DEVOS-285 | `USER_IDENTITY` wired to the existing OIDC provider | New table records `(provider, provider_subject)` per login; the existing generic `createOidcAuthProvider` path populates/looks up `USER_IDENTITY` on login without behavior change to authentication itself. |
| DEVOS-286 | `memberships.principal_id` resolves through real `PRINCIPAL` rows | Existing authorization/lookup code paths resolve a human actor through the new `PRINCIPAL` row instead of a bare string, with identical results on every existing test — a resolution-path change, not a behavior change. |
| DEVOS-287 | Validation, documentation, and gap disclosure | Full monorepo validation green; explicit written confirmation that no existing route's authorization outcome changed. |

### 6.2 Sprint 47 — Access Role Catalogue & Organisation Owner/Admin (DEVOS-288–294)

| ID | Story | Acceptance summary |
| --- | --- | --- |
| DEVOS-288 | `ACCESS_ROLE`/`PERMISSION`/`ROLE_PERMISSION` tables, seeded | Seeded with exactly today's `OWNER`/`MEMBER` as two `PROJECT`-scope access roles, and a permission set that reproduces every existing `canX()` function's current grant exactly. |
| DEVOS-289 | Replace hardcoded `canX()` checks with catalogue lookups | `packages/domain/src/projects/authorization.ts`'s functions become catalogue-driven; every existing authorization test passes unmodified, proving zero behavior change. |
| DEVOS-290 | `organisations.owner_principal_id` + `ORGANISATION_ADMIN` access role, reusing Sprint 39's membership rows | Existing org-level `OWNER`-role `memberships` rows migrate to the new `ORGANISATION_ADMIN` access role (the co-admin pool); one of them (or a caller-supplied principal) is set as the single transferable `owner_principal_id`, transferable only by the current owner. Existing org-level `MEMBER`-role rows are dropped per §9.3 — disclosed, not silently deleted without record. |
| DEVOS-291 | `effective_project_access` view | The source document's view, with its "division admin"/"division owner" `UNION` branches applied at organisation scope instead: an `ORGANISATION_ADMIN` or the organisation's `owner_principal_id` resolves computed access to every project in that organisation without an explicit `PROJECT_MEMBER` row, per the source document's Option B rule. |
| DEVOS-292 | Wire the view into project-list/authorization middleware | Confirmed identical results to today's direct `memberships` query for every existing project member; organisation admins/owner now additionally see every project in their organisation, matching the new rule. |
| DEVOS-293 | Minimal organisation admin UI (list, add/remove co-admin, transfer ownership) | Extends the existing `OrganisationsPage.tsx` membership UI with the new owner/co-admin distinction. |
| DEVOS-294 | Validation, documentation, and gap disclosure | Full monorepo validation green; live-verified organisation-admin/owner project access against real Postgres. |

### 6.3 Sprint 48 — Agent Principal & Attribution (DEVOS-295–298)

| ID | Story | Acceptance summary |
| --- | --- | --- |
| DEVOS-295 | `AGENT_PROFILE` + `PRINCIPAL` row per named agent | One principal per `agents` row (per §9.4), shared across that agent's own `agent_versions` history — publishing a new version is a config change, not a new identity. |
| DEVOS-296 | `accountable_owner_id` backfill | Every existing agent resolves a real, active human owner where possible; any agent whose `created_by` does not resolve to one is flagged in this task's own disclosure, not silently defaulted. |
| DEVOS-297 | Agent actions attributed to their own principal — no credential, no login | The existing internal workflow/task-handler execution path (the only way an agent ever acts, per §9.7) records the agent's own `PRINCIPAL` id in `audit_records`/`created_by` fields instead of the triggering human's or run's id. Explicitly, no `AGENT_CREDENTIAL` table, no bearer token, no authentication path is added — confirmed as a deliberate exclusion in this task's own acceptance evidence, not an oversight. |
| DEVOS-298 | Validation, documentation, and gap disclosure | Full monorepo validation green; live-verified that a real agent-run action appears in `audit_records` under its own principal id, not a human's, with zero new authentication surface introduced. |

### 6.4 Sprint 49 — Job Role Catalogue (DEVOS-299–302)

| ID | Story | Acceptance summary |
| --- | --- | --- |
| DEVOS-299 | `JOB_ROLE`/`PRINCIPAL_JOB_ROLE` tables, seeded catalogue | Seeded per-organisation with PO/BA/DEV/QA (or the org-defined equivalent). UI/API language always says "job role," never bare "role," per §9.5 — the existing agent workflow-role dispatch key (`DISCOVERY`/`REQUIREMENTS`/`TECHNICAL_DESIGN`/`PLANNING`/`DEVELOPMENT`/`REVIEW`) is untouched and unrenamed. |
| DEVOS-300 | `PROJECT_MEMBER_JOB_ROLE` (per-project subset) | FK-constrained to only job roles the principal already holds, matching the source document's rule exactly (a Dev+BA can act only as Dev on a project that only assigned them the Dev job role). |
| DEVOS-301 | UI: assign job roles to a principal; per-project subset picker | Mirrors existing membership-management UI conventions. |
| DEVOS-302 | Validation, documentation, and gap disclosure | Full monorepo validation green. |

### 6.5 Sprint 50 — Work Item Assignment & Hierarchy (DEVOS-303–307)

| ID | Story | Acceptance summary |
| --- | --- | --- |
| DEVOS-303 | `work_items.parent_id` (same-project FK) | Self-referencing, constrained to the same `project_id`, matching the source document's rule. |
| DEVOS-304 | `WORK_ITEM_ASSIGNMENT` table (ASSIGNEE/REVIEWER/APPROVER) | Many rows per item, per the source document's schema. |
| DEVOS-305 | Backfill `ASSIGNEE = reporter_id`, then narrow `workitem.edit`/`workitem.transition` to assignment-gated | Per §9.6: every existing work item gets its own reporter as an initial `ASSIGNEE` row *before* the edit restriction goes live, so no currently-editable item becomes uneditable the moment this ships. Edit stays `ASSIGNEE`-only; transition allows `ASSIGNEE`/`REVIEWER`/`APPROVER`, matching the source document's rule. |
| DEVOS-306 | UI: assignment pickers on the work item detail view | Extends the existing `WorkItemsPage.tsx`/detail-view pattern (Sprint 31/34's precedent). |
| DEVOS-307 | Validation, documentation, and gap disclosure | Full monorepo validation green; live-verified assignee/reviewer/approver edit and transition rules against real data, including a real pre-existing work item confirmed still editable post-backfill. |

### 6.6 Sprint 51 — Reconciliation, Full-Epic Re-Audit & Close-Out (DEVOS-308–310)

| ID | Story | Acceptance summary |
| --- | --- | --- |
| DEVOS-308 | `AUDIT_LOG` reconciliation | Written confirmation that `audit_records` (§2.7) satisfies the source document's `AUDIT_LOG` table as-is, or the specific, narrow delta if one is found — not a new table by default. |
| DEVOS-309 | Full-epic re-audit | Mirrors Sprint 44's own precedent: every one of the ~105 existing routes re-confirmed to authorize correctly under the new model; every one of the source document's tables/permissions confirmed built and enforced under this epic's resolved scope (§9), or explicitly disclosed as deferred (`DIVISION`, `AGENT_CREDENTIAL` — deliberately never built, per §4). |
| DEVOS-310 | Final validation, documentation, and gap disclosure | Full monorepo `pnpm turbo run typecheck lint test build` and the full real `tests/e2e` suite green; a single written closing disclosure of anything from this epic left deliberately out of scope. |

---

## 7. Dependencies

- Sprints 46 → 47 are strictly sequential — 47's organisation-admin/owner work and catalogue-driven checks need real `PRINCIPAL` rows to point at.
- Sprint 48 (agents) depends on 46 (principal concept) and 47 (access-role scoping), not on 49/50.
- Sprint 49 (job roles) depends on 46 and 48, since job roles can be held by either humans or agents.
- Sprint 50 (work items) depends on 46 and 47 for principal/access-role resolution, not on 48/49.
- Sprint 51 depends on all prior sprints in this epic.

## 8. Definition of Done

- Every acceptance summary in §6 independently, really verified against a real running system and real Postgres data — not asserted from code review alone.
- Full monorepo validation stays green after every sprint, including a full re-run of existing authorization tests to prove no silent behavior change at each behavior-preserving stage (46–47).
- `DEVOS-BUILD-STATE.md`/`DEVOS-ROADMAP.md` are updated only on the user's explicit approval of each step, per `AGENTS.md` §18/§19 — this document does not authorize touching either.

---

## 9. Decisions

All nine open decisions from v1.0 have been resolved by the user. Recorded here, per `AGENTS.md` §28 (auditability) — preserved as history, not deleted, even though resolved.

1. **"AEOS" vs "DevOS."** Resolved: copy-paste artifact — treat as DevOS throughout (§2.9).
2. **Division backfill strategy.** Resolved, and it changed the shape of the whole plan: **there is no Division tier.** Each organisation is its own install/tenant, so Organisation and Division are the same thing here — "Division" in the source document is replaced by "Organisation" everywhere in this plan (§2.1, §2.4, §5).
3. **Sprint 39's organisation-level `MEMBER` rows.** Resolved: drop the concept. A plain org member with no admin role and no project membership gets no access under the new model — they need an explicit project membership (or the organisation-admin/owner role from §9.2) to see anything (§2.4, DEVOS-290).
4. **Agent-to-principal mapping granularity.** Resolved as a disclosed assumption, not a direct answer: since agents never authenticate (§9.7 removed the credential/security stakes from this question), one `PRINCIPAL` per named `agents` row, shared across its own `agent_versions` history, is used for attribution/ownership purposes (DEVOS-295). Flagged here in case this assumption should instead have been asked as its own question.
5. **Job role vs. the existing agent workflow-role dispatch key.** Resolved: keep them explicitly distinct. No renaming of the existing dispatch mechanism; `JOB_ROLE` UI/API language always says "job role" (§6.4).
6. **Work item edit/transition narrowing.** Resolved: backfill every existing work item's `ASSIGNEE` to its own `reporter_id` before the restriction takes effect (§2.5, DEVOS-305).
7. **Agent credential trust boundary.** Resolved, and it removed an entire story pair from the plan: **agents never authenticate.** They run autonomously off workflow assignment only, through the existing internal execution path — no `AGENT_CREDENTIAL` table, no login, no bearer token presented as an agent. `AGENT_PROFILE` is attribution/ownership metadata only (§2.2, §4, DEVOS-297).
8. **UK vs. US spelling.** Resolved: UK spelling throughout, matching the existing codebase (§2.9).
9. **Overall epic/sprint shape.** Originally approved as the 7-sprint shape proposed in v1.0 — but decisions 2 and 7 above structurally changed that shape (removed the Division sprint's tables, removed two agent-credential stories), so the plan actually delivered is the revised 6-sprint, 27-task shape in §5–6, not the literal v1.0 proposal. Flagged here rather than silently treating the original "approve as proposed" answer as covering a shape it was given before those two changes existed.

Per `AGENTS.md` §35/§4.2, this document's decisions being resolved does **not** itself authorize conversion to `specs/sprints/sprint-46/` or any implementation — that is a separate, explicit approval, still pending.
