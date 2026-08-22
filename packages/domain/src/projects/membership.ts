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
  create: (membership: Membership) => Promise<void>;
  updateRole: (id: MembershipId, role: MembershipRole, updatedAt: string) => Promise<void>;
  remove: (id: MembershipId) => Promise<void>;
}
