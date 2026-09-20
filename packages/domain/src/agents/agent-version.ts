import type {
  AgentConfiguration,
  AgentId,
  AgentVersionId,
  AgentVersionStatus,
  OrganisationId,
  ProjectId,
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
  /**
   * DEVOS-177: an additive, organisation-scoped sharing flag — never
   * crosses organisations (ADR-SEC-005). Optional, mirroring
   * `Project.budgetUsd`'s own additive-optional-field pattern: absent (or
   * `false`) means not shared, not a "shared: false but distinct from
   * unset" state. Only settable on a `PUBLISHED` version by a project
   * `OWNER` (`shareAgentVersion`). The real Postgres column is
   * `NOT NULL DEFAULT false`; every row read back from the database always
   * has a real `boolean` value here.
   */
  sharedAcrossOrganisation?: boolean;
}

export interface AgentVersionRepository {
  getById: (id: AgentVersionId) => Promise<AgentVersion | null>;
  getByAgentAndVersion: (agentId: AgentId, version: number) => Promise<AgentVersion | null>;
  getLatestForAgent: (agentId: AgentId) => Promise<AgentVersion | null>;
  listForAgent: (agentId: AgentId) => Promise<AgentVersion[]>;
  create: (version: AgentVersion) => Promise<void>;
  publish: (id: AgentVersionId, publishedAt: string) => Promise<void>;
  /** DEVOS-177: flips the real, organisation-scoped sharing flag on an existing (real, `PUBLISHED`) version. */
  setSharedAcrossOrganisation?: (id: AgentVersionId, shared: boolean) => Promise<void>;
  /**
   * DEVOS-178: a real `agent_versions` ⋈ `agents` ⋈ `projects` join,
   * mirroring `listAuditRecordsForOrganisation`/`sumEstimatedCostUsdForOrganisation`'s
   * own real-join, never-a-client-loop precedent (a third instance) —
   * every real version shared across this organisation's own projects,
   * with enough of its owning `Agent`/`Project` context to render an
   * install picker.
   */
  listSharedForOrganisation?: (organisationId: OrganisationId) => Promise<SharedAgentVersion[]>;
}

/** DEVOS-178: one real shared, installable agent version, with its owning agent/project context. */
export interface SharedAgentVersion extends AgentVersion {
  agentKey: string;
  agentName: string;
  sourceProjectId: ProjectId;
}
