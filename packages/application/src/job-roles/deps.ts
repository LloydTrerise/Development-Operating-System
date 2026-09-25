import type {
  AuditRecordRepository,
  JobRoleRepository,
  MembershipRepository,
  OrganisationRepository,
  PrincipalJobRoleRepository,
  ProjectMemberJobRoleRepository,
  ProjectRepository,
} from '@devos/domain';

/**
 * DEVOS-299/300/301 (Sprint 49): job roles span both scopes (organisation-
 * held `PRINCIPAL_JOB_ROLE`, project-active `PROJECT_MEMBER_JOB_ROLE`), so
 * this deps interface carries both `organisations` and `projects` rather
 * than narrowing to one, mirroring `OrganisationUseCaseDeps`'s/
 * `ProjectUseCaseDeps`'s own shape.
 */
export interface JobRoleUseCaseDeps {
  organisations: OrganisationRepository;
  projects: ProjectRepository;
  memberships: MembershipRepository;
  jobRoles: JobRoleRepository;
  principalJobRoles: PrincipalJobRoleRepository;
  projectMemberJobRoles: ProjectMemberJobRoleRepository;
  auditRecords: AuditRecordRepository;
}
