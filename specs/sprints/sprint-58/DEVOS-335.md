# DEVOS-335 — Organisation-wide policy creation — verification, not new construction

**Priority:** P1
**Depends on:** DEVOS-333/334 (defines the "has a policy" requirement this task verifies against).
**Depended on by:** DEVOS-336 (validation).

## ⚠ This task's backlog premise is disclosed as stale — see the sprint README

The backlog (`specs/DEVOS-ORGANISATION-ONBOARDING-BACKLOG.md` §2.9/§6.3) frames this task as widening "the existing project-scoped-only `Policy` creation path... to also support a real organisation-wide (`projectId: null`) policy." Direct inspection at conversion time found this already exists completely, end-to-end, predating this epic (DEVOS-139, Sprint 15) — full detail in the sprint README's own "⚠ Disclosed correction" section. This task's real scope is confirming that already-existing mechanism genuinely, verifiably satisfies DEVOS-334's `hasPolicy` detection — not building anything new.

## Scope

Verify, with real evidence (not assumption), that:

1. `createOrganisationPolicy` (`packages/application/src/policy/create-organisation-policy.ts`) creates a real `Policy` row with `projectId` absent and `organisationId` set.
2. `PolicyRepository.listForOrganisation` (`packages/database/src/repositories/policies.ts:79-89`) — the exact method DEVOS-334's `getOrganisationInitialisationStatus` calls — genuinely returns that row (its `WHERE project_id IS NULL` filter matches what `createOrganisationPolicy` writes).
3. The existing route (`POST ${prefix}/organisations/:organisationId/policies`) and the existing UI (`PolicyAuthoringForm`'s "This project's organisation" scope, `GovernancePage.tsx`) already let a real user create this row through the full stack today, with no code change required.

## Implementation

No new production code. If direct inspection under DEVOS-334's own implementation surfaces any actual gap (e.g. a mismatch between what `createOrganisationPolicy` writes and what `listForOrganisation`'s filter expects), it is fixed here and disclosed as a real, found bug — not assumed away. (Anticipated: none — both were already grounded against real source in the sprint README before this task began.)

## Out of scope

Any new policy-creation UI or API surface. Any change to `PolicyAuthoringForm`, `GovernancePage.tsx`, `createOrganisationPolicy`, or the existing policy routes.

## Acceptance

A test (new or already-existing and merely re-confirmed) proves an organisation with a real organisation-wide `Policy` row is detected by `getOrganisationInitialisationStatus`'s `hasPolicy: true`, and one with only project-scoped policies (no organisation-wide row) is not. Live-verified against real Postgres in DEVOS-336 as part of the same end-to-end proof that flips a real organisation to `initialised: true`.
