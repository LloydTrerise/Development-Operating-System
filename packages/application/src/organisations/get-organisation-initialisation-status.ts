import type { OrganisationId } from '@devos/contracts';
import { NotFoundError } from '../errors.js';
import type { OrganisationInitialisationStatusDeps } from './deps.js';
import { resolveOrganisationMembership } from './membership-access.js';

/**
 * DEVOS-333/334 (Sprint 58, candidate epic E31 part 3): per this sprint's
 * own disclosed persistence-shape decision (`specs/sprints/sprint-58/
 * README.md`), none of these four fields is a stored value anywhere —
 * `hasProjectType`/`hasLlmProvider`/`hasPolicy`/`initialised` are all
 * computed live, every call, from the three tables that already back them.
 * There is nothing here for a future writer to accidentally leave stale.
 */
export interface OrganisationInitialisationStatus {
  organisationId: OrganisationId;
  /** True once the organisation has at least one `Project` — every `Project`
   * always carries a `ProjectType` (defaulted to the seeded
   * `SOFTWARE_DEVELOPMENT_PROJECT_TYPE_ID` when the caller doesn't pick one,
   * `packages/application/src/projects/create-project.ts:24`), so "has this
   * organisation touched a `ProjectType`" and "does this organisation have a
   * `Project`" are the same real fact. */
  hasProjectType: boolean;
  /** True once the organisation has at least one `organisation_llm_providers` row. */
  hasLlmProvider: boolean;
  /** True once the organisation has at least one organisation-wide
   * (`projectId` absent) `Policy` row — `PolicyRepository.listForOrganisation`
   * already filters to exactly these (`packages/database/src/repositories/
   * policies.ts:79-89`). */
  hasPolicy: boolean;
  initialised: boolean;
}

/**
 * Read-only — introduces no enforcement (Sprint 59's own scope) and no new
 * migration. Authorization mirrors `getOrganisationForPrincipal`'s own
 * masked-404 pattern via `resolveOrganisationMembership` (the established
 * "read-only org-wide visibility" check its own doc comment names policy
 * listing and cost/audit/engineering reports as precedent for) — any member
 * of the organisation may read this, not only an admin, since a future
 * guided setup flow (Sprint 60) needs any member completing setup to see
 * real progress.
 */
export async function getOrganisationInitialisationStatus(
  deps: OrganisationInitialisationStatusDeps,
  principalId: string,
  organisationId: OrganisationId,
): Promise<OrganisationInitialisationStatus> {
  const organisation = await deps.organisations.getById(organisationId);
  if (!organisation) throw new NotFoundError('Organisation');

  const membership = await resolveOrganisationMembership(deps, principalId, organisationId);
  if (!membership) throw new NotFoundError('Organisation');

  const [projects, llmProviders, policies] = await Promise.all([
    deps.projects.listForOrganisation(organisationId),
    deps.organisationLlmProviders.listForOrganisation(organisationId),
    deps.policies.listForOrganisation(organisationId),
  ]);

  const hasProjectType = projects.length > 0;
  const hasLlmProvider = llmProviders.length > 0;
  const hasPolicy = policies.length > 0;

  return {
    organisationId,
    hasProjectType,
    hasLlmProvider,
    hasPolicy,
    initialised: hasProjectType && hasLlmProvider && hasPolicy,
  };
}
