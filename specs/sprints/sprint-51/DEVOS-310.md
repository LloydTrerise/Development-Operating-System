# DEVOS-310 — Final validation, documentation, and gap disclosure

**Priority:** P0
**Acceptance summary (from backlog §6.6):** Full monorepo `pnpm turbo run typecheck lint test build` and the full real `tests/e2e` suite green; a single written closing disclosure of anything from this epic left deliberately out of scope.

## Validation

Full monorepo validation, forced/uncached, re-run after DEVOS-309's fix:

```
pnpm turbo run typecheck lint test build --filter='!@devos/e2e-tests' --force
```

**76/76 tasks successful** — matching Sprint 50's own baseline exactly. `@devos/application:test` now shows **380/380 tests green** (up from 377 — the 3 new tests DEVOS-309's fix added). `@devos/api:test` **115/115 tests green**, unaffected (its own stderr "Failed to load access control catalogue" lines are the pre-existing, expected fallback-to-default-catalogue path when no real Postgres is wired into that particular unit-test harness — not a new or existing failure).

The full real `tests/e2e` suite, against real Postgres/Redis/Vault:

```
pnpm --filter @devos/e2e-tests test
```

**27/27 files, 52/52 tests green** — matching Sprint 50's own baseline exactly, zero regression from DEVOS-309's fix.

`prettier --check` was run against every file this sprint touched (7 `.ts` source/test files, 4 `.md` spec files); the 3 markdown spec files needed `--write` (now clean), the 7 `.ts` files were already clean. The repository's own pre-existing, unrelated ~900-file CRLF/formatting drift was left untouched, per this task's own narrow scope.

No stray `apps/api`/`apps/worker` processes were left running at any point — confirmed via `Get-CimInstance Win32_Process -Filter "Name='node.exe'"` before and after both the live-verification server and the `tests/e2e` run.

## Epic closing disclosure

**Candidate Epic E29 (Identity & Access Control Redesign), Sprints 46–51, is now COMPLETE.** This is the epic's single required closing disclosure of everything deliberately left out of scope, gathered in one place rather than scattered across six sprints' own individual disclosures:

### Deliberately never built (per §4, resolved decisions §9.2/§9.7 — not gaps, explicit exclusions)

- **`DIVISION`/`DIVISION_MEMBER`** — Organisation and Division were resolved to be the same tier (§9.2); no third scope tier exists or was ever intended to.
- **`AGENT_CREDENTIAL`** — agents never authenticate; they act exclusively through the existing internal workflow/task-handler execution path (§9.7). No agent bearer token, login, or credential-revocation mechanism exists anywhere in this codebase.
- **A new `AUDIT_LOG` table** — `audit_records` already satisfies it (DEVOS-308), with two narrow, disclosed deltas (`actor_id` is an unconstrained `text` column rather than a real FK; `metadata` is free-form rather than a structured before/after pair).
- **SSO admin console / per-organisation IdP configuration UI** — the underlying OIDC provider is already generic; this was never named as in-scope by the source document's own data model.

### Real, disclosed gaps against the source document's idealized model (named by no story in this epic; not fixed)

- **`workitem.comment`** — no comment capability exists anywhere on `WorkItem`, at any point in this codebase's history.
- **`workitem.delete`** — no delete capability exists anywhere on `WorkItem`; no archive-equivalent exists for work items either (unlike `Project`, which has one via its `status` field).
- **`agent.manage`'s "org admin or accountable owner" gate** — Sprint 48 deliberately built `AGENT_PROFILE`/`accountable_owner_id` as attribution/ownership metadata only; no authorization check anywhere consults it. Agent create/configure remains open to any resolved project member; publish remains `OWNER`-gated, unchanged.
- **`addMember`/`addOrganisationMember` never verify the target already has standing in the organisation** before granting project membership — predates this epic entirely.
- **`ProjectType`/`ProjectTypeAgent`/`ProjectTypeWorkflow` management is entirely ungated** — a consistent, pre-existing architectural choice (global, cross-tenant template resources with no owning organisation/project), not a per-route inconsistency this epic introduced or was asked to close.
- **`project.create`/`organisation.create` are ungated by design** — "any authenticated principal may create one and becomes its owner" is this codebase's own longstanding, symmetric convention for both entity types, predating this epic.

### Fixed during this epic's own final reconciliation sprint

- The organisation-admin privilege-escalation bug (DEVOS-309) — a plain project `OWNER`, with zero organisation-level standing, could reach `ORGANISATION_ADMIN`-gated authority (including self-granting `ORGANISATION_ADMIN` itself) via a stale Sprint-39-era fallback that predated this epic's own formalization of the organisation-admin tier. Found, fixed, tested, and live-verified against real Postgres within this sprint — the one case in this epic's closing audit that rose to the level of "fix now," not "disclose and defer."

### What this epic did build and verify, end to end

Every human actor gets a real `PRINCIPAL`/`HUMAN_PROFILE` row (Sprint 46); a real, catalogue-driven `ACCESS_ROLE`/`PERMISSION`/`ROLE_PERMISSION` model replaces every hardcoded `canX()` function with zero behavior change, plus a real transferable organisation owner/co-admin tier with `effective_project_access` (Sprint 47); every named agent gets its own `PRINCIPAL`/`AGENT_PROFILE` for attribution, with a resolved accountable owner and zero new authentication surface (Sprint 48); a real, per-organisation job-role catalogue with a project-scoped active subset, enforced at the database layer via a composite FK (Sprint 49); work-item assignment (`ASSIGNEE`/`REVIEWER`/`APPROVER`) and same-project hierarchy with cycle detection, narrowing who may edit or transition a work item (Sprint 50); and this sprint's own reconciliation, closing a real, live privilege-escalation path the epic's own model was specifically built to prevent.

## Acceptance

Both validation gates green and matching the established baseline exactly; this document is the epic's required closing disclosure.
