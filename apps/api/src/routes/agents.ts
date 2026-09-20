import type { AgentId, AgentVersionId, OrganisationId, ProjectId } from '@devos/contracts';
import {
  createAgent,
  createNewAgentVersion,
  getAgentForPrincipal,
  getAgentQuality,
  installAgentVersion,
  listAgentsForProject,
  listAgentVersionsForAgent,
  listSharedAgentVersionsForOrganisation,
  publishAgentVersion,
  shareAgentVersion,
  type AgentUseCaseDeps,
} from '@devos/application';
import {
  parseCreateAgentBody,
  parseInstallAgentVersionBody,
  parseShareAgentVersionBody,
  toAgentDto,
  toAgentVersionDto,
  toSharedAgentVersionDto,
} from '../dto/agent.js';
import { requirePrincipal, type Route } from '../http/router.js';

export function createAgentRoutes(prefix: string, deps: AgentUseCaseDeps): Route[] {
  return [
    {
      method: 'GET',
      pattern: `${prefix}/projects/:projectId/agents`,
      protected: true,
      handler: async ({ principal, params }) => {
        const user = requirePrincipal(principal);
        const agents = await listAgentsForProject(deps, user.id, params.projectId as ProjectId);
        return agents.map(toAgentDto);
      },
    },
    {
      method: 'POST',
      pattern: `${prefix}/projects/:projectId/agents`,
      protected: true,
      handler: async ({ principal, params, body }) => {
        const user = requirePrincipal(principal);
        const input = parseCreateAgentBody(body);
        const { agent, version } = await createAgent(
          deps,
          user.id,
          params.projectId as ProjectId,
          input,
        );
        return { ...toAgentDto(agent), version: toAgentVersionDto(version) };
      },
    },
    {
      method: 'GET',
      pattern: `${prefix}/agents/:agentId`,
      protected: true,
      handler: async ({ principal, params }) => {
        const user = requirePrincipal(principal);
        const agent = await getAgentForPrincipal(deps, user.id, params.agentId as AgentId);
        return toAgentDto(agent);
      },
    },
    {
      method: 'POST',
      pattern: `${prefix}/agents/:agentId/publish`,
      protected: true,
      handler: async ({ principal, params }) => {
        const user = requirePrincipal(principal);
        const version = await publishAgentVersion(deps, user.id, params.agentId as AgentId);
        return toAgentVersionDto(version);
      },
    },
    {
      method: 'POST',
      pattern: `${prefix}/agents/:agentId/versions`,
      protected: true,
      handler: async ({ principal, params }) => {
        const user = requirePrincipal(principal);
        const version = await createNewAgentVersion(deps, user.id, params.agentId as AgentId);
        return toAgentVersionDto(version);
      },
    },
    {
      method: 'GET',
      pattern: `${prefix}/agents/:agentId/versions`,
      protected: true,
      handler: async ({ principal, params }) => {
        const user = requirePrincipal(principal);
        const versions = await listAgentVersionsForAgent(deps, user.id, params.agentId as AgentId);
        return versions.map(toAgentVersionDto);
      },
    },
    {
      method: 'GET',
      pattern: `${prefix}/agents/:agentId/quality`,
      protected: true,
      handler: async ({ principal, params }) => {
        const user = requirePrincipal(principal);
        return getAgentQuality(deps, user.id, params.agentId as AgentId);
      },
    },
    {
      method: 'POST',
      pattern: `${prefix}/agents/:agentId/versions/:version/share`,
      protected: true,
      handler: async ({ principal, params, body }) => {
        const user = requirePrincipal(principal);
        const { shared } = parseShareAgentVersionBody(body);
        const version = await shareAgentVersion(
          deps,
          user.id,
          params.agentId as AgentId,
          Number(params.version),
          shared,
        );
        return toAgentVersionDto(version);
      },
    },
    {
      method: 'GET',
      pattern: `${prefix}/organisations/:organisationId/shared-agents`,
      protected: true,
      handler: async ({ principal, params }) => {
        const user = requirePrincipal(principal);
        const versions = await listSharedAgentVersionsForOrganisation(
          deps,
          user.id,
          params.organisationId as OrganisationId,
        );
        return versions.map(toSharedAgentVersionDto);
      },
    },
    {
      method: 'POST',
      pattern: `${prefix}/organisations/:organisationId/shared-agents/:agentVersionId/install`,
      protected: true,
      handler: async ({ principal, params, body }) => {
        const user = requirePrincipal(principal);
        const { targetProjectId } = parseInstallAgentVersionBody(body);
        const { agent, version } = await installAgentVersion(
          deps,
          user.id,
          params.agentVersionId as AgentVersionId,
          targetProjectId as ProjectId,
        );
        return { ...toAgentDto(agent), version: toAgentVersionDto(version) };
      },
    },
  ];
}
