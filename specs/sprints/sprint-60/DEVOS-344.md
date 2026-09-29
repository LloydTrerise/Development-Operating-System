# DEVOS-344 — Final validation, documentation, and closing disclosure

**Priority:** P1
**Depends on:** DEVOS-341, DEVOS-342, DEVOS-343.
**Depended on by:** Nothing — this is candidate Epic E31's own final task. No further sprint is scoped after this one anywhere in `specs/DEVOS-ORGANISATION-ONBOARDING-BACKLOG.md`.

## Scope

Full monorepo validation (including, unlike Sprints 56/58, the full real `tests/e2e` suite — this sprint changes real UI surfaces and this epic as a whole changed the entire mutating-route surface in Sprint 59), and a single written closing disclosure that covers not just this sprint but **the entire candidate Epic E31** (Sprints 56–60): what was built, what was deliberately left out of scope per the backlog's own §4, the disclosed bootstrap-mechanism assumption (§9), and every implementation-time decision made across all five sprints.

## Implementation

Run `pnpm turbo run typecheck lint test build --filter='!@devos/e2e-tests' --force` and confirm the result against Sprint 59's own 76/76 baseline plus this sprint's new tests, zero regressions. Run the full real `tests/e2e` suite (`pnpm --filter @devos/e2e-tests test`) and confirm it still matches the epic's own established 28/54 baseline (Sprint 59's own count) — inspect directly whether this sprint's UI-only changes touch any e2e-relevant behavior (they should not, since no server-side route or contract changes in this sprint) rather than assuming Sprint 59's own "several files needed updating" experience repeats here.

Write the closing disclosure (appended below, after implementation) covering, at minimum:

