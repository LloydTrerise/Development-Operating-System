import type { ProjectId, WorkItemId } from '@devos/contracts';
import {
  addWorkItemComment,
  archiveWorkItem,
  assignWorkItem,
  createWorkItem,
  getWorkItemForPrincipal,
  getWorkflowRunsForWorkItem,
  listWorkItemAssignments,
  listWorkItemComments,
  listWorkItemsForProject,
  removeWorkItemAssignment,
  updateWorkItem,
  type GetWorkflowRunsForWorkItemDeps,
  type WorkItemUseCaseDeps,
} from '@devos/application';
import {
  parseAddWorkItemCommentBody,
  parseAssignWorkItemBody,
  parseCreateWorkItemBody,
  parseUpdateWorkItemBody,
  toWorkItemAssignmentDto,
  toWorkItemCommentDto,
  toWorkItemDto,
} from '../dto/work-item.js';
import { toWorkflowRunDto } from '../dto/workflow-run.js';
import { requirePrincipal, type Route } from '../http/router.js';

export function createWorkItemRoutes(
  prefix: string,
  deps: WorkItemUseCaseDeps & GetWorkflowRunsForWorkItemDeps,
): Route[] {
  return [
    {
      method: 'GET',
      pattern: `${prefix}/projects/:projectId/work-items`,
      protected: true,
      handler: async ({ principal, params }) => {
        const user = requirePrincipal(principal);
        const workItems = await listWorkItemsForProject(
          deps,
          user.id,
          params.projectId as ProjectId,
        );
        return workItems.map(toWorkItemDto);
      },
    },
    {
      method: 'POST',
      pattern: `${prefix}/projects/:projectId/work-items`,
      protected: true,
      handler: async ({ principal, params, body }) => {
        const user = requirePrincipal(principal);
        const { parentId, ...input } = parseCreateWorkItemBody(body);
        const workItem = await createWorkItem(deps, user.id, params.projectId as ProjectId, {
          ...input,
          ...(parentId !== undefined ? { parentId: parentId as WorkItemId } : {}),
        });
        return toWorkItemDto(workItem);
      },
    },
    {
      method: 'GET',
      pattern: `${prefix}/work-items/:workItemId`,
      protected: true,
      handler: async ({ principal, params }) => {
        const user = requirePrincipal(principal);
        const workItem = await getWorkItemForPrincipal(
          deps,
          user.id,
          params.workItemId as WorkItemId,
        );
        return toWorkItemDto(workItem);
      },
    },
    {
      method: 'PATCH',
      pattern: `${prefix}/work-items/:workItemId`,
      protected: true,
      handler: async ({ principal, params, body }) => {
        const user = requirePrincipal(principal);
        const { parentId, ...changes } = parseUpdateWorkItemBody(body);
        const workItem = await updateWorkItem(deps, user.id, params.workItemId as WorkItemId, {
          ...changes,
          ...(parentId !== undefined
            ? { parentId: parentId === null ? null : (parentId as WorkItemId) }
            : {}),
        });
        return toWorkItemDto(workItem);
      },
    },
    {
      // DEVOS-080: closes the gap DEVOS-071 flagged — "no API exposes a
      // work item's runs" — needed once one work item's change genuinely
      // spans multiple runs (planning, development, release).
      method: 'GET',
      pattern: `${prefix}/work-items/:workItemId/workflow-runs`,
      protected: true,
      handler: async ({ principal, params }) => {
        const user = requirePrincipal(principal);
        const runs = await getWorkflowRunsForWorkItem(
          deps,
          user.id,
          params.workItemId as WorkItemId,
        );
        return runs.map(toWorkflowRunDto);
      },
    },
    // DEVOS-306 (Sprint 50): the work item detail view's assignment picker.
    {
      method: 'GET',
      pattern: `${prefix}/work-items/:workItemId/assignments`,
      protected: true,
      handler: async ({ principal, params }) => {
        const user = requirePrincipal(principal);
        const assignments = await listWorkItemAssignments(
          deps,
          user.id,
          params.workItemId as WorkItemId,
        );
        return assignments.map(toWorkItemAssignmentDto);
      },
    },
    {
      method: 'POST',
      pattern: `${prefix}/work-items/:workItemId/assignments`,
      protected: true,
      handler: async ({ principal, params, body }) => {
        const user = requirePrincipal(principal);
        const input = parseAssignWorkItemBody(body);
        const assignment = await assignWorkItem(
          deps,
          user.id,
          params.workItemId as WorkItemId,
          input.principalId,
          input.role,
        );
        return toWorkItemAssignmentDto(assignment);
      },
    },
    {
      method: 'DELETE',
      pattern: `${prefix}/work-items/:workItemId/assignments/:principalId/:role`,
      protected: true,
      handler: async ({ principal, params }) => {
        const user = requirePrincipal(principal);
        await removeWorkItemAssignment(
          deps,
          user.id,
          params.workItemId as WorkItemId,
          params.principalId!,
          params.role!,
        );
        return { removed: true };
      },
    },
    // DEVOS-309 (Sprint 51 reconciliation): workitem.comment.
    {
      method: 'GET',
      pattern: `${prefix}/work-items/:workItemId/comments`,
      protected: true,
      handler: async ({ principal, params }) => {
        const user = requirePrincipal(principal);
        const comments = await listWorkItemComments(deps, user.id, params.workItemId as WorkItemId);
        return comments.map(toWorkItemCommentDto);
      },
    },
    {
      method: 'POST',
      pattern: `${prefix}/work-items/:workItemId/comments`,
      protected: true,
      handler: async ({ principal, params, body }) => {
        const user = requirePrincipal(principal);
        const input = parseAddWorkItemCommentBody(body);
        const comment = await addWorkItemComment(
          deps,
          user.id,
          params.workItemId as WorkItemId,
          input,
        );
        return toWorkItemCommentDto(comment);
      },
    },
    // DEVOS-309 (Sprint 51 reconciliation): workitem.delete, implemented as
    // a soft archive — see `archiveWorkItem`'s own doc comment.
    {
      method: 'POST',
      pattern: `${prefix}/work-items/:workItemId/archive`,
      protected: true,
      handler: async ({ principal, params }) => {
        const user = requirePrincipal(principal);
        const workItem = await archiveWorkItem(deps, user.id, params.workItemId as WorkItemId);
        return toWorkItemDto(workItem);
      },
    },
  ];
}
