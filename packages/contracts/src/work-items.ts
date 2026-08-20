import type { ProjectId, WorkItemId } from "./ids.js";
import type { WorkItemStatus } from "./status.js";

export interface WorkItem {
  id: WorkItemId;
  projectId: ProjectId;
  externalRef?: string;
  title: string;
  description?: string;
  status: WorkItemStatus;
  source: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWorkItemRequest {
  title: string;
  description?: string;
  externalRef?: string;
  source: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateWorkItemRequest {
  title?: string;
  description?: string;
  externalRef?: string;
  status?: WorkItemStatus;
  metadata?: Record<string, unknown>;
}
