import type {
  AgentConfiguration,
  AgentId,
  AgentVersionId,
  AgentVersionStatus,
} from '@devos/contracts';

export interface AgentVersion {
  id: AgentVersionId;
  agentId: AgentId;
  version: number;
  status: AgentVersionStatus;
  configuration: AgentConfiguration;
  promptReference?: string;
  /**
   * Not present in specs/database/poc-database-schema.md §9.2's documented
   * agent_versions columns (unlike workflow_versions, which does have
   * created_by) — added as an explicit, flagged assumption (see DEVOS-025's
   * task report) so agent-version creation can be attributed for audit,
   * consistent with every other create/publish action in this codebase.
   */
  createdBy: string;
  publishedAt?: string;
  createdAt: string;
}

export interface AgentVersionRepository {
  getById: (id: AgentVersionId) => Promise<AgentVersion | null>;
  getByAgentAndVersion: (agentId: AgentId, version: number) => Promise<AgentVersion | null>;
  getLatestForAgent: (agentId: AgentId) => Promise<AgentVersion | null>;
  listForAgent: (agentId: AgentId) => Promise<AgentVersion[]>;
  create: (version: AgentVersion) => Promise<void>;
  publish: (id: AgentVersionId, publishedAt: string) => Promise<void>;
}
