# DEVOS-333 — `Organisation` initialisation-status shape and persistence-shape decision

**Priority:** P1
**Depends on:** None (independent of Sprint 57 per the backlog's own §7 — depends only on Sprint 56's principal/org model being unchanged, which it is).
**Depended on by:** DEVOS-334 (wiring), DEVOS-335 (verifies against the "has a policy" requirement this task defines), DEVOS-336 (validation).

## ⚠ This task carries the sprint's disclosed persistence-shape decision — see the sprint README

The backlog (`specs/DEVOS-ORGANISATION-ONBOARDING-BACKLOG.md` §9) left open whether this sprint widens `Organisation.status` or adds a new dedicated tracking table. Direct inspection of the real, current implementation found a third option is the better fit — no new persisted column or table at all; the status is computed live from three tables that are already real and already persisted. Full reasoning is in the sprint README's own "⚠ Disclosed decision" section — re-read it before implementing.

## Scope

Define the shape every reader of an organisation's initialisation status will use, and the read-only deps its computation needs — no production behavior yet (that is DEVOS-334).

## Implementation

`packages/application/src/organisations/get-organisation-initialisation-status.ts` defines:

```ts
export interface OrganisationInitialisationStatus {
  organisationId: OrganisationId;
  hasProjectType: boolean; // true once the organisation has at least one Project (every Project always carries a ProjectType, defaulted if unpicked — packages/application/src/projects/create-project.ts:24)
  hasLlmProvider: boolean; // true once the organisation has at least one organisation_llm_providers row
  hasPolicy: boolean; // true once the organisation has at least one organisation-wide (projectId null) Policy row
  initialised: boolean; // hasProjectType && hasLlmProvider && hasPolicy
}
```

`packages/application/src/organisations/deps.ts` gains a new, narrow, dedicated deps interface — not a widening of the shared `OrganisationUseCaseDeps`, per that file's own `OrganisationLlmProviderUseCaseDeps` precedent (DEVOS-321's doc comment: "not every `OrganisationUseCaseDeps` test fake needs a new field it never uses"):

```ts
export interface OrganisationInitialisationStatusDeps {
  organisations: OrganisationRepository;
  memberships: MembershipRepository;
  projects: ProjectRepository;
  organisationLlmProviders: OrganisationLlmProviderRepository;
  policies: PolicyRepository;
}
```

No migration. No change to `packages/contracts` (no new branded id or status union — `OrganisationId` already exists; the three booleans and the derived `initialised` flag are plain `boolean`, not a stored enum). No change to `packages/database` (all three underlying repositories' `listForOrganisation` methods already exist and are already implemented against real Postgres — confirmed by direct inspection, not assumed).

## Out of scope

The actual computation/wiring (DEVOS-334). The API route (DEVOS-334). Any change to `Organisation.status` itself, `createOrganisation`, or any other existing use case.

## Acceptance

`pnpm --filter @devos/application typecheck lint build` clean with the new type/interface compiling (no runtime behavior to test yet — covered by DEVOS-334's own tests, since the type has no logic of its own). Confirmed via direct inspection (recorded here, not merely asserted) that `ProjectRepository`, `OrganisationLlmProviderRepository`, and `PolicyRepository` each already expose a working `listForOrganisation(organisationId)` method requiring no change.
