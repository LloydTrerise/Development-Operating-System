import type { ProjectId, WorkItemId } from '@devos/contracts';
import {
  createWorkItem,
  getWorkItemForPrincipal,
  listWorkItemsForProject,
  updateWorkItem,
  type WorkItemUseCaseDeps,
} from '@devos/application';
import {
  parseCreateWorkItemBody,
  parseUpdateWorkItemBody,
  toWorkItemDto,
} from '../dto/work-item.js';
import { requirePrincipal, type Route } from '../http/router.js';

export function createWorkItemRoutes(prefix: string, deps: WorkItemUseCaseDeps): Route[] {
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
  ];
}
