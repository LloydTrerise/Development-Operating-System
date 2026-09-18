import type { MembershipRepository, OrganisationRepository } from '@devos/domain';

export interface OrganisationUseCaseDeps {
  organisations: OrganisationRepository;
  memberships: MembershipRepository;
}
