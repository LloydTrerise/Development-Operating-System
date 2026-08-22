import type { KnowledgeSourceId, ProjectId } from '@devos/contracts';

/**
 * A reusable Knowledge Item, project-scoped (specs/architecture/domain-model.md
 * §8.1: engineering standards, architecture guidance, organisational
 * policies, design patterns, domain knowledge, lessons learned, reusable
 * procedures). Named "KnowledgeSource" — not "Knowledge Item" — because
 * specs/workflows/software-change-workflow.md §28 is the one place in the
 * spec corpus that literally says "resolve approved knowledge sources";
 * there is no database table anywhere in specs/database/poc-database-schema.md
 * for this concept, so this shape is an implementation-level choice, not a
 * spec-mandated one (see specs/sprints/sprint-03/DEVOS-039.md).
 */
export interface KnowledgeSource {
  id: KnowledgeSourceId;
  projectId: ProjectId;
  key: string;
  name: string;
  sourceType: string;
  content: string;
  status: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeSourceRepository {
  getById: (id: KnowledgeSourceId) => Promise<KnowledgeSource | null>;
  getByProjectAndKey: (projectId: ProjectId, key: string) => Promise<KnowledgeSource | null>;
  listForProject: (projectId: ProjectId) => Promise<KnowledgeSource[]>;
  create: (source: KnowledgeSource) => Promise<void>;
}
