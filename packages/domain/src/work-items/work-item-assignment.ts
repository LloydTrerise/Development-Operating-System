import type { WorkItemId } from '@devos/contracts';

/**
 * DEVOS-304 (Sprint 50, `specs/DEVOS-ACCESS-CONTROL-MODEL-BACKLOG.md` §6.5):
 * the source document's `WORK_ITEM_ASSIGNMENT` role set. A principal may
 * hold more than one of these on the same work item simultaneously (e.g.
 * `ASSIGNEE` and `REVIEWER`), one row per role held — see migration `0054`'s
 * own composite primary key.
 */
export const workItemAssignmentRoles = ['ASSIGNEE', 'REVIEWER', 'APPROVER'] as const;
export type WorkItemAssignmentRole = (typeof workItemAssignmentRoles)[number];

export interface WorkItemAssignment {
  workItemId: WorkItemId;
  principalId: string;
  role: WorkItemAssignmentRole;
  createdAt: string;
}

export interface WorkItemAssignmentRepository {
  listForWorkItem: (workItemId: WorkItemId) => Promise<WorkItemAssignment[]>;
  create: (assignment: WorkItemAssignment) => Promise<void>;
  remove: (
    workItemId: WorkItemId,
    principalId: string,
    role: WorkItemAssignmentRole,
  ) => Promise<void>;
}
