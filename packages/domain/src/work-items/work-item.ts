import type { ProjectId, WorkItemId } from '@devos/contracts';

export interface WorkItem {
  id: WorkItemId;
  projectId: ProjectId;
  externalRef?: string;
  title: string;
  description?: string;
  type: string;
  status: string;
  priority: string;
  source?: string;
  metadata: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  /** DEVOS-303: same-project parent, enforced at the database layer
   * (migration `0053`'s composite FK to `work_items(id, project_id)`). */
  parentId?: WorkItemId;
}

export interface CreateWorkItemInput {
  title: string;
  description?: string;
  externalRef?: string;
  type?: string;
  priority?: string;
  source?: string;
  metadata?: Record<string, unknown>;
  parentId?: WorkItemId;
}

export interface UpdateWorkItemInput {
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  metadata?: Record<string, unknown>;
  /** DEVOS-303: omitted = no change; a `WorkItemId` = set/replace the
   * parent; `null` = explicitly clear it (detach from its current parent).
   * `CreateWorkItemInput.parentId` has no `null` case — a work item being
   * created has no existing parent to clear. */
  parentId?: WorkItemId | null;
}

export interface WorkItemReworkCount {
  workItemId: WorkItemId;
  reworkCount: number;
}

export interface WorkItemRepository {
  getById: (id: WorkItemId) => Promise<WorkItem | null>;
  listForProject: (projectId: ProjectId) => Promise<WorkItem[]>;
  create: (workItem: WorkItem) => Promise<void>;
  update: (id: WorkItemId, changes: UpdateWorkItemInput, updatedAt: string) => Promise<void>;
  /**
   * DEVOS-163: reads `metadata->>'reworkCount'` (the real, already-written
   * field `run-review-agent-task.ts` increments on each `CHANGES_REQUIRED`
   * decision, bounded by `MAX_AUTOMATIC_REWORK_CYCLES`), via the same
   * jsonb-text-extraction pattern `costBreakdownByRoleForOrganisation`
   * already established for `agent_versions.configuration->>'role'`. Only
   * work items with a real, non-zero rework count are returned. Optional,
   * matching this codebase's established pattern for repository extensions
   * added after a repository's own initial interface.
   */
  countReworkCyclesForProject?: (projectId: ProjectId) => Promise<WorkItemReworkCount[]>;
  /**
   * DEVOS-261: real Postgres full-text search, mirroring
   * `KnowledgeSourceRepository.searchForProject`'s (DEVOS-187) exact
   * pattern. Optional, matching this repository's own established
   * additive-method convention (`countReworkCyclesForProject`).
   */
  searchForProject?: (projectId: ProjectId, query: string) => Promise<WorkItem[]>;
}
