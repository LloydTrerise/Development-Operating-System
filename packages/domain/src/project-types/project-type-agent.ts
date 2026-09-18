import type { AgentConfiguration, ProjectTypeAgentId, ProjectTypeId } from '@devos/contracts';

export interface ProjectTypeAgent {
  id: ProjectTypeAgentId;
  projectTypeId: ProjectTypeId;
  key: string;
  name: string;
  configuration: AgentConfiguration;
  promptReference?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectTypeAgentInput {
  key: string;
  name: string;
  configuration: AgentConfiguration;
  promptReference?: string;
}

export interface UpdateProjectTypeAgentInput {
  name?: string;
  configuration?: AgentConfiguration;
  promptReference?: string;
}

export interface ProjectTypeAgentRepository {
  getById: (id: ProjectTypeAgentId) => Promise<ProjectTypeAgent | null>;
  getByProjectTypeAndKey: (
    projectTypeId: ProjectTypeId,
    key: string,
  ) => Promise<ProjectTypeAgent | null>;
  listForProjectType: (projectTypeId: ProjectTypeId) => Promise<ProjectTypeAgent[]>;
  create: (agent: ProjectTypeAgent) => Promise<void>;
  update: (
    id: ProjectTypeAgentId,
    changes: UpdateProjectTypeAgentInput,
    updatedAt: string,
  ) => Promise<void>;
}
