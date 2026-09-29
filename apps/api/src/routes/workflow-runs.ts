import type { WorkflowId, WorkflowRunId, WorkflowVersionId, WorkItemId } from '@devos/contracts';
import {
  getWorkflowRunForPrincipal,
  listTasksForRun,
  startWorkflowRunFromActiveVersion,
  startWorkflowRunFromVersion,
  type WorkflowUseCaseDeps,
} from '@devos/application';
import { parseStartRunBody, toWorkflowRunDto, toWorkflowTaskDto } from '../dto/workflow-run.js';
import { organisationIdViaEntityProject } from '../http/organisation-scope.js';
import { requirePrincipal, type Route } from '../http/router.js';

export function createWorkflowRunRoutes(prefix: string, deps: WorkflowUseCaseDeps): Route[] {
  return [
    {
      method: 'POST',
      pattern: `${prefix}/workflows/:workflowId/runs`,
      protected: true,
      resolveOrganisationId: organisationIdViaEntityProject(
        (context) => deps.workflowDefinitions.getById(context.params.workflowId as WorkflowId),
        (definition) => definition.projectId,
        deps.projects,
      ),
      handler: async ({ principal, params, body, correlationId }) => {
        const user = requirePrincipal(principal);
        const input = parseStartRunBody(body);
        const run = await startWorkflowRunFromActiveVersion(
          deps,
          user.id,
          params.workflowId as WorkflowId,
          { ...input, workItemId: input.workItemId as WorkItemId, correlationId },
        );
        return toWorkflowRunDto(run);
      },
    },
    {
      method: 'POST',
      pattern: `${prefix}/workflow-versions/:workflowVersionId/runs`,
      protected: true,
      // DEVOS-338 (Sprint 59): a two-hop lookup (version -> definition ->
      // project) — too specific to fit the shared single-hop
      // `organisationIdViaEntityProject` helper, so resolved inline here.
      resolveOrganisationId: async (context) => {
        const version = await deps.workflowVersions.getById(
          context.params.workflowVersionId as WorkflowVersionId,
        );
        if (!version) return null;
        const definition = await deps.workflowDefinitions.getById(version.workflowDefinitionId);
        if (!definition) return null;
        const project = await deps.projects.getById(definition.projectId);
        return project ? project.organisationId : null;
      },
      handler: async ({ principal, params, body, correlationId }) => {
        const user = requirePrincipal(principal);
        const input = parseStartRunBody(body);
        const run = await startWorkflowRunFromVersion(
          deps,
          user.id,
          params.workflowVersionId as WorkflowVersionId,
          { ...input, workItemId: input.workItemId as WorkItemId, correlationId },
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
