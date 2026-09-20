import type {
  AuditRecordRepository,
  KnowledgeReferenceRepository,
  KnowledgeSourceRepository,
  MembershipRepository,
  ProjectRepository,
} from '@devos/domain';

export interface KnowledgeUseCaseDeps {
  projects: ProjectRepository;
  memberships: MembershipRepository;
  knowledgeSources: KnowledgeSourceRepository;
  /** DEVOS-115: knowledge-source creation is audited, extending DEVOS-086's
   * coverage. */
  auditRecords: AuditRecordRepository;
  /**
   * DEVOS-184: reads DEVOS-184's real `listForSource` for
   * `getKnowledgeSourceReferences`. Optional, mirroring
   * `AgentUseCaseDeps.artifacts?`'s established pattern — a fake lacking it
   * simply reports an empty reference list, matching `getAgentQuality`'s own
   * no-op-when-absent convention.
   */
  knowledgeReferences?: KnowledgeReferenceRepository;
}
