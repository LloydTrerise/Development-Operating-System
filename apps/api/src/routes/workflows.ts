import type { ProjectId, WorkflowId } from '@devos/contracts';
import {
  createWorkflowDefinition,
  getWorkflowDefinitionForPrincipal,
  getWorkflowVersionByNumber,
  listWorkflowDefinitionsForProject,
  listWorkflowVersions,
  publishWorkflowVersion,
  updateDraftWorkflow,
  validateDraftWorkflow,
  type WorkflowUseCaseDeps,
} from '@devos/application';
import {
  parseCreateWorkflowBody,
  parseVersionNumber,
  parseWorkflowGraphBody,
  toWorkflowDefinitionDto,
  toWorkflowVersionDto,
} from '../dto/workflow.js';
import { requirePrincipal, type Route } from '../http/router.js';

export function createWorkflowRoutes(prefix: string, deps: WorkflowUseCaseDeps): Route[] {
  return [
    {
      method: 'GET',
      pattern: `${prefix}/projects/:projectId/workflows`,
      protected: true,
      handler: async ({ principal, params }) => {
        const user = requirePrincipal(principal);
        const definitions = await listWorkflowDefinitionsForProject(
          deps,
          user.id,
          params.projectId as ProjectId,
        );
        return definitions.map(toWorkflowDefinitionDto);
      },
    },
    {
      method: 'POST',
      pattern: `${prefix}/projects/:projectId/workflows`,
      protected: true,
      handler: async ({ principal, params, body }) => {
        const user = requirePrincipal(principal);
        const input = parseCreateWorkflowBody(body);
        const { definition, version } = await createWorkflowDefinition(
          deps,
          user.id,
          params.projectId as ProjectId,
          input,
        );
        return { ...toWorkflowDefinitionDto(definition), version: toWorkflowVersionDto(version) };
      },
    },
    {
      method: 'GET',
      pattern: `${prefix}/workflows/:workflowId`,
      protected: true,
      handler: async ({ principal, params }) => {
        const user = requirePrincipal(principal);
        const definition = await getWorkflowDefinitionForPrincipal(
          deps,
          user.id,
          params.workflowId as WorkflowId,
        );
        return toWorkflowDefinitionDto(definition);
      },
    },
    {
      method: 'PATCH',
      pattern: `${prefix}/workflows/:workflowId`,
      protected: true,
      handler: async ({ principal, params, body }) => {
        const user = requirePrincipal(principal);
        const graph = parseWorkflowGraphBody(body);
        const version = await updateDraftWorkflow(
          deps,
          user.id,
          params.workflowId as WorkflowId,
          graph,
        );
        return toWorkflowVersionDto(version);
      },
    },
    {
      method: 'GET',
      pattern: `${prefix}/workflows/:workflowId/versions`,
      protected: true,
      handler: async ({ principal, params }) => {
        const user = requirePrincipal(principal);
        const versions = await listWorkflowVersions(deps, user.id, params.workflowId as WorkflowId);
        return versions.map(toWorkflowVersionDto);
      },
    },
    {
      method: 'GET',
      pattern: `${prefix}/workflows/:workflowId/versions/:version`,
      protected: true,
      handler: async ({ principal, params }) => {
        const user = requirePrincipal(principal);
        const versionNumber = parseVersionNumber(params.version!);
        const version = await getWorkflowVersionByNumber(
          deps,
          user.id,
          params.workflowId as WorkflowId,
          versionNumber,
        );
        return toWorkflowVersionDto(version);
      },
    },
    {
      method: 'POST',
      pattern: `${prefix}/workflows/:workflowId/validate`,
      protected: true,
      handler: async ({ principal, params }) => {
        const user = requirePrincipal(principal);
        return validateDraftWorkflow(deps, user.id, params.workflowId as WorkflowId);
      },
    },
    {
      method: 'POST',
      pattern: `${prefix}/workflows/:workflowId/publish`,
      protected: true,
      handler: async ({ principal, params }) => {
        const user = requirePrincipal(principal);
        const version = await publishWorkflowVersion(
          deps,
          user.id,
          params.workflowId as WorkflowId,
        );
        return toWorkflowVersionDto(version);
      },
    },
  ];
}
