import type { ProjectId, WorkflowId } from '@devos/contracts';

export interface WorkflowDefinition {
  id: WorkflowId;
  projectId: ProjectId;
  key: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowDefinitionRepository {
  getById: (id: WorkflowId) => Promise<WorkflowDefinition | null>;
  getByProjectAndKey: (projectId: ProjectId, key: string) => Promise<WorkflowDefinition | null>;
  listForProject: (projectId: ProjectId) => Promise<WorkflowDefinition[]>;
  create: (definition: WorkflowDefinition) => Promise<void>;
  /**
   * DEVOS-261: real Postgres full-text search over `name`/`description`,
   * mirroring `KnowledgeSourceRepository.searchForProject`'s (DEVOS-187)
   * exact pattern. Optional, matching this codebase's established
   * additive-method convention for repository extensions added after a
   * repository's own initial interface.
   */
  searchForProject?: (projectId: ProjectId, query: string) => Promise<WorkflowDefinition[]>;
}
