# DEVOS-321 — Organisation settings UI — "AI Providers" panel

**Priority:** P1
**Depends on:** DEVOS-320 (the gate every write use case applies).
**Depended on by:** DEVOS-322 (live-verifies this panel's own routes end to end).

## Scope

Add/remove/reorder providers, a credential-reference field (never displays a resolved secret, per `AGENTS.md` §22 — see README's disclosed correction on what "masked" means here), an active/disabled toggle. Mirrors `OrganisationsPage.tsx`'s existing membership-management UI conventions.

## Implementation

### Domain (`packages/domain/src/organisations/organisation-llm-provider.ts`)

`OrganisationLlmProviderRepository` gains:

- `update: (id: OrganisationLlmProviderId, changes: Partial<Pick<OrganisationLlmProvider, 'credentialReference' | 'status'>>, updatedAt: string) => Promise<void>` — deliberately excludes `priority` (see README's disclosed reorder-only design).
- `delete: (id: OrganisationLlmProviderId) => Promise<void>`.

### Database (`packages/database/src/repositories/organisation-llm-providers.ts`)

- `update`/`delete` added to `createOrganisationLlmProviderRepository`, following `create`'s own existing column-mapping shape.
- A new, separate exported primitive (not a repository method, mirroring `close-work-item.ts`'s established pattern): `export type ReorderOrganisationLlmProviders = (organisationId: OrganisationId, orderedIds: OrganisationLlmProviderId[], updatedAt: string) => Promise<void>` and `createOrganisationLlmProviderReorderer(db: Kysely<Database>): ReorderOrganisationLlmProviders`, implemented via `withTransaction`: phase 1 assigns each row a unique negative `priority` (`-(index + 1)`); phase 2 assigns each row its final `priority` (`index + 1`) in the caller's given order — no two rows ever share a `priority` value at any intermediate step, so the non-deferred unique constraint never fires. Rows not present in `orderedIds` (should not happen if the caller always submits the organisation's full current set) are left untouched; a mismatched set throws a clear `ValidationError` from the use case layer, not this primitive.

### Application (`packages/application/src/organisations/`)

- `deps.ts`'s `OrganisationUseCaseDeps` — considered widening directly, rejected: only the new LLM-provider use cases need this repository, and every existing `OrganisationUseCaseDeps` test fake would otherwise need a new field. A new, narrower `OrganisationLlmProviderUseCaseDeps` (`organisations`, `memberships`, `organisationLlmProviders: OrganisationLlmProviderRepository`, `reorderOrganisationLlmProviders: ReorderOrganisationLlmProviders` — the latter declared locally in this same deps file, not imported from `@devos/database`, mirroring `tasks/deps.ts`'s own established `RecordContextManifest`/`PublishArtifact` boundary precedent) is used instead, the same narrowing `OrganisationMembershipAccessDeps`/`JobRoleUseCaseDeps` already established for their own scopes.
- `list-organisation-llm-providers.ts` — read, gated via `resolveOrganisationMembership` (DEVOS-320).
- `create-organisation-llm-provider.ts` — write, gated via `resolveOrganisationAdminMembership`/`canUpdateOrganisation`; validates `provider` is a registered `LlmProviderKey` (`@devos/agents`, already a dependency of this package) and `credentialReference` is non-empty; computes the next `priority` as `max(existing priorities) + 1` (or `1` if none exist) — the client never sends a `priority`; writes an audit record (`organisation_llm_provider.created`, `targetId: provider.id` — a real surrogate uuid exists on this table, unlike the composite-key-only join tables Sprint 49 had to work around).
- `update-organisation-llm-provider.ts` — write, gated the same way; updates `credentialReference`/`status` only; audits `organisation_llm_provider.updated`.
- `delete-organisation-llm-provider.ts` — write, gated the same way; audits `organisation_llm_provider.deleted`.
- `reorder-organisation-llm-providers.ts` — write, gated the same way; validates the submitted `orderedIds` is exactly the organisation's current full set (same length, same ids, no duplicates) before calling the transactional primitive, throwing `ValidationError` otherwise; audits `organisation_llm_provider.reordered` with the new order in `metadata`.

### API (`apps/api/src/routes/organisation-llm-providers.ts`, new; `apps/api/src/dto/organisation-llm-provider.ts`, new)

- `GET /organisations/:organisationId/llm-providers`
- `POST /organisations/:organisationId/llm-providers` — body `{ provider, credentialReference }`
- `PATCH /organisations/:organisationId/llm-providers/:providerId` — body `{ credentialReference?, status? }`
- `DELETE /organisations/:organisationId/llm-providers/:providerId`
- `POST /organisations/:organisationId/llm-providers/reorder` — body `{ orderedIds: string[] }`

`apps/api/src/app.ts` gains an `organisationLlmProviderDeps` construction (mirroring `jobRoleDeps`'s own placement) and registers the new routes alongside `createOrganisationRoutes`/`createJobRoleRoutes`.

### Web (`apps/web/src/api-client.ts`, `apps/web/src/features/organisations/OrganisationsPage.tsx`)

- Five new client wrapper functions mirroring `listOrganisationMembers`/`addOrganisationMember`/`removeOrganisationMember`'s own existing shape.
- A new `AiProvidersPanel` component, structurally mirroring `MembersPanel` exactly (list/add/remove, loading/error state, a `busyId` guard) plus: a status toggle chip per row (`ACTIVE`/`DISABLED`, click to flip via `update`), and move-up/move-down icon buttons per row that compute the new full order client-side from current state and call the `reorder` endpoint. Added as a second `Collapse` toggle on `OrganisationRow`, alongside the existing Members toggle, gated to render its own add/remove/reorder affordances only when `isCurrentUserOwner` — mirroring `MembersPanel`'s own `isCurrentUserOwner`-gated "Transfer ownership" action, since `canUpdateOrganisation` grants `OWNER`/`ORGANISATION_ADMIN` and this page has no separate `ORGANISATION_ADMIN`-vs-`OWNER` distinction surfaced client-side yet (the server-side gate is authoritative regardless; the client-side hide is a UX nicety, not the security boundary, per this codebase's own established client/server gating split).

## Out of scope

Any change to `Membership`'s own role model. A separate organisation-wide "AI Providers" page (this panel lives on the existing `OrganisationsPage.tsx` row, per the backlog's own explicit instruction to mirror that page's conventions).

## Acceptance

`pnpm --filter @devos/domain`/`@devos/database`/`@devos/application`/`@devos/api`/`@devos/web` build/typecheck/lint/test all clean. Real tests: repository round-trip (create/update/delete/reorder, including a reorder that would collide under a naive single-pass update); use-case tests for each of the five operations, including a `MEMBER` rejection and a wrong-organisation rejection; route-level tests mirroring `app.test.ts`'s existing job-roles coverage shape.

## Actual results

Implemented as planned. See `DEVOS-322.md` for full validation, live verification, and gap disclosure.
