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
  /**
   * DEVOS-339 (Sprint 59, candidate epic E31 part 4): set once, by that
   * sprint's own backfill migration, for every organisation that already
   * existed before server-side initialisation enforcement went live — never
   * set for any organisation created afterward. A categorically different
   * fact from `INITIALISED` itself (Sprint 58): this never changes once set,
   * and is consulted only by `requireOrganisationInitialised` as an
   * up-front bypass — `getOrganisationInitialisationStatus`'s own live
   * computation never reads it and is completely unaffected by it.
   */
  initialisationEnforcementExemptAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrganisationInput {
  name: string;
  slug: string;
  /**
   * DEVOS-330 (Sprint 57, candidate epic E31): the disclosed reversal of
   * this codebase's previously ungated `organisation.create` design (see
   * `create-organisation.ts`'s own doc comment) — a valid, unredeemed,
   * unexpired registration token a platform operator issued
   * (`issueRegistrationToken`, DEVOS-331) is now required to create an
   * organisation. The raw value only, never a hash — `createOrganisation`
   * hashes it itself before lookup.
   */
  registrationToken: string;
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
