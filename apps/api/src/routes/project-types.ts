import type { ProjectTypeId } from '@devos/contracts';
import {
  createProjectTypeAgent,
  createProjectTypeWorkflow,
  createProjectType,
  getProjectType,
  listProjectTypeAgents,
  listProjectTypeWorkflows,
  listProjectTypes,
  updateProjectTypeAgent,
  updateProjectTypeWorkflow,
  updateProjectType,
  type ProjectTypeUseCaseDeps,
} from '@devos/application';
import {
  parseCreateProjectTypeAgentBody,
  parseCreateProjectTypeBody,
  parseCreateProjectTypeWorkflowBody,
  parseUpdateProjectTypeAgentBody,
  parseUpdateProjectTypeBody,
  parseUpdateProjectTypeWorkflowBody,
  toProjectTypeAgentDto,
  toProjectTypeDto,
  toProjectTypeWorkflowDto,
} from '../dto/project-type.js';
import { requirePrincipal, type Route } from '../http/router.js';

export function createProjectTypeRoutes(prefix: string, deps: ProjectTypeUseCaseDeps): Route[] {
  return [
    {
      method: 'GET',
      pattern: `${prefix}/project-types`,
      protected: true,
      handler: async ({ principal }) => {
        requirePrincipal(principal);
        const projectTypes = await listProjectTypes(deps);
        return projectTypes.map(toProjectTypeDto);
      },
    },
    {
      method: 'POST',
      pattern: `${prefix}/project-types`,
      protected: true,
      handler: async ({ principal, body }) => {
        requirePrincipal(principal);
        const input = parseCreateProjectTypeBody(body);
        const projectType = await createProjectType(deps, input);
        return toProjectTypeDto(projectType);
      },
    },
    {
      method: 'GET',
      pattern: `${prefix}/project-types/:projectTypeId`,
      protected: true,
      handler: async ({ principal, params }) => {
        requirePrincipal(principal);
        const projectType = await getProjectType(deps, params.projectTypeId as ProjectTypeId);
        return toProjectTypeDto(projectType);
      },
    },
    {
      method: 'PATCH',
      pattern: `${prefix}/project-types/:projectTypeId`,
      protected: true,
      handler: async ({ principal, params, body }) => {
        requirePrincipal(principal);
        const changes = parseUpdateProjectTypeBody(body);
        const projectType = await updateProjectType(
          deps,
          params.projectTypeId as ProjectTypeId,
          changes,
        );
        return toProjectTypeDto(projectType);
      },
    },
    {
      method: 'GET',
      pattern: `${prefix}/project-types/:projectTypeId/workflows`,
      protected: true,
      handler: async ({ principal, params }) => {
        requirePrincipal(principal);
        const workflows = await listProjectTypeWorkflows(
          deps,
          params.projectTypeId as ProjectTypeId,
        );
        return workflows.map(toProjectTypeWorkflowDto);
      },
    },
    {
      method: 'POST',
      pattern: `${prefix}/project-types/:projectTypeId/workflows`,
      protected: true,
      handler: async ({ principal, params, body }) => {
        requirePrincipal(principal);
        const input = parseCreateProjectTypeWorkflowBody(body);
        const workflow = await createProjectTypeWorkflow(
          deps,
          params.projectTypeId as ProjectTypeId,
          input,
        );
        return toProjectTypeWorkflowDto(workflow);
      },
    },
    {
      method: 'PATCH',
      pattern: `${prefix}/project-types/:projectTypeId/workflows/:workflowKey`,
      protected: true,
      handler: async ({ principal, params, body }) => {
        requirePrincipal(principal);
        const changes = parseUpdateProjectTypeWorkflowBody(body);
        const workflow = await updateProjectTypeWorkflow(
          deps,
          params.projectTypeId as ProjectTypeId,
          params.workflowKey!,
          changes,
        );
        return toProjectTypeWorkflowDto(workflow);
      },
    },
    {
      method: 'GET',
      pattern: `${prefix}/project-types/:projectTypeId/agents`,
      protected: true,
      handler: async ({ principal, params }) => {
        requirePrincipal(principal);
        const agents = await listProjectTypeAgents(deps, params.projectTypeId as ProjectTypeId);
        return agents.map(toProjectTypeAgentDto);
      },
    },
    {
      method: 'POST',
      pattern: `${prefix}/project-types/:projectTypeId/agents`,
      protected: true,
      handler: async ({ principal, params, body }) => {
        requirePrincipal(principal);
        const input = parseCreateProjectTypeAgentBody(body);
        const agent = await createProjectTypeAgent(
          deps,
          params.projectTypeId as ProjectTypeId,
          input,
        );
        return toProjectTypeAgentDto(agent);
      },
    },
    {
      method: 'PATCH',
      pattern: `${prefix}/project-types/:projectTypeId/agents/:agentKey`,
      protected: true,
      handler: async ({ principal, params, body }) => {
        requirePrincipal(principal);
        const changes = parseUpdateProjectTypeAgentBody(body);
        const agent = await updateProjectTypeAgent(
          deps,
          params.projectTypeId as ProjectTypeId,
          params.agentKey!,
          changes,
        );
        return toProjectTypeAgentDto(agent);
      },
    },
  ];
}
