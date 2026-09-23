# DEVOS-276 — Final documentation and disclosure of the one deliberately excluded gap

**Priority:** P1
**Acceptance summary (from backlog §6.17):** Explicit written record that real user identity, invite/suspend, and configurable role/permission management (§1/§2.4/§9) remains unbuilt by deliberate, user-confirmed decision — not oversight — and is a candidate future epic starting with identity/auth design.

## Disclosure

**Real user identity, invite/suspend, and configurable role/permission management was never built in E28, by deliberate, user-confirmed decision — not oversight, not an unfinished sprint, not a gap this epic's own audit (DEVOS-273) missed.**

This is restated here accurately from `specs/DEVOS-UI-UX-REDESIGN-BACKLOG.md` §9 (not paraphrased from memory, re-read in full for this task):

> **Real user identity, invite/suspend, and configurable role/permission management** (§1/§2.4). Deliberately excluded per explicit user decision: there is no `User` table, no credential verification, and no configurable role model anywhere in this codebase today — building this properly means designing real identity/auth, a security-critical undertaking larger than the rest of this epic combined, not UI/UX work. Named here as a candidate future epic that would need to start with identity/auth design, not silently built or silently dropped.

### What this means concretely, re-confirmed true as of Sprint 44 (nothing in Sprints 39–43 changed it)

- **No `User` table exists anywhere in the database.** `Principal` (`packages/identity/src/authentication/local-provider.ts`) is `{id, email?}`, derived by trusting any bearer token with **zero credential verification** — an explicitly disclosed local-dev stand-in, not a real authentication mechanism.
- **No configurable role or permission model exists.** Every authorization check in this codebase (`packages/domain/src/projects/authorization.ts`, and its organisation-level mirror added Sprint 39) is a hardcoded `role === 'OWNER'` literal — `OWNER`/`MEMBER` is the entire role vocabulary, fixed in code, not administrable.
- **No invite mechanism exists.** Every membership-add route built in this epic (project-level, pre-existing; organisation-level, Sprint 39's DEVOS-254) adds a member by a raw principal id typed into a text field — "No user directory exists — add by exact principal id," disclosed directly in the UI itself (`OrganisationsPage.tsx`'s `MembersPanel`, `ProjectDetailPage.tsx`'s equivalent). There is no lookup, no invitation, no acceptance flow, no email.
- **No suspend/deactivate mechanism exists** for a principal — only membership rows can be removed (`DELETE .../members/:userId`), which is not the same operation and carries none of the same guarantees (a removed member's already-issued bearer token, in this dev-identity model, is not revoked by anything — there is no session/token registry to revoke from).

### Why this was excluded rather than built

Per §1/§9's own reasoning, re-confirmed sound by this sprint's own re-audit: building real identity means designing real credential persistence and very likely redesigning the authorization boundary this entire codebase currently assumes (`role === 'OWNER'` literals scattered across every domain module, not centralized behind an interface a future permission system could swap in without touching every call site). That is a security-critical undertaking — larger, by the backlog's own explicit sizing in §2.4, "than the rest of this epic combined" — and is not properly scoped as UI/UX restyle-and-wire work, which is what every other story in Sprints 29–43 was.

### Status: candidate future epic, not scoped further here

This document does not scope, size, or design that future epic — doing so is explicitly out of DEVOS-276's own remit ("Any part of a future epic beyond this one," §9's own closing line). What can be said now, for whoever picks this up next: it would need to start with identity/auth design (a real `User`/credential model, a real session or token-verification mechanism, and a deliberately-designed — not organically-grown — permission model that the existing `role === 'OWNER'` checks could be migrated onto), not with any UI work, since there is currently no real backend primitive for a UI to wire onto at all — unlike every one of the five areas Sprints 39–43 closed, which each extended something that already existed.

## Epic closure

With this disclosure recorded, `specs/DEVOS-UI-UX-REDESIGN-BACKLOG.md`'s Definition of Done (§8) is satisfied: every acceptance-summary cell in §6 has been independently verified (Sprints 29–43, each in its own task files) or re-verified (DEVOS-273/274, this sprint); full monorepo and e2e validation stays green (DEVOS-275); and the one deliberate exclusion is documented rather than silently dropped. **E28 UI/UX Redesign & Full Functional Coverage is complete upon explicit user approval of this sprint**, pending only that approval per `AGENTS.md` §18/§19 — this document does not itself update `DEVOS-ROADMAP.md`/`DEVOS-BUILD-STATE.md`.
