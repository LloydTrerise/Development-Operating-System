# DEVOS-311 — `organisation_llm_providers` table, migration

**Priority:** P1
**Depends on:** None (candidate epic E30's first sprint).
**Depended on by:** DEVOS-312 (credential namespace confirmation), Sprint 53 (real per-task resolution), Sprint 54 (fallback chain and UI).

## Scope

A real, dormant table holding one organisation's own ranked list of LLM provider credentials — `organisation_id` (FK), `provider` (discriminator string), `credential_reference`, `priority` (rank, unique per org), `status` (`ACTIVE`/`DISABLED`), timestamps. No row required to exist; an organisation with none keeps today's platform-default behavior. Zero change to any existing route, use case, or the worker's own boot-time adapter construction.

## Implementation

Migration `0059_organisation_llm_providers.ts` creates `organisation_llm_providers`:

- `id` (uuid PK), `organisation_id` (uuid FK → `organisations.id`, `ON DELETE CASCADE`, applied proactively per migrations `0054`/`0058`'s own disclosed lesson), `provider` (text), `credential_reference` (text), `priority` (integer), `status` (text), `created_at`/`updated_at` (timestamptz).
- A composite unique constraint on `(organisation_id, priority)` — the real, database-enforced form of "priority is unique per org," not left to application-layer discipline, mirroring migration `0052`'s own "push the real invariant into the database" precedent.
- An index on `organisation_id` for the real query Sprint 53/54 will run (`listForOrganisation`, ordered by `priority`).

`packages/contracts/src/ids.ts` adds `OrganisationLlmProviderId`; `packages/contracts/src/status.ts` adds `organisationLlmProviderStatuses`/`OrganisationLlmProviderStatus` (`ACTIVE`/`DISABLED`, matching `IntegrationStatus`'s identical two-state shape). `packages/domain/src/organisations/organisation-llm-provider.ts` defines `OrganisationLlmProvider`/`OrganisationLlmProviderRepository` (`getById`, `listForOrganisation` ordered by priority ascending, `create` — deliberately no update/reorder/delete yet, mirroring `JobRoleRepository`'s own "foundation sprint" minimal shape; Sprint 54 is the first sprint that actually needs to mutate a row). `packages/database/src/repositories/organisation-llm-providers.ts` implements it. No seed-time backfill and no chokepoint wired into `createOrganisationRepository.create()` — unlike `job_roles`/`agent_profiles`/`principals`, this table has no "every organisation must have one" invariant; it is genuinely optional per organisation.

## Out of scope

Credential resolution / `CredentialResolver` (DEVOS-312). Any route, use case, or UI (Sprint 54). Update/reorder/delete repository methods. Any change to `apps/worker`'s boot-time adapter construction (Sprint 53).

## Acceptance

`pnpm --filter @devos/contracts build`; `pnpm --filter @devos/domain build`; `pnpm --filter @devos/database typecheck lint test build` clean. A fresh migration creates the table with the documented shape and constraints; zero existing route, use case, or worker behavior changes (confirmed by the full monorepo/e2e suites re-running at their existing baseline — see `DEVOS-313.md`).

## Actual results

Implemented as planned. `pnpm --filter @devos/contracts build`, `pnpm --filter @devos/domain build`, `pnpm --filter @devos/database typecheck lint test build` all clean. Live-verified against real Postgres: `\d organisation_llm_providers` confirmed the exact documented column shape, the `organisation_llm_providers_org_priority_key` unique constraint, the `organisation_llm_providers_organisation_id_idx` index, and the `ON DELETE CASCADE` FK to `organisations.id`. Full details of the live CRUD/constraint proof are in `DEVOS-313.md`.
