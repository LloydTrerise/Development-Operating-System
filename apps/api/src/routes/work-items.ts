import type { ProjectId, WorkItemId } from '@devos/contracts';
import {
  createWorkItem,
  getWorkItemForPrincipal,
  getWorkflowRunsForWorkItem,
  listWorkItemsForProject,
  updateWorkItem,
  type GetWorkflowRunsForWorkItemDeps,
  type WorkItemUseCaseDeps,
} from '@devos/application';
import {
  parseCreateWorkItemBody,
  parseUpdateWorkItemBody,
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
        const input = parseCreateWorkItemBody(body);
        const workItem = await createWorkItem(deps, user.id, params.projectId as ProjectId, input);
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
        const changes = parseUpdateWorkItemBody(body);
        const workItem = await updateWorkItem(
          deps,
          user.id,
          params.workItemId as WorkItemId,
          changes,
        );
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
  ];
}
