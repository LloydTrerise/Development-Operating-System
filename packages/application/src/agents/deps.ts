import type {
  Agent,
  AgentRepository,
  AgentVersion,
  AgentVersionRepository,
  MembershipRepository,
  ProjectRepository,
} from '@devos/domain';

export type CreateAgentDraft = (agent: Agent, version: AgentVersion) => Promise<void>;

export interface AgentUseCaseDeps {
  projects: ProjectRepository;
  memberships: MembershipRepository;
  agents: AgentRepository;
  agentVersions: AgentVersionRepository;
  createDraft: CreateAgentDraft;
}
