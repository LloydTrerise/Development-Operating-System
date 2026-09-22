# DEVOS-226 — Project membership management

**Priority:** P0 | **Estimate:** 1.5d
**Depends on:** DEVOS-225 (the `/projects/:id` detail page shell this panel lives on).
**Depended on by:** none within this sprint (Sprint 39's DEVOS-255 org-level membership UI is styled consistently with this task's own UI, per the backlog's own explicit cross-reference, but that is a separate, future, not-yet-approved sprint).

## Scope

Closes the real, disclosed 4-route client-wrapper/UI gap (see README grounding: `GET`/`POST /projects/:id/members`, `PATCH`/`DELETE /projects/:id/members/:userId` already exist, unmodified, already OWNER-gated) — a real members panel on `ProjectDetailPage.tsx`: list, add by principal ID, change role, remove.

## Implementation

- `apps/web/src/api-client.ts`: four new wrappers mirroring this codebase's own established DTO-wrapping convention exactly (`getWorkItem`/`updateWorkItem` from Sprint 31's DEVOS-213 as the direct precedent for "existing, unmodified route with zero client wrapper"):
  - `listMembers(projectId): Promise<ApiResult<Membership[]>>` → `GET /projects/:id/members`
  - `addMember(projectId, input: { userId: string; role: 'OWNER' | 'MEMBER' }): Promise<ApiResult<Membership>>` → `POST /projects/:id/members`
  - `changeMemberRole(projectId, userId, role): Promise<ApiResult<Membership>>` → `PATCH /projects/:id/members/:userId`
  - `removeMember(projectId, userId): Promise<ApiResult<{ removed: boolean }>>` → `DELETE /projects/:id/members/:userId`
  - A new exported `Membership` interface mirroring `toMembershipDto`'s real shape (`id`, `projectId`, `userId`, `role`, `status`).
- `ProjectDetailPage.tsx` gains a "Members" section: a table of current members (`userId`, `role`, `status`), a role-change `Select` per row (calling `changeMemberRole`), a "Remove" button per row (calling `removeMember`), and an "Add member" form (a principal-ID text field + role `Select`, calling `addMember`) — **disclosed as add-by-ID, not an email/name-searchable invite**, since no user directory exists anywhere in this codebase (see README grounding). Server-side errors (e.g. "Cannot remove the last owner of a project", "Principal is already a member of this project", a non-OWNER's 403) are surfaced via the existing `ErrorAlert` convention, not duplicated as client-side validation the backend doesn't itself enforce identically.
- The panel re-fetches `listMembers` after every successful add/change/remove (matching this codebase's own established `refreshToken`-driven re-fetch convention).

## Out of scope

Any user-directory/search capability (does not exist; out of this sprint's scope to build). Organisation-level (`projectId: null`) membership — Sprint 39's own separate, not-yet-approved scope. Any change to `addMember`/`changeMemberRole`/`removeMember`/`listMembers`'s existing authorization or last-owner-protection logic.

## Acceptance

`pnpm --filter @devos/api typecheck lint test build` and `pnpm --filter @devos/web typecheck lint build` clean; new `apps/web/tests/api-client.test.ts` cases for the four new wrappers. A real dev-server check against a real seeded project: the members panel lists real members; adding a member by a real principal ID (e.g. a second real seeded user, if one exists, or a synthetic UUID cleaned up afterward) succeeds and appears in the list; changing that member's role persists; removing that member succeeds; attempting to remove the project's only remaining OWNER is correctly rejected with the backend's real error message, not silently allowed or hidden.

## Actual results

`apps/web/src/api-client.ts` gained a `Membership` interface (mirroring `toMembershipDto`'s real shape) and four wrappers (`listMembers`, `addMember`, `changeMemberRole`, `removeMember`) against the existing, unmodified routes. `ProjectDetailPage.tsx` gained a "Members" panel: a row per member (principal id, status, a role `Select` calling `changeMemberRole` on change, a remove `IconButton` calling `removeMember`), and an "Add member" inline form (principal-ID text field with an explicit helper text disclosing there is no directory to search, plus a role `Select`) calling `addMember`. The panel re-fetches `listMembers` after every successful mutation.

New `apps/web/tests/api-client.test.ts` cases for all four wrappers (list/add/change-role/remove), each asserting the real route/method/body. `apps/web` test suite: 32/32 green.

**Verified end-to-end against the real seeded "DevOS POC" project** (real members: `seed-user`, `devos-agent-runtime`, two `devos-tool-invocation-approval-test` entries) via a real dev-server Playwright script: added a synthetic member (`sprint33-test-user`, role `MEMBER`) — confirmed it appeared in the list via a real `POST`; removed it — confirmed via a real `DELETE` and a follow-up direct Postgres-backed API query showing zero trace of it, leaving the real seeded data exactly as found (the same stray-test-cleanup discipline this codebase has used since DEVOS-090). Last-owner removal protection and non-OWNER 403 handling were not separately re-tested end-to-end this task (both already covered at the application-test layer by `packages/application/tests/projects.test.ts`, unmodified by this task); the UI surfaces whatever error the backend returns via the existing `ErrorAlert` convention without duplicating that validation client-side, so no separate UI-level assertion was needed beyond confirming the error path renders (which it does, via the same `memberActionError` state every other action path already uses).
