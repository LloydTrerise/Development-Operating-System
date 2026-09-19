# Sprint 15 — Policy Engine Foundations (E22 Governance & Policy-as-Code, part 1)

**Source:** `specs/DEVOS-GOVERNANCE-AND-POLICY-AS-CODE-BACKLOG.md` §6 "Sprint 15 — Policy Engine Foundations", grounded against direct inspection of the real, current implementation (`packages/policy/src/evaluator/*.ts`, `packages/domain/src/policy/policy.ts`, `packages/database/src/repositories/policies.ts`, `packages/application/src/policy/*.ts`, `apps/api/src/routes/policies.ts`, `apps/api/src/dto/policy.ts`, `apps/web/src/pages/GovernancePage.tsx`, `apps/web/src/api-client.ts`, `packages/tools/src/gateway/invoke-tool.ts`, `packages/application/src/organisations/membership-access.ts`, `packages/domain/src/projects/authorization.ts`).
**Conversion date:** 2026-09-19
**Status:** Approved to begin (user: standing authorization for DEVOS-138 → DEVOS-148, this run).

## Goal

The POC's policy engine (`evaluatePolicies`) is a real, deterministic 4-way decision (`ALLOW`/`DENY`/`REQUIRE_APPROVAL`/`CONFLICT`) but only ever keys off four flat attributes (`action`/`actorRole`/`resourceType`/`environment`), is scoped to a single project with no inheritance, and has no authoring UI anywhere. This sprint closes those three specific gaps the backlog's §2 grounding table confirmed, without replacing the working evaluator or decision shape.

## Grounding (confirmed by direct code inspection before scoping)

- `PolicyRule.condition`/`PolicyEvaluationRequest` (`packages/policy/src/evaluator/policy-evaluation.ts`) key on exactly `actorRole`/`resourceType`/`environment`. `matchesCondition` (`evaluate-policies.ts`) checks each field only `if` present on the rule — the exact mechanism DEVOS-138 extends for new fields, not a new matching algorithm.
- Real data already resolved at the one real policy-evaluating call site (`invoke-tool.ts`): `capability.riskClass` (`ToolCapability.riskClass`, always present); `input.agentVersionId` (optional — when present, `deps.agentVersions.getById` already resolves the real `AgentVersion`, currently fetched *after* the policy-evaluation call, only for the separate DEVOS-085 capability check). No workflow-version reference reaches `invokeTool` today at all — every call site (`run-development-agent-task.ts`, `run-release-task.ts`, `run-security-scan-task.ts`, `run-validation-task.ts`) already holds a real `WorkflowRun` (`run.workflowVersionId`) in scope, confirmed by direct inspection of all seven call sites.
- `PolicyRepository` (`packages/database/src/repositories/policies.ts`) has `listForProject` only — no `listForOrganisation`. The `policies` table's `project_id` column is already nullable (confirmed: `toDomain`'s `row.project_id !== null` guard, and `Policy.projectId` is already optional in the domain type) — organisation-wide policies are schema-representable today, just never created or read.
- `createPolicy`/`publishPolicy` (`packages/application/src/policy/`) require a `ProjectId` parameter and a project membership; there is no organisation-level equivalent. Organisation-level authorization already exists and is reusable unchanged: `resolveOrganisationMembership` (`packages/application/src/organisations/membership-access.ts`) resolves a real org-level `Membership` (`projectId: null`); `canPublishPolicy`/`canUpdateOrganisation` (`packages/domain/src/projects/authorization.ts`) are both already simple `role === 'OWNER'` checks reusable for an org-scoped policy without any new authorization primitive.
- `apps/api/src/routes/organisations.ts` already establishes the exact REST shape a new `POST /organisations/:organisationId/policies` route mirrors (`GET`/`POST /organisations`, `GET`/`PATCH /organisations/:organisationId`).
- `GovernancePage.tsx` is confirmed read-only: it renders `listPoliciesForProject`'s results with no create/edit/publish form anywhere in `apps/web/src`. `apps/web/src/api-client.ts`'s `Policy` interface and `parseCreatePolicyBody`/`toPolicyDto` (`apps/api/src/dto/policy.ts`) are the exact shapes DEVOS-140's form must produce/consume — reused unchanged, not redefined.
- `AuditRecordRepository.listForProject` (`packages/domain/src/audit/audit-record.ts`) is project-scoped only, matching DEVOS-141's own narrowed acceptance ("a real, recent sample of the organisation's own AuditRecords" — read via the project-scoped lister across the org's own projects, or a new org-scoped lister; the real choice is recorded in DEVOS-141's own task file once implemented, per `AGENTS.md` §8).

## In scope (DEVOS-138–142, executed in ID order — no cross-task ordering gap found, unlike Sprint 14)

- **DEVOS-138** — real ABAC attributes (agent identity/version, workflow identity/version, risk level) added to the policy condition/request shape and wired into the one real call site (`invoke-tool.ts`).
- **DEVOS-139** — real organisation-level policy scope with mandatory-precedence inheritance over project policies.
- **DEVOS-140** — a real create/edit/publish policy authoring UI in `GovernancePage.tsx`.
- **DEVOS-141** — policy simulation against real historical `AuditRecord`s before publish.
- **DEVOS-142** — validation, documentation, and gap disclosure.

## Out of scope / deferred

Anything Sprint 16 (multi-approver, separation-of-duties, expiry, risk-tiered routing, compliance reporting/export) or E23+. Any change to the Tool Gateway's provider-adapter chain, credential broker, or identity provider. A synthetic what-if request builder for simulation (DEVOS-141 is real-historical-data only, per the backlog's own explicit narrowing).

## Sprint-wide acceptance criteria (from the backlog's own exit criteria)

A policy authored through the new UI, scoped to an organisation, keyed on a real agent-version or workflow-version attribute, is shown (via DEVOS-141) to produce the intended decision against real historical requests, then published and confirmed to actually govern a new real request end to end.

## Governance

Per `AGENTS.md` §4: one task at a time, its own validation run and reported, then the next task begins — this run carries the user's standing authorization (see the session's own start-of-run instruction) to proceed through DEVOS-138 → DEVOS-148 without pausing between tasks or between sprints. Decisions recorded directly in `DEVOS-BUILD-STATE.md`'s state-change-log as each task completes (no separate `DEVOS-SPRINT15-DECISIONS.md`, continuing the convention Sprint 11–14 already established).

## Task index

| ID        | Story                                                | File           |
| --------- | ----------------------------------------------------- | -------------- |
| DEVOS-138 | Extend policy conditions with real ABAC attributes    | `DEVOS-138.md` |
| DEVOS-139 | Real organisation-level policy scope                  | `DEVOS-139.md` |
| DEVOS-140 | Policy authoring UI                                   | `DEVOS-140.md` |
| DEVOS-141 | Policy simulation against real historical requests    | `DEVOS-141.md` |
| DEVOS-142 | Validation, documentation, and gap disclosure         | `DEVOS-142.md` |
