# DEVOS-336 — Validation, documentation, and gap disclosure

**Priority:** P1
**Depends on:** DEVOS-333, DEVOS-334, DEVOS-335.
**Depended on by:** Sprint 59 (needs Sprint 58 genuinely closed before server-side enforcement has something real to enforce).

## Scope

Full monorepo validation, live verification against real Postgres, and an explicit written confirmation of exactly what this sprint added (a new, read-only, computed status) versus what stayed identical (every existing route, use case, and authorization outcome — this sprint introduces no new migration and no new writer) — matching Sprint 56/57's own precedent for a sprint's closing task.

## Implementation

Run `pnpm turbo run typecheck lint test build --filter='!@devos/e2e-tests'` and confirm the result matches this sprint's pre-sprint baseline (Sprint 57's own 76/76 count) plus this sprint's new tests, with zero regressions. Run the full real `tests/e2e` suite and confirm it stays at its existing baseline (this sprint adds a new read-only route nothing in `tests/e2e` yet calls, and changes no existing route's behavior).

Live-verify against real Postgres: as a real principal who is a member of a real organisation, confirm `GET .../initialisation-status` reports all three requirements `false` and `initialised: false` for a freshly created organisation; create a `Project` and confirm `hasProjectType` flips to `true` (the other two stay `false`); create an `organisation_llm_providers` row and confirm `hasLlmProvider` flips; create a real organisation-wide `Policy` via the already-existing `createOrganisationPolicy` route and confirm `hasPolicy` flips and `initialised` becomes `true` only at that point; confirm a non-member of the organisation is rejected from the same route.

Written disclosure: state plainly that this sprint changed zero existing route/use case behavior — it added one new, additive, read-only capability.

## Out of scope

Anything Sprint 59 (enforcement) or Sprint 60 (guided UI, full-epic pilot) own.

## Acceptance

Full validation green as described above. Live verification evidence recorded here once run. Written confirmation of exactly what was added and that nothing existing changed.

## Real bugs found

None in production code. Two mistakes were caught and fixed in this sprint's own new test code before it was considered done — disclosed here per `AGENTS.md` §7 rather than silently corrected: (a) the new `apps/api` route test initially asserted `201` on every creation response; this codebase's routes uniformly return `200` on success (confirmed by every pre-existing route test in `app.test.ts`), so the assertions were corrected to `200`; (b) the same test initially posted an empty `definition: {}` object when creating the organisation-wide policy, which `createOrganisationPolicy` correctly rejects (`ValidationError: "definition must not be empty."`, a pre-existing, working validation rule, not a defect) — corrected to a non-empty `definition`.

## Validation

Package-scoped, run in dependency order (`typecheck` → `test` → `lint` → `build`, per `AGENTS.md` §16):

