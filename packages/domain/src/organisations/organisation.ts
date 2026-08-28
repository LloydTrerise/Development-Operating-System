import type { OrganisationId } from '@devos/contracts';

export interface Organisation {
  id: OrganisationId;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrganisationInput {
  name: string;
  slug: string;
}

export interface UpdateOrganisationInput {
  name?: string;
  status?: string;
}

export interface OrganisationRepository {
  getById: (id: OrganisationId) => Promise<Organisation | null>;
  list: () => Promise<Organisation[]>;
  create: (organisation: Organisation) => Promise<void>;
  update: (
    id: OrganisationId,
    changes: UpdateOrganisationInput,
    updatedAt: string,
  ) => Promise<void>;
}
