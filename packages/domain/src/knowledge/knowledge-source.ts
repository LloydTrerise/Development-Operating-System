import type { KnowledgeSourceId, OrganisationId, ProjectId } from '@devos/contracts';

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
  /**
   * DEVOS-188: an additive, organisation-scoped sharing flag — never
   * crosses organisations (ADR-SEC-005). Optional, mirroring
   * `AgentVersion.sharedAcrossOrganisation?` exactly: absent (or `false`)
   * means not shared. The real Postgres column is `NOT NULL DEFAULT false`;
   * every row read back from the database always has a real `boolean` here.
   */
  sharedAcrossOrganisation?: boolean;
}

/**
 * DEVOS-182: closes the create-only gap this table has had since Sprint 3 —
 * mirrors `UpdateProjectInput`'s exact "only defined fields change" shape.
 * `status` is included here (not a separate method) since archiving
 * (DEVOS-182) and editing content (also DEVOS-182) are the same real
 * mechanism — a plain field update — not two different operations at the
 * repository layer.
 */
export interface UpdateKnowledgeSourceInput {
  name?: string;
  content?: string;
  sourceType?: string;
  status?: string;
}

export interface KnowledgeSourceRepository {
  getById: (id: KnowledgeSourceId) => Promise<KnowledgeSource | null>;
  getByProjectAndKey: (projectId: ProjectId, key: string) => Promise<KnowledgeSource | null>;
  listForProject: (projectId: ProjectId) => Promise<KnowledgeSource[]>;
  create: (source: KnowledgeSource) => Promise<void>;
  /** DEVOS-182: edits and archives (`status: 'ARCHIVED'`) share this one real update path. */
  update: (
    id: KnowledgeSourceId,
    changes: UpdateKnowledgeSourceInput,
    updatedAt: string,
  ) => Promise<void>;
  /**
   * DEVOS-187: a real Postgres full-text search over `name`/`content`,
   * scoped to the project's `ACTIVE` sources — optional, mirroring
   * `AgentVersionRepository.setSharedAcrossOrganisation?`'s own
   * optional-and-additive pattern, so every existing test fake for this
   * interface stays valid unchanged. Never embeddings/semantic search (see
   * `specs/DEVOS-KNOWLEDGE-PLATFORM-BACKLOG.md` §10) — real keyword
   * relevance only, ranked by `ts_rank`.
   */
  searchForProject?: (projectId: ProjectId, query: string) => Promise<KnowledgeSource[]>;
  /**
   * DEVOS-188: an additive, organisation-scoped sharing flag — never
   * crosses organisations (ADR-SEC-005). Optional, mirroring
   * `AgentVersionRepository.setSharedAcrossOrganisation?` exactly.
   */
  setSharedAcrossOrganisation?: (id: KnowledgeSourceId, shared: boolean) => Promise<void>;
  /**
   * DEVOS-189: a real `knowledge_sources` ⋈ `projects` join, mirroring
   * `AgentVersionRepository.listSharedForOrganisation?`'s own real-join,
   * never-a-client-loop precedent (a fourth instance) — every real source
   * shared across this organisation's own projects, with enough of its
   * owning `Project` context to render an install picker.
   */
  listSharedForOrganisation?: (organisationId: OrganisationId) => Promise<SharedKnowledgeSource[]>;
}

/** DEVOS-189: one real shared, installable knowledge source, with its owning project context. */
export interface SharedKnowledgeSource extends KnowledgeSource {
  sourceProjectId: ProjectId;
  sourceProjectName: string;
}
