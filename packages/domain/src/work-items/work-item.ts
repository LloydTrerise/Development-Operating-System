import type { ProjectId, WorkItemId } from '@devos/contracts';

export interface WorkItem {
  id: WorkItemId;
  projectId: ProjectId;
  externalRef?: string;
  title: string;
  description?: string;
  type: string;
  status: string;
  priority: string;
  source?: string;
  metadata: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWorkItemInput {
  title: string;
  description?: string;
  externalRef?: string;
  type?: string;
  priority?: string;
  source?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateWorkItemInput {
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  metadata?: Record<string, unknown>;
}

export interface WorkItemRepository {
  getById: (id: WorkItemId) => Promise<WorkItem | null>;
  listForProject: (projectId: ProjectId) => Promise<WorkItem[]>;
  create: (workItem: WorkItem) => Promise<void>;
  update: (id: WorkItemId, changes: UpdateWorkItemInput, updatedAt: string) => Promise<void>;
}
