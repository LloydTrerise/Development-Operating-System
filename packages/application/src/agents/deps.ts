import type {
  Agent,
  AgentProfileRepository,
  AgentRepository,
  AgentVersion,
  AgentVersionRepository,
  ArtifactRepository,
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
  /**
   * DEVOS-309 (Sprint 51 reconciliation): optional, matching `artifacts?`'s
   * own established convention below — absence only narrows
   * `createNewAgentVersion`'s accountable-owner exception away (it still
   * always enforces the mandatory role-based `canManageAgent` check
   * regardless), it never silently disables the gate itself, unlike Sprint
   * 50's `workItemAssignments` (deliberately required there for the
   * opposite reason — see that field's own doc comment).
   */
  agentProfiles?: AgentProfileRepository;
  /**
   * DEVOS-174: reads DEVOS-163's real `listEvidenceForProject` for the
   * per-agent-version quality signal. Optional, matching every other
   * repository extension this codebase adds after a use-case's own initial
   * shape — a fake lacking it (or an artifact repository lacking the
   * optional `listEvidenceForProject` method itself) simply reports an
   * empty quality result, matching `getProjectEngineeringReport`'s own
   * established no-op-when-absent convention.
   */
  artifacts?: ArtifactRepository;
}
