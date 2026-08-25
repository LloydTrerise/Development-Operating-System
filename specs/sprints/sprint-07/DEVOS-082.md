# DEVOS-082 — Harden RBAC

**Priority:** P0 | **Estimate:** 1d
**Depends on:** Sprint 6 complete (working end-to-end workflow).

## Scope

"Project/org roles and sensitive operations" (source, verbatim). Today `MembershipRole = 'OWNER' | 'MEMBER'` (`packages/domain/src/projects/membership.ts`) already has centralized helpers in `packages/domain/src/projects/authorization.ts` (`canManageMembers`, `canUpdateProject`), but several sensitive use cases instead compare `membership.role !== 'OWNER'` inline rather than going through a shared helper — confirmed by inspection of `packages/application/src/approval/decide-approval.ts` and other approval/policy/integration use cases. This task centralizes those checks through the existing authorization module (extending it with new named predicates as needed — e.g. `canDecideApproval`, `canPublishPolicy`, `canRegisterIntegration`) rather than inventing a new role model. No richer role model (reviewer, security-admin, etc.) is specified anywhere in the spec corpus, so none is introduced.

## Grounding

`specs/constitution/devos-engineering-constitution.md` Principle 6 ("Security Is Outside the Model") requires authorization to be enforced by software outside the model — this task strengthens that enforcement's consistency, not its existence (Sprint 3's `authorization.ts` already exists). `specs/api/poc-api-contracts.md` §41 requires server-side authorization on every endpoint.

## Flagged gap

No spec enumerates every "sensitive operation" that must be centrally checked. Scope is bounded to operations that already have an ad hoc `role !== 'OWNER'`-style literal check today (grep-confirmed before implementation), so this task closes a real, existing inconsistency rather than inventing new restrictions.

## Acceptance

Every sensitive operation identified above is authorized through a named helper in `packages/domain/src/projects/authorization.ts`, not an inline literal. Unit tests cover both the allow and deny path for each helper. No existing test regresses.
