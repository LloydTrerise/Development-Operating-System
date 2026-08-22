import type { AgentId, ProjectId } from '@devos/contracts';
import {
  createAgent,
  getAgentForPrincipal,
  listAgentsForProject,
  publishAgentVersion,
  type AgentUseCaseDeps,
} from '@devos/application';
import { parseCreateAgentBody, toAgentDto, toAgentVersionDto } from '../dto/agent.js';
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
  ];
}