- `pnpm --filter @devos/domain build` — clean, unchanged (this sprint introduces no domain-layer type changes — `Organisation`, `Project`, `OrganisationLlmProvider`, and `Policy` are all read, none modified).
- `pnpm --filter @devos/database typecheck lint test build` — clean, unchanged (no new migration, no new repository — this sprint's new use case composes three already-existing `listForOrganisation` methods with no database-layer code change).
- `pnpm --filter @devos/application typecheck lint test build` — clean, **435/435 tests** (427 pre-existing — Sprint 57's own closing count, none modified — plus 8 new: `getOrganisationInitialisationStatus`'s own describe block covering all-false/incremental-per-requirement/derived-`initialised`-only-once-all-three/cross-organisation-isolation/non-member-rejected/nonexistent-organisation-rejected).
- `pnpm --filter @devos/api typecheck lint test build` — clean, **126/126 tests** (125 pre-existing, unchanged, proving zero regression + 1 new: the full incremental-completion route test, exercising all three requirements and the non-member rejection through real HTTP request/response shapes against the new route).
- `pnpm --filter @devos/web typecheck lint build` — clean, unchanged (no web-layer change — this sprint's new route is deliberately not surfaced in any UI yet, per its own scope boundary; Sprint 60 owns the guided wizard).

Full monorepo: `pnpm turbo run typecheck lint test build --filter='!@devos/e2e-tests'` — **76/76 tasks successful**, zero failures — the same total task count as Sprint 57's own baseline (package boundaries unchanged). The pre-existing `access-control` "Failed to load access control catalogue" stderr noise during `@devos/api#test` is the same unrelated, disclosed noise Sprint 56/57's own closing tasks already recorded — present before this sprint and unrelated to it.

**Full e2e suite**: `pnpm --filter @devos/e2e-tests test` — **28 files / 54 tests, all green** — Sprint 57's own unchanged baseline count, confirmed rather than assumed. This sprint touches zero files under `tests/e2e/` and adds a route nothing there yet calls.

## Real end-to-end proof (this task's own required scope)

**Live verification against real Postgres** (`docker-postgres-1`), started the real `apps/api` server (`node apps/api/dist/main.js`) against real Postgres with `DEVOS_BOOTSTRAP_PLATFORM_OPERATOR_SUBJECT=sprint58-bootstrap-operator`:

1. Bootstrapped the platform operator via one authenticated `GET /me` request (Sprint 56's own mechanism, unchanged) — confirmed exactly one `platform_operators` row.
2. Issued a real registration token (`POST /registration-tokens`, Sprint 57's own mechanism, unchanged).
3. Created a real organisation (`POST /organisations` with the real token, as principal `sprint58-alice`) — confirmed `ownerPrincipalId` set correctly (Sprint 57's mechanism, unchanged).
4. `GET .../initialisation-status` on the freshly created organisation returned `{ hasProjectType: false, hasLlmProvider: false, hasPolicy: false, initialised: false }` — exactly as expected for a genuinely empty organisation.
5. Confirmed a non-member (`sprint58-mallory`) hitting the same route received `404 DEVOS_NOT_FOUND "Organisation not found."` — the masked-404 authorization check working correctly against a real HTTP request.
6. Created a real `Project` (`POST /projects`) — `GET .../initialisation-status` immediately reported `hasProjectType: true`, the other two still `false`.
7. Created a real `organisation_llm_providers` row (`POST /organisations/:id/llm-providers`) — status immediately reported `hasLlmProvider: true` in addition, still `initialised: false`.
8. Created a real organisation-wide `Policy` (`POST /organisations/:id/policies`, DEVOS-139's pre-existing mechanism, confirmed working unchanged — the DEVOS-335 verification) — status immediately reported `hasPolicy: true` **and, only at this exact point, `initialised: true`** — the genuine, live-verified three-requirement flip this sprint exists to prove.
9. **Zero-regression proof**: `GET /organisations/:id` (pre-existing, Sprint 47) and `GET /platform-operators` (Sprint 56, completely unrelated) were both hit on the same live server afterward and returned exactly their pre-existing shapes — confirming this sprint changed nothing about either.
10. **Cleanup proof**: every row this verification created was deleted directly against real Postgres, bottom-up through the real foreign-key graph (`audit_records` → `workflow_versions`/`workflow_definitions` → `agent_versions`/`agent_profiles`/`agents` → `memberships` → `policies`/`organisation_llm_providers` → `projects` → `registration_tokens` → `organisations` → `platform_operators` → `human_profiles` → `principals`). Disclosed honestly: the first two cleanup attempts used a single multi-statement `psql -c` call each, and PostgreSQL's simple-query protocol rolled the *entire* batch back when a later statement in the same call hit an unanticipated foreign-key constraint (`workflow_definitions`/`agents`/`work_items` clones created by `createProjectWithClones` when the test `Project` was created, and `human_profiles` rows referencing `principals`) — meaning the first two "successful-looking" `DELETE n` results were silently undone. Caught by re-querying row counts after each attempt rather than trusting the reported `DELETE n` lines; fixed by re-running every delete as its own isolated statement in dependency order. Final `SELECT count(*)` confirmed zero residue across `organisations`, `platform_operators`, `registration_tokens`, and every `sprint58-*` principal/human-profile row. The server process was located by port (`netstat`) and force-stopped; a follow-up request confirmed the port was no longer listening.

## Written confirmation: exactly what was added, and exactly what stayed the same

**What was added** — one new, read-only, additive capability, nothing more:

- `GET /organisations/:organisationId/initialisation-status` — a new route, gated to any member of the organisation (masked 404 for a non-member or nonexistent organisation, mirroring `getOrganisationForPrincipal`'s own established pattern), returning `{ organisationId, hasProjectType, hasLlmProvider, hasPolicy, initialised }`, all four computed live from `projects`/`organisation_llm_providers`/`policies`, with no new migration and no new stored value anywhere (per this sprint's own disclosed persistence-shape decision, `specs/sprints/sprint-58/README.md`).

**What stayed completely unchanged**:

- `Organisation.status` — untouched, still a bare string, still only ever set to `'ACTIVE'` by `createOrganisation`.
- `createOrganisation`, `createProject`, `createOrganisationLlmProvider`, `createOrganisationPolicy` — every one of these existing use cases is called by this sprint's own live verification exactly as before, with zero code change to any of them (live-verified in steps 3, 6, 7, 8 above).
- Every other existing route — `GET /organisations/:id` (Sprint 47) and `GET /platform-operators` (Sprint 56) both proven unaffected live in step 9 above; no file in this sprint touched any pre-existing route, use case, migration, or authorization outcome outside the three brand-new files (`get-organisation-initialisation-status.ts`, `organisation-initialisation.ts`, and this sprint's additive edits to `deps.ts`/`index.ts`/`app.ts`).
- No new migration was written or run — `packages/database/migrations/` still tops out at `0061_registration_tokens.ts` (Sprint 57's own last migration).

## Gap disclosure

- **DEVOS-335's backlog premise was stale, not merely imprecise.** The backlog framed organisation-wide policy creation as new construction; it was already fully built (DEVOS-139, predating this epic) end-to-end — application use case, API route, and web UI (`PolicyAuthoringForm`'s "This project's organisation" scope). Disclosed prominently in the sprint README rather than silently reflected only here, per `AGENTS.md` §7 and mirroring Sprint 57/`DEVOS-332.md`'s own precedent for correcting an earlier, unverified assumption.
- **The persistence-shape decision deliberately does not match either option the backlog named.** Neither a widened `Organisation.status` nor a new dedicated tracking table was built; `INITIALISED` and its three requirements are computed live from three already-real tables on every read. Full reasoning in the sprint README's own "⚠ Disclosed decision" section. This is a real, load-bearing design choice, not an oversight — a future implementer should not assume a `organisation_initialisation_status`-shaped table exists anywhere, because it does not.
- **Sprint 59 (not this sprint's scope) will pay a small, disclosed forward cost for this decision.** Its own server-side enforcement guard will need to call this sprint's new read (three lightweight indexed queries via `listForOrganisation`) on every mutating request, rather than branching on one cached column. Not measured as a real problem today, and not a reason to have built caching prematurely per `AGENTS.md` §8 — flagged here so Sprint 59's own implementer isn't surprised by the absence of a cached value.
- **No `AuditRecord` is written for reading initialisation status**, by design — this is a pure read with no state change, consistent with every other read-only route in this codebase (`getOrganisationForPrincipal`, policy listing, etc.) never writing an audit record either.
- **This sprint's own live-verification cleanup revealed a real, disclosed operational gotcha** (not a production bug): a project created through the real `createProject` use case clones several rows (`workflow_definitions`/`workflow_versions`, `agents`/`agent_versions`/`agent_profiles`) via `createProjectWithClones` — a fact any future sprint's own live verification involving a freshly created `Project` should account for when planning its own cleanup, since a naive single-batch multi-statement cleanup script can silently roll back entirely on the first unexpected foreign-key hit (see the "Real end-to-end proof" section above for the exact dependency order that worked).
- The pre-existing, cross-cutting "access control catalogue fails to load against a fake/null test database" stderr noise (present in every `@devos/api` test run, unrelated to any sprint's own code) remains unrelated and untouched.

Per the user's own established governance (`AGENTS.md` §4.1/§4.2/§19), Sprint 58 (Mandatory Initialisation Requirements) is implemented and fully validated. Marking it COMPLETE in `DEVOS-ROADMAP.md`/`DEVOS-BUILD-STATE.md` requires the user's own separate, explicit approval per `AGENTS.md` §19/§31 — not assumed here. Converting or starting Sprint 59 (Server-Side Enforcement) likewise requires the user's own separate, explicit authorization, per `AGENTS.md` §4.1/§35, neither of which has been given yet.
