import type {
  Agent,
  AgentRepository,
  AgentVersion,
  AgentVersionRepository,
  AuditRecordRepository,
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
  /** DEVOS-086: agent version publish is audited. */
  auditRecords: AuditRecordRepository;
}
