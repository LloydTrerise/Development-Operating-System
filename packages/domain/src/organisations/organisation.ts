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
  /**
   * DEVOS-290: the single, transferable owner among the organisation's
   * `ORGANISATION_ADMIN` co-admin pool (`packages/application/src/
   * organisations/transfer-organisation-ownership.ts`) — `undefined` only
   * for the theoretical case migration `0048`'s own backfill found no
   * principal to assign (disclosed there, not expected against real data).
   */
  ownerPrincipalId?: string;
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
  /** DEVOS-290: transferring ownership only ever changes this one column —
   * a separate, narrow method rather than folding it into `update`'s
   * general `UpdateOrganisationInput`, since it carries its own distinct
   * authorization rule (transferable only by the current owner). */
  setOwnerPrincipalId: (
    id: OrganisationId,
    ownerPrincipalId: string,
    updatedAt: string,
  ) => Promise<void>;
}
