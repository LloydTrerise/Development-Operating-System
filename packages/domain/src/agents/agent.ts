import type { AgentId, ProjectId } from '@devos/contracts';

export interface Agent {
  id: AgentId;
  projectId: ProjectId;
  key: string;
  name: string;
  description?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgentRepository {
  getById: (id: AgentId) => Promise<Agent | null>;
  getByProjectAndKey: (projectId: ProjectId, key: string) => Promise<Agent | null>;
  listForProject: (projectId: ProjectId) => Promise<Agent[]>;
  create: (agent: Agent) => Promise<void>;
}
