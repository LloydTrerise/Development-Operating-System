import type { ProjectId, WorkItemId } from '@devos/contracts';
import { ValidationError } from '../errors.js';
import type { WorkItemUseCaseDeps } from './deps.js';

/**
 * DEVOS-303: migration `0053`'s composite FK (`parent_id`, `project_id`)
 * already rejects a cross-project parent at the database layer — this
 * pre-check exists only to turn that into a clean `ValidationError` instead
 * of a raw foreign-key-violation error surfacing from Postgres, mirroring
 * `assignProjectMemberJobRole`'s own identical precedent
 * (`packages/application/src/job-roles/assign-project-member-job-role.ts`).
 *
 * `excludeId` (only ever passed by `updateWorkItem`, never by
 * `createWorkItem` — a brand-new id cannot already appear in any existing
 * ancestor chain) enables cycle detection: walks up `parentId` from the
 * candidate parent, and rejects if `excludeId` (the work item being
 * updated) is found anywhere in that chain — this subsumes the trivial
 * self-parent case (`excludeId === parentId`, found at the very first
 * step) without a separate check. A real, disclosed follow-up to this
 * sprint's own original scope, which deliberately left multi-hop cycle
 * detection out (see `specs/sprints/sprint-50/DEVOS-303.md`'s own
 * "actual results" note) — added after the user explicitly asked for it.
 * `seen` guards against an already-cyclic chain in existing data (which
 * this function itself should prevent going forward, but is not assumed);
 * walking stops rather than looping forever if one is ever found.
 */
export async function assertParentBelongsToProject(
  deps: WorkItemUseCaseDeps,
  projectId: ProjectId,
  parentId: WorkItemId,
  excludeId?: WorkItemId,
): Promise<void> {
  const parent = await deps.workItems.getById(parentId);
  if (!parent || parent.projectId !== projectId) {
    throw new ValidationError('parentId does not belong to the same project.');
  }

  if (excludeId === undefined) return;

  const seen = new Set<string>();
  let current: { id: WorkItemId; parentId?: WorkItemId } | null = parent;
  while (current) {
    if (current.id === excludeId) {
      throw new ValidationError('parentId would create a cycle in the work item hierarchy.');
    }
    if (seen.has(current.id)) break;
    seen.add(current.id);
    current = current.parentId ? await deps.workItems.getById(current.parentId) : null;
  }
}
