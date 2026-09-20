import type {
  ArtifactRepository,
  MembershipRepository,
  OrganisationRepository,
  ProjectRepository,
  ProjectTypeRepository,
  WorkItemRepository,
} from '@devos/domain';

/**
 * DEVOS-164/169: mirrors `CostUseCaseDeps`/`AuditUseCaseDeps`'s exact shape
 * (project/organisation membership resolution) plus the repositories this
 * use case actually reads from — `artifacts` (DEVOS-163's new type-filtered
 * queries), `workItems` (DEVOS-163's new rework-cycle aggregation, and
 * DEVOS-169's incident-recovery proxy), and `projectTypes` (DEVOS-169: to
 * resolve a project's `ProjectType.key`, scoping the incident-recovery
 * proxy to Incident Response projects only — a plain key check, not a
 * seed-constant import, since `@devos/application` cannot depend on
 * `@devos/database`).
 */
export interface EngineeringIntelligenceUseCaseDeps {
  projects: ProjectRepository;
  memberships: MembershipRepository;
  organisations: OrganisationRepository;
  artifacts: ArtifactRepository;
  workItems: WorkItemRepository;
  projectTypes: ProjectTypeRepository;
}
