# Sprint 17 — Cost Data Foundations & Visibility (E23 Cost Management, part 1)

**Source:** `specs/DEVOS-COST-MANAGEMENT-BACKLOG.md` §6 "Sprint 17 — Cost Data Foundations & Visibility", grounded against direct inspection of the real, current implementation (`packages/agents/src/pricing.ts`, `packages/agents/src/providers/gemini.ts`, `packages/database/src/repositories/agent-executions.ts`, `packages/domain/src/agents/agent-execution.ts`, `packages/application/src/tasks/run-agent-task.ts`, `packages/database/src/repositories/audit-records.ts` (DEVOS-141/147's organisation-query precedent), `apps/web/src/pages/GovernancePage.tsx`).
**Conversion date:** 2026-09-19
**Status:** Approved to begin (standing authorization for DEVOS-149 → DEVOS-157 across both Sprint 17 and Sprint 18, this run — per the user's explicit instruction to run both sprints end to end without per-task pauses).

## Goal

E22 closed governance/approvals/compliance. This sprint starts E23 (Cost Management) by closing the "no reporting surface at all" gap `specs/DEVOS-COST-MANAGEMENT-BACKLOG.md` §2 confirmed: cost stops being an internal-only number a single budget check reads, and becomes real, per-model-aware, multi-project data a human can actually query and see.

## Grounding (confirmed by direct code inspection before scoping)

- `estimateCostUsd` (`packages/agents/src/pricing.ts`) takes only `AgentInvocationUsage` — one flat global rate (`USD_PER_1K_PROMPT_TOKENS`/`USD_PER_1K_CANDIDATES_TOKENS`), no `modelReference` parameter despite the file's own header comment already describing (aspirationally, not yet implemented) a fallback-for-unrecognised-model design. `AgentInvocationResult.modelReference`/`AgentExecution.modelReference` already exist and are already recorded (DEVOS-089); `createGeminiModelAdapter` already returns `modelReference: model` (the real `request.configuration.modelRef`, e.g. `'gemini-3.6-flash'` in the existing test fixtures) — the data pricing needs already flows end to end, just unused by the pricing function itself.
- The only real call site, `runAgentTask` (`packages/application/src/tasks/run-agent-task.ts:292-293`), already has `invocation.modelReference` in scope at the exact point it calls `estimateCostUsd(invocation.usage)` — passing it through requires no new plumbing.
- `AgentExecutionRepository.sumEstimatedCostUsdForProject` (DEVOS-098) is the only existing cost query, and it is `projectId`-scoped only, with no breakdown dimension and no organisation-spanning equivalent. `AuditRecordRepository.listForOrganisation` (DEVOS-141, reused directly by DEVOS-147 rather than a client-side loop over projects) is the direct, already-proven precedent for the cross-project join `sumEstimatedCostUsdForOrganisation` needs — same `agent_executions` → `workflow_tasks` → `workflow_runs` → `projects` chain `sumEstimatedCostUsdForProject` already walks, extended one join further to `projects.organisation_id`.
- No route anywhere exposes any cost figure to a client. `GET /organisations/:organisationId/audit` (DEVOS-147, `apps/api/src/routes/audit.ts`) is the direct routing/auth precedent to mirror: `requirePrincipal` + `resolveOrganisationMembership`/the existing project-membership check, both already real and unmodified.
- `GovernancePage.tsx` is the established precedent for a cross-cutting, non-project-scoped reporting page reachable from the web app's own navigation; a new page follows the same shape rather than inventing a new one.

## Real design decisions this sprint's own grounding surfaced (recorded here, not silently assumed)

1. **Per-model pricing (DEVOS-149):** `estimateCostUsd` gains an optional second parameter, `modelReference?: string`. A new `MODEL_RATES` table (keyed by real model identifiers this codebase actually sends, e.g. `gemini-3.6-flash`) holds per-model `{ usdPer1kPromptTokens, usdPer1kCandidatesTokens }`. When `modelReference` is `undefined` or not a recognised key, the function falls back to today's existing default rate constants byte-for-byte — every existing test in `pricing.test.ts`/`gemini.test.ts` keeps passing unmodified, since none of them pass a `modelReference` today. `runAgentTask`'s call site is updated to pass `invocation.modelReference` through.
2. **Organisation cost rollup (DEVOS-150):** `sumEstimatedCostUsdForOrganisation(organisationId)` is added to `AgentExecutionRepository` as an optional method (same optionality precedent as `sumEstimatedCostUsdForProject` itself — every existing in-memory test fake is unaffected), implemented as a real join, not a loop over `listForOrganisation`-style project enumeration, per the backlog's own §7 dependency note. A second method, `costBreakdownForProject(projectId)`/`costBreakdownForOrganisation(organisationId)`, groups by agent role (joined through `agent_versions` → `agents` for the role, mirroring how role is already resolved elsewhere in this codebase) — a separate method rather than overloading the sum method, matching this codebase's existing one-query-one-method convention.
3. **Cost API surface (DEVOS-151):** new `GET /projects/:projectId/cost` and `GET /organisations/:organisationId/cost-report` routes, in a new `apps/api/src/routes/cost.ts` (mirroring `audit.ts`'s own file-per-concern convention), both `protected: true` and gated by the same membership checks `audit.ts` already establishes. Response shape: `{ totalUsd, breakdownByRole: [{ role, totalUsd }] }`.
4. **Cost dashboard UI (DEVOS-152):** a new dedicated `CostPage.tsx` (not a `GovernancePage.tsx` section — cost is not a governance/compliance concept, and `GovernancePage.tsx` is already multi-section; a new nav-reachable page keeps each page's own scope legible, the choice this task's own acceptance summary explicitly leaves to be recorded during implementation). Renders the current project's total + role breakdown, the organisation's total + role breakdown (if the user can see more than one project in that organisation), and a real budget-vs-actual indicator reusing `Project.budgetUsd` (DEVOS-098, unmodified).
5. **Validation (DEVOS-153):** full monorepo validation; any new gap found (e.g. an organisation with zero cost data, a project with no `budgetUsd` configured) recorded here rather than silently special-cased away.

## In scope (DEVOS-149–153, executed in ID order)

- **DEVOS-149** — real per-model cost estimation.
- **DEVOS-150** — organisation-level and breakdown cost queries.
- **DEVOS-151** — real cost API surface.
- **DEVOS-152** — cost dashboard UI.
- **DEVOS-153** — validation, documentation, and gap disclosure.

## Out of scope / deferred

Budget _controls_ beyond the existing one-time alert (Sprint 18's own scope). Tool-invocation cost tracking and cost-aware agent selection (both deferred to the proposed, not-yet-scoped Sprint 19, per the backlog's own §6/§9). Any change to the Tool Gateway, credential broker, or identity provider.

## Sprint-wide acceptance criteria (from the backlog's own exit criteria)

A real organisation's real accumulated spend across more than one of its projects is shown correctly in the new dashboard, broken down by agent role, using a per-model rate rather than one flat global rate.

## Governance

Per `AGENTS.md` §4 and this run's standing authorization: proceeding through DEVOS-149 → DEVOS-157 (both Sprint 17 and Sprint 18) without per-task pauses. Decisions recorded directly in `DEVOS-BUILD-STATE.md`'s state-change-log as each task completes, continuing the convention Sprint 11–16 already established.

## Task index

| ID        | Story                                         | File           |
| --------- | --------------------------------------------- | -------------- |
| DEVOS-149 | Real per-model cost estimation                | `DEVOS-149.md` |
| DEVOS-150 | Organisation-level and breakdown cost queries | `DEVOS-150.md` |
| DEVOS-151 | Real cost API surface                         | `DEVOS-151.md` |
| DEVOS-152 | Cost dashboard UI                             | `DEVOS-152.md` |
| DEVOS-153 | Validation, documentation, and gap disclosure | `DEVOS-153.md` |