- What each of the five sprints (56–60) actually added, in one line each, cross-referencing `DEVOS-ROADMAP.md`'s own Delivery-roadmap one-line entries once those are updated.
- Every deliberate scope exclusion from backlog §4, confirmed still true at epic close (no DevOS-native credential store, `project.create` still ungated, E30's platform-default fallback unchanged, no general-purpose platform-operator console beyond grant/revoke + token issue/list/revoke, no join-existing-organisation token mechanism, pre-existing organisations backfilled rather than retroactively required to set up, no self-service platform-operator elevation).
- The disclosed bootstrap-mechanism assumption (backlog §9's first bullet, DEVOS-326) and its final, as-implemented shape.
- Every sprint's own already-disclosed decision, cross-referenced rather than re-explained: Sprint 58's live-computation persistence-shape decision; Sprint 59's exemption-field backfill decision and its own real dependency-order correction; this sprint's own direct-HTTP-pilot-not-browser-automation decision.
- A consolidated gap-disclosure list carrying forward every still-open item from Sprints 56–59's own closing tasks (`DEVOS-328.md`/`DEVOS-332.md`/`DEVOS-336.md`/`DEVOS-340.md`) that remains genuinely open at epic close, rather than re-deriving them from scratch.

## Out of scope

Updating `DEVOS-ROADMAP.md`/`DEVOS-BUILD-STATE.md` — per `AGENTS.md` §18/§19/§31, marking any sprint (including this one) or the epic itself COMPLETE requires the user's own separate, explicit approval, not assumed by this task's own validation passing.

## Acceptance

Full monorepo validation green, full real `tests/e2e` suite green (or any needed update disclosed and made), both recorded below with real evidence. The closing disclosure is written, explicit, and covers the whole epic, not only this sprint.

## Real bugs found

None. Every new component, client function, and wiring change (DEVOS-341/342) passed typecheck/lint/build clean on first implementation; the DEVOS-343 pilot's 9-step chain succeeded on its first run with no code fix required mid-run (only its own cleanup step needed live, forward discovery of the real FK chain a freshly created `Project`'s clone pipeline produces — an operational sequencing fact, not a defect, already disclosed once before in `specs/sprints/sprint-58/DEVOS-336.md`'s own gap disclosure and reconfirmed here in `DEVOS-343.md`'s own "Real end-to-end proof" section).

## Validation

Package-scoped (`@devos/web` is this sprint's only touched package):

- `pnpm --filter @devos/web typecheck lint build` — clean. No `@devos/web` unit-test suite exists in this codebase (unchanged from every prior sprint's own precedent — Sprint 59's own `DEVOS-340.md`: "no web-layer change... Sprint 60 owns the guided UI"; this sprint is that UI, and it remains typecheck/lint/build-verified, component-review-verified, and live-pilot-adjacent-verified rather than unit-tested, consistent with how every other `apps/web` feature in this repository has always been validated).
- `npx prettier --check` on every new/changed file — clean.

Full monorepo: `pnpm turbo run typecheck lint test build --filter='!@devos/e2e-tests' --force` — **76/76 tasks successful**, zero failures — the same total task count as Sprint 59's own baseline (no package added or removed this sprint). The pre-existing `access-control` "Failed to load access control catalogue" stderr noise during `@devos/api#test` is the same unrelated, disclosed noise every prior sprint in this epic has already recorded.

**Full e2e suite**: `pnpm --filter @devos/e2e-tests test` — **28 files / 54 tests, all green** — the epic's own established baseline (Sprint 58/59's own count), unchanged. Direct inspection (not assumption) confirms why no e2e file needed updating for this sprint, unlike Sprint 59's own experience: this sprint added no new server-side route, no new required request field, and no new rejection behavior — DEVOS-341/342 are `apps/web`-only presentation changes over already-existing, already-gated routes, and DEVOS-343's own pilot ran directly against the live server outside the `tests/e2e` suite entirely (per this sprint's own disclosed pilot-mechanism decision, see README). No existing e2e fixture organisation's behavior could regress from a change that touches no route.

## Real end-to-end proof (this task's own required scope)

Reuses DEVOS-343's own already-complete, already-recorded live proof in full (bootstrap → issue token → a second, previously-unaffiliated principal redeems it → blocked on a genuinely gated route → completes all three requirements → the same request now succeeds → an exempt route confirmed unaffected → full cleanup, zero residue) — this task adds no further live server interaction of its own, per its own scope (validation, documentation, and disclosure, not a second pilot).

## Written confirmation: what this sprint added, and what stayed the same

**What was added**:

- `CreateOrganisationWizard.tsx` — a two-step guided registration-token-then-organisation-details flow, replacing the placeholder flat form, with an explicit, visible "you will become this organisation's Admin" disclosure before submission.
- `OrganisationSetupChecklist.tsx` — a fourth per-row expand panel (alongside the pre-existing Members/AI Providers/Settings panels) surfacing Sprint 58's three real requirements with live status, each linking to its own real, pre-existing creation surface, plus a "Setup incomplete" chip visible on the row without needing to open the panel.
- One new API client function/DTO (`getOrganisationInitialisationStatus`), the first web-layer consumer of Sprint 58's read-only status route.
- A real, live, full-chain pilot (DEVOS-343) proving the whole epic end-to-end from a genuinely fresh bootstrap through a genuinely gated route being blocked and then unblocked.

**What stayed completely unchanged**: `createOrganisation`'s call signature and the registration-token gate (Sprint 57); the initialisation-status computation (Sprint 58); the enforcement guard and every one of the 47 gated / 3 exempt-setup / 12 exempt-unscoped routes' own disposition (Sprint 59); the platform-operator tier and its own management UI (Sprint 56). This sprint is presentation and proof over an already-complete, already-enforced mechanism — it does not re-open any of it.

## Whole-epic closing disclosure (candidate Epic E31, Sprints 56–60)

**What each sprint added** (one line each, cross-referencing `DEVOS-ROADMAP.md`'s own Delivery-roadmap entries once updated):

- **Sprint 56 — Platform Operator Foundation**: a new, principal-attached `platform_operators` grant, deploy-time-bootstrapped via a single new optional env var (`DEVOS_BOOTSTRAP_PLATFORM_OPERATOR_SUBJECT`), with grant/revoke management (API + `PlatformOperatorsPage.tsx`) — zero visible behavior change to any pre-existing route.
- **Sprint 57 — Registration Token & Invite-Gated Organisation Creation**: `registration_tokens` table; `createOrganisation` gated behind redeeming a valid, platform-operator-issued token — the disclosed, deliberate reversal of organisation-creation's previously ungated design; issue/list/revoke UI on the same platform-operator page.
- **Sprint 58 — Mandatory Initialisation Requirements**: a real, live-computed `INITIALISED` status (`hasProjectType`/`hasLlmProvider`/`hasPolicy`) derived from three already-real tables, computed fresh on every read rather than stored — a disclosed departure from both persistence shapes the backlog itself named; organisation-wide policy creation confirmed already fully built (a stale backlog premise, corrected).
- **Sprint 59 — Server-Side Enforcement**: a new guard (`requireOrganisationInitialised`) and a distinct `403 DEVOS_ORGANISATION_NOT_INITIALISED` error wired into 47 of the real 62 mutating routes; every pre-existing organisation backfilled to exempt via a new `Organisation.initialisationEnforcementExemptAt` field (migration `0062`) so nothing already in production broke; two real bugs found and fixed (a hardcoded-`null` repository field, one e2e fixture needing an explicit exemption flag).
- **Sprint 60 — Guided First-Run UI & Full-Epic Pilot** (this sprint): the guided token-redemption/organisation-creation wizard and mandatory-setup checklist replacing the epic's own placeholder UI; a real, live, full-chain pilot proving bootstrap → token → redemption-by-a-second-principal → blocked-then-unblocked gated mutation, end to end.

**Every deliberate scope exclusion (backlog §4), confirmed still true at epic close**:

- No DevOS-native password/credential store or login flow was built anywhere in this epic — `AuthProvider`/OIDC delegation is completely untouched; a registration token gates *organisation creation*, never authentication.
- `project.create` remains ungated by design, unchanged and unaffected by this epic's reversal of `organisation.create`'s own prior ungated design (Sprint 57) — confirmed at Sprint 59's own route-by-route audit and re-confirmed by this sprint's own pilot step 5 (`POST /projects` succeeded against a non-initialised organisation, as designed).
- E30's platform-default LLM fallback for a project/organisation with no configured provider is untouched — mandatory-at-initialisation is a new precondition for *becoming* `INITIALISED`, not a removal of that fallback afterward.
- No general-purpose platform-operator console beyond grant/revoke (Sprint 56) and issue/list/revoke registration tokens (Sprint 57) was built — confirmed by direct inspection of `PlatformOperatorsPage.tsx`, still exactly those two panels, nothing broader.
- No token-based invitation mechanism for *joining* an existing organisation was built — the pre-existing `addMember`/`addOrganisationMember` path (Sprint 39, E29) remains the only such mechanism, untouched.
- No pre-existing organisation was retroactively required to complete the new mandatory setup — Sprint 59's backfill (migration `0062`) exempts every organisation that existed before this epic's enforcement shipped, confirmed live against real, pre-existing production data (the real `DevOS Development` seed organisation, genuinely never fully set up, confirmed still mutable by its own admin in Sprint 59's own live proof).
- No self-service platform-operator elevation exists — every platform operator beyond the one disclosed bootstrap principal is granted by an existing operator via `POST /platform-operators`, with no request/approval workflow.

**The disclosed bootstrap-mechanism assumption (backlog §9) and its final, as-implemented shape**: the backlog flagged "a single deploy-time environment variable naming the bootstrap principal, auto-granted on their first authenticated request while zero platform operators exist" as the lowest-invention option, open to correction at Sprint 56 conversion. It was implemented exactly as flagged, with no correction raised at that time: `DEVOS_BOOTSTRAP_PLATFORM_OPERATOR_SUBJECT`, read once, `ensureBootstrapPlatformOperator` awaited (not fire-and-forget, a deliberate, disclosed deviation from the `ensureUserIdentityForLogin` precedent it otherwise mirrors — Sprint 56's own gap disclosure), live-verified across every one of Sprints 56/59/60's own pilots.

**Every sprint's own already-disclosed decision, cross-referenced rather than re-explained**:

- Sprint 57's unsalted-SHA-256 token hashing (deliberate, given 256 bits of real token entropy) and computed-not-persisted `EXPIRED` status — `specs/sprints/sprint-57/DEVOS-332.md`'s own gap disclosure.
- Sprint 58's live-computation persistence-shape decision (no `organisations.status` widening, no tracking table) — `specs/sprints/sprint-58/README.md`'s own "⚠ Disclosed decision" section.
- Sprint 59's exemption-field backfill decision and its own real dependency-order correction (DEVOS-338 must not ship ahead of DEVOS-339 in the same deploy) — `specs/sprints/sprint-59/README.md`'s own two "⚠ Disclosed decision"/"⚠ Disclosed correction" sections.
- This sprint's own direct-HTTP-pilot-not-browser-automation decision — `specs/sprints/sprint-60/README.md`'s own "⚠ Disclosed decision" section.

**Consolidated gap-disclosure list — every item from Sprints 56–59's own closing tasks that remains genuinely open at epic close** (cross-referenced, not re-derived):

- No `AuditRecord` exists for platform-operator grant/revoke — `AuditRecord.organisationId` is required and a platform operator has none by design (Sprint 56, `DEVOS-328.md`). Still open; unaffected by this sprint.
- No database transaction spans organisation creation and token redemption, nor the initialisation guard's own read and the gated handler's own write — both are accepted, disclosed races consistent with pre-existing patterns elsewhere in this codebase (Sprint 57 `DEVOS-332.md`; Sprint 59 `DEVOS-340.md`). Still open; unaffected by this sprint.
- `PolicyRepository`'s "configuration of an already-satisfied requirement" (e.g. disabling an organisation's only LLM provider, or publishing an already-created policy) is deliberately gated, not exempt — only the action that first satisfies a requirement is exempt (Sprint 59 `DEVOS-340.md`). Still the deliberate design; this sprint's checklist does not change it (a user who later disables their only LLM provider would see their organisation's own further mutations blocked again — an edge case never exercised by this epic's own pilots, disclosed here rather than silently assumed away).
- Real test-database residue from Sprint 59's own earlier, pre-fix debugging runs (two throwaway `Other Org …` rows) was disclosed as blocked-by-permission-controls, pending the user's own explicit confirmation to remove (Sprint 59 `DEVOS-340.md`). Still outstanding — this sprint neither touched nor removed it, and confirms it is unrelated to (and does not affect) anything this sprint built or verified.
- The pre-existing, cross-cutting "access control catalogue fails to load against a fake/null test database" stderr noise, present in every `@devos/api` test run since long before this epic, remains unrelated and untouched.
- **New to this sprint**: `OrganisationSetupChecklist`'s "Configure an AI provider" action opens this same row's own `AiProvidersPanel` rather than navigating anywhere — correct for the common case (both panels live on the same page/row), but it means a user who has scrolled the organisation list far enough that the row is off-screen gets no visible scroll-to behavior; a minor, disclosed UX rough edge, not a functional defect (the panel still opens; the user may need to scroll to see it).

Per the user's own established governance (`AGENTS.md` §4.1/§4.2/§19/§31), Sprint 60 (Guided First-Run UI & Full-Epic Pilot) is implemented and fully validated, and this closing disclosure covers candidate Epic E31 in full. Marking Sprint 60 and/or the whole epic COMPLETE in `DEVOS-ROADMAP.md`/`DEVOS-BUILD-STATE.md` requires the user's own separate, explicit approval — not assumed here. No further sprint is scoped anywhere in `specs/DEVOS-ORGANISATION-ONBOARDING-BACKLOG.md` beyond this one.
