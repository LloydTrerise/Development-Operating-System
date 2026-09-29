# DEVOS-334 — Wire real completion detection to the three existing subsystems

**Priority:** P1
**Depends on:** DEVOS-333 (shape/deps).
**Depended on by:** DEVOS-336 (validation); Sprint 59 (server-side enforcement will call this sprint's new read per mutating request, per the sprint README's own forward note).

## Scope

Implement `getOrganisationInitialisationStatus`, computing each of the three requirements from real writes to the tables that already back them — not a separate, disconnected manual checklist a user (or a future implementer) could satisfy without actually doing the thing — plus a minimal, read-only API route so the result is genuinely live-verifiable against real Postgres, not just unit-testable.

## Implementation

`packages/application/src/organisations/get-organisation-initialisation-status.ts`:

```ts
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
```

Authorization reuses `resolveOrganisationMembership` (`packages/application/src/organisations/membership-access.ts`) unchanged — any member of the organisation (not just an admin) can read this status, mirroring its own doc comment's named precedent for read-only org-wide visibility routes (cost/audit/engineering-report reads, policy listing). A non-member (or a nonexistent organisation) receives the same masked `NotFoundError('Organisation')` `getOrganisationForPrincipal` already uses, so this read never leaks an organisation's existence to a non-member.

`apps/api/src/routes/organisation-initialisation.ts` (new file, mirroring `organisation-llm-providers.ts`'s one-file-per-resource, narrow-deps convention):

```ts
export function createOrganisationInitialisationRoutes(
  prefix: string,
  deps: OrganisationInitialisationStatusDeps,
): Route[] {
  return [
    {
      method: 'GET',
      pattern: `${prefix}/organisations/:organisationId/initialisation-status`,
      protected: true,
      handler: async ({ principal, params }) => {
        const user = requirePrincipal(principal);
        return getOrganisationInitialisationStatus(
          deps,
          user.id,
          params.organisationId as OrganisationId,
        );
      },
    },
  ];
}
```

`apps/api/src/app.ts` gains: the new type import, a new `organisationInitialisationStatusDeps?: OrganisationInitialisationStatusDeps` field on `CreateAppOptions`, a construction block placed after `policyDeps` (reusing `organisationDeps.organisations`, `projectDeps.memberships`, `projectDeps.projects`, `organisationLlmProviderDeps.organisationLlmProviders`, and `policyDeps.policies` — all already-constructed instances, no new repository construction), and one new route-registration line.

## Out of scope

Any enforcement of `initialised` against any mutating route (Sprint 59). Any UI (Sprint 60). Any change to how `Project`/`OrganisationLlmProvider`/`Policy` are created.

## Acceptance

`pnpm --filter @devos/application typecheck lint test build` clean, with new tests proving: an organisation with none of the three requirements reports all `false` and `initialised: false`; an organisation with exactly one, two, then all three requirements reports the correct incremental booleans and only reports `initialised: true` once all three are present; a non-member is rejected (masked as `NotFoundError`); a nonexistent organisation is rejected the same way. `apps/api` typecheck/lint/test/build clean, with a route-level test confirming the same outcomes through a real HTTP request shape. Live-verified against real Postgres in DEVOS-336 that completing each of the three requirements, and only all three together, flips a real organisation's reported status to `initialised: true`.
