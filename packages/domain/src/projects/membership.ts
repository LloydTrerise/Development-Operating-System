import type { MembershipId, OrganisationId, ProjectId } from '@devos/contracts';

export const membershipRoles = ['OWNER', 'MEMBER'] as const;
export type MembershipRole = (typeof membershipRoles)[number];

export interface Membership {
  id: MembershipId;
  organisationId: OrganisationId;
  projectId: ProjectId | null;
  principalId: string;
  role: MembershipRole;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface MembershipRepository {
  getById: (id: MembershipId) => Promise<Membership | null>;
  getForPrincipalAndProject: (
    principalId: string,
    projectId: ProjectId,
  ) => Promise<Membership | null>;
  listForPrincipal: (principalId: string) => Promise<Membership[]>;
  listForProject: (projectId: ProjectId) => Promise<Membership[]>;
  /** DEVOS-254: org-level (`projectId: null`) memberships only — the rows
   * organisation-scoped membership management actually manages, not every
   * project-level membership within the organisation too. Optional,
   * matching this codebase's established "additive repository method, real
   * implementation only where needed" convention (e.g.
   * `AgentExecutionRepository.sumEstimatedCostUsdForProject`) — every one
   * of the ~20 other `MembershipRepository` fakes across this codebase
   * never exercises organisation-scoped membership and is unaffected. */
  listForOrganisation?: (organisationId: OrganisationId) => Promise<Membership[]>;
  create: (membership: Membership) => Promise<void>;
  updateRole: (id: MembershipId, role: MembershipRole, updatedAt: string) => Promise<void>;
  remove: (id: MembershipId) => Promise<void>;
}
