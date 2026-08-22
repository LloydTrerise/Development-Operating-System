import type { OrganisationId } from '@devos/contracts';

export interface Organisation {
  id: OrganisationId;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrganisationRepository {
  getById: (id: OrganisationId) => Promise<Organisation | null>;
}
