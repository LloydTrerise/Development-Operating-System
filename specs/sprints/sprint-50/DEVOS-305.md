# DEVOS-305 — Backfill `ASSIGNEE = created_by`, then narrow `workitem.edit`/`workitem.transition` to assignment-gated

**Priority:** P1
**Depends on:** DEVOS-304 (the table this backfills into).
**Depended on by:** DEVOS-306 (UI needs real use cases to call).

## Scope

Per decision §9.6: every existing work item gets its own reporter as an initial `ASSIGNEE` row _before_ the edit restriction goes live, so no currently-editable item becomes uneditable the moment this ships. Edit (title/description/priority/metadata/parentId) stays `ASSIGNEE`-only; transition (`status`) allows `ASSIGNEE`/`REVIEWER`/`APPROVER`, matching the source document's rule.

**Real, disclosed correction**: the source document's own term is `reporter_id`; no such column has ever existed in this schema (confirmed absent from both `0004_work_items.ts` and `0013_work_items_add_metadata.ts`). `work_items.created_by` is the only creator-attribution field a work item has, and is used as the real backfill source — the identical class of gap Sprint 48 (DEVOS-296) already found and resolved the same way for `agents.accountable_owner_id`.

## Implementation

Migration `0055_backfill_work_item_assignments.ts`: a single set-based `INSERT ... SELECT id, created_by, 'ASSIGNEE', now() FROM work_items ON CONFLICT DO NOTHING` — this environment's real 3,601 existing work items handled in one statement, mirroring migration `0050`'s own set-based precedent. `down()` is a deliberate no-op (cannot distinguish this migration's own backfilled rows from a real assignment made afterward with the same shape), mirroring migration `0044`'s own established precedent for this class of backfill migration.

**Necessary, disclosed addition beyond the migration's own scope**: `createWorkItem` (`packages/application/src/work-items/create-work-item.ts`) now also creates one `ASSIGNEE` row (the creator) for every _newly_ created work item, immediately after `deps.workItems.create(workItem)`. Without this, every work item created after this sprint ships would have zero assignments and be uneditable by anyone at all — the same failure mode decision §9.6 already flags for the historical backfill, just at the creation path instead of the migration.

`updateWorkItem` (`packages/application/src/work-items/update-work-item.ts`) is rewritten:

- Loads the work item's current assignments (`deps.workItemAssignments.listForWorkItem`) and the requester's own held roles among them.
- `isEdit` = any of `title`/`description`/`priority`/`metadata`/`parentId` present in `changes`. Requires `ASSIGNEE`; else `ForbiddenError` (`403`).
- `isTransition` = `status` present in `changes`. Requires `ASSIGNEE`, `REVIEWER`, or `APPROVER`; else `ForbiddenError`.
- Both checks apply independently to the same request — a `REVIEWER` who is not the `ASSIGNEE` may transition status but not also sneak in a title change in the same call.
- `parentId` changes are additionally validated via `assertParentBelongsToProject` (DEVOS-303) and a self-parent check.

Three new use cases in `packages/application/src/work-items/`:

- `assignWorkItem` — grants a role, gated by `canManageMembers` (see `README.md`'s design-choice note); validates the role against `workItemAssignmentRoles` and that the target is a real project member.
- `removeWorkItemAssignment` — revokes a role, same gate.
- `listWorkItemAssignments` — any project member may read current assignments (mirrors `getWorkItemForPrincipal`'s membership-only gate).

`WorkItemUseCaseDeps` (`packages/application/src/work-items/deps.ts`) gains a **required** `workItemAssignments: WorkItemAssignmentRepository` field — required rather than this codebase's usual "optional additive dependency" convention, because exactly one production call site (`apps/api/src/app.ts`) and one test-fake constructor (`apps/api/tests/app.test.ts`'s `createInMemoryWorkItemDeps`) build a full `WorkItemUseCaseDeps` object literal, so widening it costs nothing, and leaving it optional would let the new authorization check silently no-op wherever it's omitted — the wrong default for a genuine access restriction (unlike e.g. `outboxEvents?`'s own enhancement-only optional dependencies).

## Out of scope

Assignment management UI, and the three new routes exposing the use cases above over HTTP (DEVOS-306).

## Acceptance

`pnpm --filter @devos/application typecheck lint test build` clean. A real e2e proof: the creator (auto-assigned `ASSIGNEE`) can edit and transition; a plain project member who holds no assignment cannot do either; a `REVIEWER` can transition but not edit; a pre-existing work item (backfilled by migration `0055`) is confirmed still editable by its own `created_by` principal post-backfill.

## Actual results

Implemented as planned. `pnpm --filter @devos/application typecheck lint test build` clean; new `packages/application/tests/work-items.test.ts` (7 cases: auto-assignment, ASSIGNEE edit/transition vs. denial, REVIEWER transition-only, `canManageMembers` gating, invalid-role/non-member rejection, same-project/cross-project parent, self-parent rejection) all green. Live-verified against real Postgres and a real running `apps/api`: a real project member with no assignment was denied both edit (`403`) and transition (`403`); the creator (auto-assigned `ASSIGNEE`) succeeded at both; a granted `REVIEWER` transitioned status (`200`) but was denied a title edit (`403`); after the `REVIEWER` grant was removed, the same principal was denied transition again (`403`). A real pre-existing work item (backfilled by migration `0055` before this session's own live verification began) was independently confirmed still editable by its own `created_by` principal via a direct Postgres query showing its real `ASSIGNEE` row. Full evidence in `DEVOS-307.md`.

## Follow-up: ASSIGNEE hand-off exception (post-completion)

Added after this sprint's own initial completion, per explicit user request (see `README.md`'s "Scope extension" section — one of three specific alternatives offered for "revisit the `canManageMembers` assignment gate," this was the one chosen).

`assignWorkItem` (`packages/application/src/work-items/assign-work-item.ts`) now allows one additional path beyond `canManageMembers`: a requester who does not hold `canManageMembers` but _is_ currently listed as the work item's own `ASSIGNEE` may grant `ASSIGNEE` (only that role, never `REVIEWER`/`APPROVER`) to another real project member. This is implemented as a genuine transfer, not an additive grant — the requester's own `ASSIGNEE` row is removed (`deps.workItemAssignments.remove(...)`) as part of the same call, before the new grant is created, so the work item never ends up with two self-granted assignees through this specific path. A new audit action, `work_item_assignment.handed_off` (vs. the ordinary `work_item_assignment.assigned`), distinguishes the two in `audit_records`.

The exception is deliberately narrow: an admin granting `ASSIGNEE` through the ordinary `canManageMembers` gate is unaffected — that path stays purely additive (the admin may grant a second assignee, or call `removeWorkItemAssignment` separately for an exclusive transfer). Only a requester reaching the gate _without_ `canManageMembers` triggers the remove-then-add transfer semantics.

**Acceptance (follow-up)**: the current `ASSIGNEE` (not `canManageMembers`) may hand `ASSIGNEE` off to another member — the transfer removes their own grant and adds the target's. A hand-off attempt for `REVIEWER`/`APPROVER` (not `ASSIGNEE`) by a non-`canManageMembers` `ASSIGNEE` is still denied. Live-verified against real Postgres and a real running `apps/api`: an OWNER's own additive `ASSIGNEE` grant to a plain member was confirmed to coexist, unaffected, alongside a subsequent real hand-off between two other plain members (the OWNER's own grant remained after the unrelated hand-off, confirming the two paths' semantics stay genuinely separate); the principal who handed off was confirmed to no longer hold `ASSIGNEE`, and a further hand-off attempt by them was denied (`403`); a hand-off attempt for `REVIEWER` by a genuine, non-`canManageMembers` `ASSIGNEE` was denied (`403`). New tests: `packages/application/tests/work-items.test.ts` (+2 cases) and `apps/api/tests/app.test.ts` (+2 cases, exercised over real HTTP). Full monorepo validation re-ran clean at **76/76**; full `tests/e2e` re-ran clean at **27/27 files, 52/52 tests**. Full evidence in `DEVOS-307.md`.
