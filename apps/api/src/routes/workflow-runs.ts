import type { WorkflowId, WorkflowRunId, WorkflowVersionId, WorkItemId } from '@devos/contracts';
import {
  getWorkflowRunForPrincipal,
  listTasksForRun,
  startWorkflowRunFromActiveVersion,
  startWorkflowRunFromVersion,
  type WorkflowUseCaseDeps,
} from '@devos/application';
import { parseStartRunBody, toWorkflowRunDto, toWorkflowTaskDto } from '../dto/workflow-run.js';
import { requirePrincipal, type Route } from '../http/router.js';

export function createWorkflowRunRoutes(prefix: string, deps: WorkflowUseCaseDeps): Route[] {
  return [
    {
      method: 'POST',
      pattern: `${prefix}/workflows/:workflowId/runs`,
      protected: true,
      handler: async ({ principal, params, body }) => {
        const user = requirePrincipal(principal);
        const input = parseStartRunBody(body);
        const run = await startWorkflowRunFromActiveVersion(
          deps,
          user.id,
          params.workflowId as WorkflowId,
          { ...input, workItemId: input.workItemId as WorkItemId },
        );
        return toWorkflowRunDto(run);
      },
    },
    {
      method: 'POST',
      pattern: `${prefix}/workflow-versions/:workflowVersionId/runs`,
      protected: true,
      handler: async ({ principal, params, body }) => {
        const user = requirePrincipal(principal);
        const input = parseStartRunBody(body);
        const run = await startWorkflowRunFromVersion(
          deps,
          user.id,
          params.workflowVersionId as WorkflowVersionId,
          { ...input, workItemId: input.workItemId as WorkItemId },
        );
        return toWorkflowRunDto(run);
      },
    },
    {
      method: 'GET',
      pattern: `${prefix}/runs/:runId`,
      protected: true,
      handler: async ({ principal, params }) => {
        const user = requirePrincipal(principal);
        const run = await getWorkflowRunForPrincipal(deps, user.id, params.runId as WorkflowRunId);
        return toWorkflowRunDto(run);
      },
    },
    {
      method: 'GET',
      pattern: `${prefix}/runs/:runId/tasks`,
      protected: true,
      handler: async ({ principal, params }) => {
        const user = requirePrincipal(principal);
        const tasks = await listTasksForRun(deps, user.id, params.runId as WorkflowRunId);
        return tasks.map(toWorkflowTaskDto);
      },
    },
  ];
}
