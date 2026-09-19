import type { OrganisationId } from '@devos/contracts';

export interface Organisation {
  id: OrganisationId;
  name: string;
  slug: string;
  status: string;
  /**
   * DEVOS-155: mirrors `Project.budgetUsd`'s own additive, optional
   * pattern exactly — no budget configured means no threshold to check
   * against, not a zero budget.
   */
  budgetUsd?: number;
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
  budgetUsd?: number;
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
