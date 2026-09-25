import type { WorkItemCommentId, WorkItemId } from '@devos/contracts';

/**
 * DEVOS-309 (Sprint 51 reconciliation): the source document's
 * `workitem.comment` — a real, additive capability, granted to any project
 * member (not assignment-gated, unlike `workitem.edit`/`workitem.transition`).
 */
export interface WorkItemComment {
  id: WorkItemCommentId;
  workItemId: WorkItemId;
  principalId: string;
  body: string;
  createdAt: string;
}

export interface CreateWorkItemCommentInput {
  body: string;
}

export interface WorkItemCommentRepository {
  listForWorkItem: (workItemId: WorkItemId) => Promise<WorkItemComment[]>;
  create: (comment: WorkItemComment) => Promise<void>;
}
