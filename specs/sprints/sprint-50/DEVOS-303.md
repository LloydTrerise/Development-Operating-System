# DEVOS-303 — `work_items.parent_id` (same-project FK)

**Priority:** P1
**Depends on:** Sprint 46 (real `PRINCIPAL` rows), Sprint 47 (access-role scoping) — per the epic's own §7 dependency table.
**Depended on by:** DEVOS-305 (`updateWorkItem`'s edit gate also covers `parentId` changes).

## Scope

A self-referencing `parent_id` column on `work_items`, constrained to the same `project_id` as its parent, matching the source document's hierarchy rule.

## Implementation

Migration `0053_work_items_add_parent_id.ts`:

- Adds a real unique constraint `work_items_id_project_id_key` on `(id, project_id)` — trivially satisfiable since `id` is already the primary key — purely so a composite FK can target it (Postgres cannot express "same `project_id` as the referenced row" with a plain single-column FK).
- Adds `parent_id uuid` (nullable).
- Adds composite FK `work_items_parent_id_project_id_fkey`: `(parent_id, project_id)` REFERENCES `work_items(id, project_id)`, `ON DELETE SET NULL` — a parent being removed detaches its children rather than deleting them, matching this codebase's "archive, don't cascade-destroy user content" bias (nothing in this codebase hard-deletes a `work_items` row today, so this branch is not currently exercised by any real code path).
- Adds an index on `parent_id`.

`WorkItem`/`CreateWorkItemInput`/`UpdateWorkItemInput` (`packages/domain/src/work-items/work-item.ts`) gain an optional `parentId: WorkItemId`. `packages/database/src/repositories/work-items.ts`'s `toDomain`/`create`/`update` all handle it. A shared helper, `assertParentBelongsToProject` (`packages/application/src/work-items/validate-parent-work-item.ts`), is called from both `createWorkItem` and `updateWorkItem` whenever `parentId` is present — it turns the database-level composite-FK rejection into a clean `ValidationError` (`400`) instead of a raw foreign-key-violation error surfacing from Postgres, mirroring `assignProjectMemberJobRole`'s own identical precedent (Sprint 49). `updateWorkItem` additionally rejects `parentId === workItemId` (a trivial self-parent) with its own `ValidationError`, since the database-level composite FK does not by itself prevent a row from referencing itself.

## Out of scope

Any change to the existing `MembershipRole`/job-role/agent-workflow-role axes.

_Originally also out of scope, per this file's own literal acceptance criterion ("self-referencing, constrained to the same project_id," nothing about multi-hop cycles): cycle detection across multiple hops (A → B → A), and clearing an already-set parent. Both were added post-completion, per explicit user request — see `README.md`'s "Scope extension" section and this file's own "Follow-up" section below._

## Acceptance

`pnpm --filter @devos/domain build`; `pnpm --filter @devos/database typecheck build` clean. A cross-project `parentId` is rejected (both by the database's own composite FK, verified via a direct `psql` update bypassing the application layer, and by `assertParentBelongsToProject`'s own clean `400`). A same-project `parentId` is accepted and round-trips through `GET`.

## Actual results

Implemented as planned. `pnpm --filter @devos/domain build` and `pnpm --filter @devos/database typecheck build` both clean. Live-verified against real Postgres: a direct `psql UPDATE` setting a real work item's `parent_id` to a real work item id from a _different_ project was rejected with `ERROR: insert or update on table "work_items" violates foreign key constraint "work_items_parent_id_project_id_fkey"` — confirming the composite FK is enforced at the database layer, not only in application code. A real same-project parent/child pair was created through the real, unmodified `POST /projects/:id/work-items` route and round-tripped correctly (`child.parentId === parent.id`). A real cross-project `POST` attempt returned `400`; a real self-parent `PATCH` attempt returned `400`. Full evidence in `DEVOS-307.md`.

## Follow-up: cycle detection and explicit clearing (post-completion)

Added after this sprint's own initial completion, per explicit user request (see `README.md`'s "Scope extension" section).

**Cycle detection**: `assertParentBelongsToProject` gained an optional `excludeId: WorkItemId` parameter. When passed (only by `updateWorkItem`, never `createWorkItem`), it walks up the candidate parent's own `parentId` chain — `candidateParent`, `candidateParent.parentId`, and so on — and throws `ValidationError` if `excludeId` (the work item being updated) is found anywhere in that chain. This subsumes the original trivial self-parent check at depth zero (`candidateParent.id === excludeId` on the very first iteration) without a separate rule, so the earlier `changes.parentId === workItemId` check in `updateWorkItem` was removed as redundant. A `seen` set guards against an already-cyclic chain in pre-existing data (which this function itself prevents going forward, but is not assumed) — the walk stops rather than looping forever if one is ever found.

**Explicit clearing**: `UpdateWorkItemInput.parentId` widened to `WorkItemId | null`. `null` means "clear the parent"; `undefined` (an omitted field) still means "no change." Because `exactOptionalPropertyTypes` forbids assigning `parentId: undefined` explicitly to an object typed with `parentId?: WorkItemId`, both `updateWorkItem`'s own return-value construction and the real Postgres repository's `toDomain`/`update` (already correct before this follow-up — `changes.parentId !== undefined ? { parent_id: changes.parentId } : {}` already passed a literal `null` through correctly) use `delete` rather than an explicit `undefined` assignment to omit the key. The DTO layer (`apps/api/src/dto/work-item.ts`) gained `optionalNullableString`, distinguishing an omitted field, an explicit JSON `null`, and a real string.

**Acceptance (follow-up)**: a multi-hop cycle (A → B → A, and a deeper A → B → C → A) is rejected with a real `400`; a literal `null` clears a real parent, confirmed by the response omitting `parentId` entirely, and by a direct Postgres re-read after the same. Live-verified against real Postgres and a real running `apps/api`: both a direct A→B cycle attempt and a deeper A→B→C cycle attempt were rejected (`400`); a real parent was cleared via `{"parentId": null}` and the response correctly omitted the field. New tests: `packages/application/tests/work-items.test.ts` (+3 cases: shallow cycle, deep cycle, explicit clear) and `apps/api/tests/app.test.ts` (+2 cases: cycle, explicit clear). Full monorepo validation re-ran clean at **76/76**; full `tests/e2e` re-ran clean at **27/27 files, 52/52 tests**. Full evidence in `DEVOS-307.md`.
