# DEVOS-141 — Policy simulation against real historical requests

**Priority:** P1 | **Estimate:** 2d
**Depends on:** DEVOS-138 (the ABAC attributes a simulated rule may key on), DEVOS-140 (the draft-authoring surface this is offered from).

## Scope

Before publishing a policy (draft state), an author can run it against a real, recent sample of the organisation's own `AuditRecord`s (already-captured real tool-invocation/approval decisions) and see what decision (`ALLOW`/`DENY`/`REQUIRE_APPROVAL`/`CONFLICT`) it would have produced for each — Security spec §53's "policy simulation before deployment," deliberately narrowed to real historical data rather than a synthetic what-if engine.

## Real design decision (recorded here, not silently assumed)

`AuditRecordRepository` (`packages/domain/src/audit/audit-record.ts`) has `listForProject` only, no organisation-scoped lister. Per this sprint's own README grounding, this task adds `AuditRecordRepository.listForOrganisation(organisationId, limit?)` (a direct `organisation_id = :organisationId` query, mirroring `listForProject`'s own shape) rather than looping every project's own `listForProject` client-side — the organisation is already a first-class column on every `AuditRecord` row (confirmed: `AuditRecord.organisationId` is required, not derived), so a direct query is the real, already-supported shape, not a workaround.

A `tool_invocation.*`-category `AuditRecord`'s `metadata` carries `capability` (the real action key an `evaluatePolicies` call was keyed on) but not the full original request's `actorRole`/`resourceType`/`environment`/riskClass/agent/workflow attributes verbatim — confirmed by direct inspection of `invoke-tool.ts`'s `audit()` closure. This task's simulation therefore reconstructs a best-effort `PolicyEvaluationRequest` from what each audit record actually carries (`action` from `metadata.capability` or the record's own `action` field stripped of its `tool_invocation.`/`policy.`/`approval.` prefix; `agentId`/`agentVersion` from `metadata.agentVersionId` if present, resolved via `AgentVersionRepository`) — a real, disclosed approximation, not a claim that every original request attribute is replayed byte-for-byte.

## Implementation

- New `packages/application/src/policy/simulate-policy.ts`: `simulatePolicy(deps, principalId, policyId, options?: { limit?: number })` — loads the draft `Policy`, resolves membership/authorization the same way `getPolicyForPrincipal` already does, loads up to `limit` (default 50) recent `AuditRecord`s for the policy's own organisation (or project, if project-scoped) via the new lister, reconstructs a best-effort request per record, and calls the real, unmodified `evaluatePolicies` (extended with the policy being simulated **prepended** to whatever policies would otherwise apply, so the simulation shows the effect of adding this specific draft) for each — returning `{ auditRecordId, request, decision }[]`.
- New route `GET /policies/:policyId/simulate` (`apps/api/src/routes/policies.ts`).
- New `apps/web/src/api-client.ts` function `simulatePolicy(policyId)`, surfaced in `GovernancePage.tsx`'s authoring form (DEVOS-140) as a "Preview against recent activity" action shown only while the policy is still `DRAFT`, rendering each simulated decision next to the original audit record's own actual outcome.

## Out of scope

A synthetic/hypothetical request builder (explicitly deferred per the backlog). Simulating against another organisation's audit records (tenant isolation, ADR-SEC-005 — `simulatePolicy` only ever reads the policy's own organisation's records).

## Acceptance

A real draft policy with a `DENY` rule on a real, already-exercised action is simulated against real Postgres `AuditRecord`s; the response correctly shows `DENY` for every matching historical record and the previously-actual (`ALLOW`) outcome alongside it for comparison — proving the simulation reflects what the new rule *would* have done, verified against a real dataset, not a fixture.
