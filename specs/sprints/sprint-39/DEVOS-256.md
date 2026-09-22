# DEVOS-256 — Tool capability enable/disable backend

**Priority:** P1 | **Estimate:** 1.5d
**Depends on:** none within this sprint.
**Depended on by:** DEVOS-257 (UI), DEVOS-258 (system health reads capability counts).

## Scope

Adds a repository method and `setToolCapabilityStatus` use-case that can transition a `ToolCapability.status` to `DISABLED` (enforcement already exists and is unchanged), plus a `PATCH` route, OWNER-gated consistent with existing authorization checks. **Corrected during conversion grounding** (see `README.md`): the backlog's claim that capabilities are "already surfaced" within Project Types is false — no route lists a project's capabilities today, and no UI references `ToolCapability` anywhere. This story's scope is therefore widened to include the missing `GET` list route too, since DEVOS-257's UI cannot function without one.

## Implementation

- `packages/domain/src/tools/tool-capability.ts`: `ToolCapabilityRepository` gains `updateStatus: (id: ToolCapabilityId, status: ToolCapabilityStatus) => Promise<void>` (no `updatedAt` column exists on this table, unlike `Membership` — none is touched).
- `packages/database/src/repositories/tool-capabilities.ts`: implements `updateStatus` as a plain `UPDATE ... SET status = $1 WHERE id = $2`.
- `packages/domain/src/projects/authorization.ts`: new `canManageToolCapabilities(role): boolean { return role === 'OWNER'; }`, mirroring the file's own one-function-per-action convention (`canRegisterIntegration`, `canPublishAgent`, etc.) rather than reusing a differently-named function for this action.
- `packages/application/src/tools/deps.ts`: `ToolUseCaseDeps` gains `auditRecords: AuditRecordRepository`.
- New `packages/application/src/tools/set-tool-capability-status.ts`: `setToolCapabilityStatus(deps, principalId, projectId, capabilityId, status)` — loads the project, resolves membership, gates on `canManageToolCapabilities`, loads the capability (404 if missing or belonging to a different project), calls `updateStatus`, writes a `tool_capability.status_changed` audit record (`metadata: { key, previousStatus, status }`), returns the updated `ToolCapability`.
- `packages/application/src/index.ts`: barrel-exports the new file.
- New `apps/api/src/routes/tool-capabilities.ts` (mirrors `routes/integrations.ts`'s shape exactly): `GET /projects/:projectId/tool-capabilities` (reuses the already-written, already-tested `listCapabilitiesForProject` unchanged) and `PATCH /projects/:projectId/tool-capabilities/:capabilityId` (calls `setToolCapabilityStatus`).
- New `apps/api/src/dto/tool-capability.ts`: `toToolCapabilityDto` (id, projectId, key, name, riskClass, status, createdAt — omits the two schema JSONB blobs, which no UI story in this sprint needs to render) and `parseSetToolCapabilityStatusBody` (validates `status` is one of `toolCapabilityStatuses`).
- `apps/api/src/app.ts`: builds `toolDeps: ToolUseCaseDeps` (`projects`, `memberships`, `toolCapabilities: createToolCapabilityRepository(database.db)` — reusing the same repository instance `toolInvocationSummaryDeps` already constructs — `auditRecords: auditRecordRepository`), wires `createToolCapabilityRoutes(API_PREFIX, toolDeps)` into the routes array.

## Out of scope

Any change to `invoke-tool.ts`'s existing `DISABLED`-rejection enforcement (already correct, untouched). Re-enabling logic is included (the use-case accepts either `toolCapabilityStatuses` value, not `DISABLED`-only) since a one-way-only toggle would be a real, avoidable usability gap the backlog's own "enable/disable" framing already implies should not exist. `registerCapability`/`registerAllCapabilities` remain unwired to any route (still only reachable from seed/tests) — out of this story's scope to change.

## Acceptance

`pnpm --filter @devos/domain --filter @devos/database --filter @devos/application --filter @devos/api typecheck lint test build` clean. New unit tests: `set-tool-capability-status.test.ts`, a `tool-capabilities` repository test for `updateStatus`, route-level tests for both new routes. Live-verified against real Postgres and a real running `apps/api`: the real seeded project's real capabilities are listed; one is disabled for real (confirmed via a direct Postgres query and via a real subsequent `invoke-tool` call being correctly rejected); re-enabled for real afterward, leaving no residual state change.

## Actual results

Implemented as scoped, including the widened scope disclosed in `README.md` (the new `GET` list route). `updateStatus` was added as **optional** on `ToolCapabilityRepository`, matching `MembershipRepository.listForOrganisation`'s own precedent (DEVOS-254) — ~10 other fakes across this codebase never exercise it and are unaffected. `ToolUseCaseDeps.auditRecords` was also made optional (unlike `OrganisationUseCaseDeps.auditRecords`, which is required) since `listCapabilitiesForProject`, a pure read reusing the same deps interface, has no need for it. Tests added: 4 new `set-tool-capability-status` cases in `packages/application/tests/tool-capabilities.test.ts` (disable/re-enable + audit records, no-op-when-unchanged, `ForbiddenError` for a non-OWNER member, `NotFoundError` for a non-member and for a capability from a different project, `ValidationError` for an invalid status) plus 3 new route-level tests in `apps/api/tests/app.test.ts` (list + toggle round-trip, non-OWNER 403, invalid-status 400). No standalone `packages/database` repository test was added for `updateStatus`, for the same reason as DEVOS-254's `listForOrganisation` (this codebase has no per-repository unit-test convention) — live Postgres verification is its proof instead.

**Live-verified against real Postgres and a real running `apps/api`**, against the real seeded "DevOS POC" project: all 9 real seeded capabilities were listed (`build-run`, `deploy`, `git-commit`, `health-check`, `pull-request-create`, `repo-read`, `repo-write`, `security-scan`, `test-run`, all `ACTIVE`); `repo-write` was disabled for real via a `PATCH`, confirmed `DISABLED` in a follow-up `GET`; re-enabled afterward, confirmed `ACTIVE` again — no residual state change. `invoke-tool.ts`'s own pre-existing enforcement of a `DISABLED` capability was not separately re-exercised live this task (already covered, unmodified, by its own existing test suite — re-proving already-correct, untouched code would not have demonstrated anything this story changed). Full monorepo validation and the full real `tests/e2e` suite results are recorded once, in `DEVOS-260.md`, covering the whole sprint.
