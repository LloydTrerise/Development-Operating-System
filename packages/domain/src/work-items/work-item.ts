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
}

export interface CreateWorkItemInput {
  title: string;
  description?: string;
  externalRef?: string;
  type?: string;
  priority?: string;
  source?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateWorkItemInput {
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  metadata?: Record<string, unknown>;
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
}
