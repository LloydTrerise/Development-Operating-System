# DEVOS-139 — Real organisation-level policy scope

**Priority:** P0 | **Estimate:** 3d
**Depends on:** None (independent of DEVOS-138 — different axis of the same `Policy`/`evaluatePolicies` surface).
**Depended on by:** DEVOS-140 (authoring UI needs an org-scope option), DEVOS-146 (Sprint 16, risk-tier table is naturally organisation-scoped configuration).

## Scope

`Policy` gains a real, usable organisation-wide scope (the schema/domain type already allow a null `projectId` — today nothing ever creates or reads one), with Core Platform spec §14's mandatory precedence rule enforced: a project-scoped rule cannot turn an organisation-mandatory `DENY`/`REQUIRE_APPROVAL` into `ALLOW` for the same action.

## Implementation

- New `PolicyRepository.listForOrganisation(organisationId)` (`packages/database/src/repositories/policies.ts`): selects `policies` rows where `project_id IS NULL` and `organisation_id = :organisationId`, same shape/ordering convention as `listForProject`.
- New `createOrganisationPolicy(deps, principalId, organisationId, input)` (`packages/application/src/policy/create-organisation-policy.ts`): mirrors `createPolicy` exactly (draft-versioning-by-key rule, `ValidationError` on an existing unpublished draft) but resolves authorization via `resolveOrganisationMembership` + `canPublishPolicy(membership.role)`-gated create (matching this codebase's existing precedent that draft creation itself is not always OWNER-gated at project scope — confirmed by re-reading `createPolicy`, which requires no role check at all today; this task keeps that same asymmetry: draft creation only requires organisation membership, `publishPolicy` remains the OWNER-gated step). Needs a new `PolicyRepository.getLatestForOrganisationAndKey` (mirroring `getLatestForProjectAndKey`) to compute the next version number and detect an existing draft.
- `publishPolicy` (`packages/application/src/policy/publish-policy.ts`) already branches on `policy.projectId !== undefined`; extended so an organisation-scoped policy (`projectId === undefined`) resolves authorization via `resolveOrganisationMembership` instead of `resolveMembership`, unchanged otherwise (same OWNER gate, same audit-record shape, `projectId` omitted from the audit record when organisation-scoped — `AuditRecord.projectId` is already optional).
- New route `POST /organisations/:organisationId/policies` (`apps/api/src/routes/policies.ts` or a new file, following `organisations.ts`'s exact pattern) and `GET /organisations/:organisationId/policies`.
- **Precedence enforcement** — the real new logic, not just plumbing: a new `resolveEffectivePolicies(organisationPolicies, projectPolicies)` (or equivalent, in `packages/policy` or `packages/application`) is called by the two real production call sites (`invoke-tool.ts`, `decide-approval.ts`) in place of their current bare `deps.policies.listForProject(projectId)` call. It concatenates both lists for `evaluatePolicies`'s existing `latestPublishedPerKey`/match logic to operate over unchanged, **except**: if an organisation policy's own matched rule for the request's `action` is `DENY` or `REQUIRE_APPROVAL`, and any project policy's own matched rule for the same `action` would resolve to `ALLOW`, the organisation's stricter effect wins (the mandatory-precedence rule) rather than surfacing a `CONFLICT` — a real, disclosed, minimal interpretation of "a lower-level configuration must not weaken a higher-level mandatory policy," scoped to exactly the two effects the spec names as mandatory-strength ("weaken" only ever means turning `DENY`/`REQUIRE_APPROVAL` into something less strict). Two org policies or two project policies disagreeing with each other are unaffected by this rule and still surface `CONFLICT` exactly as `evaluatePolicies` already does.

## Out of scope

A general N-level policy hierarchy (only organisation → project, per the spec's own two real levels evaluated here — resource/invocation-level policy scope is not schema-representable anywhere in this codebase and stays out of scope). Retrofitting `decide-approval.ts`'s policy check with DEVOS-138's new ABAC attributes (DEVOS-138's own disclosed narrowing) — this task only changes *which* policies are gathered, not what they're evaluated against.

## Acceptance

A real organisation-scoped policy (`DENY` on some action) and a real, differently-scoped project policy (`ALLOW` on the same action) are both published against real Postgres; a real `evaluatePolicies`-driven decision (via the new `resolveEffectivePolicies`) for that action resolves to the organisation's `DENY`, not the project's `ALLOW` — proven by a new unit test and confirmed against real Postgres via `invoke-tool.ts`'s real call path. Every existing `evaluate-policies.test.ts`/`invoke-tool` test continues to pass unmodified (no organisation policy present in any of them, so `resolveEffectivePolicies` degrades to today's exact project-only behaviour).
