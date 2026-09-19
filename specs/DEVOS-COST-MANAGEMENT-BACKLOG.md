# DevOS Cost Management Backlog

**Document:** E23 (Cost Management) Backlog & Sprint Plan
**Version:** 1.0
**Status:** Approved and COMPLETE — the user approved this document's own proposed Sprint 17/18 split as-is ("You can go ahead. Run through each sprint end to end without asking for my approval.", 2026-09-19); both Sprint 17 (DEVOS-149–153) and Sprint 18 (DEVOS-154–157) are now COMPLETE with real evidence (see `DEVOS-BUILD-STATE.md`'s 2026-09-19 (Sprint 17)/(Sprint 18) state-change-log entries). Sprint 19 (§6/§9 below) has since been scoped as its own document, `specs/DEVOS-AGENT-SELECTION-BACKLOG.md` (2026-09-19) — see that document's §1 for a correction to this document's own §2/§9 agent-selection rows, made stale by role-based routing having already shipped before this document was written.
**Predecessor:** `specs/DEVOS-POST-POC-BACKLOG-AND-SPRINT-PLAN.md` §5/§10, which named E23 but explicitly left it "not yet scoped" pending the E19 gate. `specs/DEVOS-GOVERNANCE-AND-POLICY-AS-CODE-BACKLOG.md` (E22) is now itself COMPLETE (`DEVOS-BUILD-STATE.md`, Sprint 16 entry plus the 2026-09-19 "gap revisit" follow-up). This document is the next theme in source §41's own listed order (Workflow Expansion → Workflow Designer → Governance → **Cost** → ...), produced the same way that document was produced for E20/E21/E22, but does not itself authorize starting Sprint 17 (see Status above and §11 below).
**Task-ID authority:** Continues the real, continuous numbering used by `specs/sprints/sprint-01`–`sprint-16`, `specs/DEVOS-POST-POC-BACKLOG-AND-SPRINT-PLAN.md`, `specs/DEVOS-WORKFLOW-EXPANSION-AND-DESIGNER-BACKLOG.md`, and `specs/DEVOS-GOVERNANCE-AND-POLICY-AS-CODE-BACKLOG.md` (`DEVOS-001`–`DEVOS-148`), starting at `DEVOS-149`.

---

## 1. Purpose

`Analysis/DevOS_POC_Product_Backlog_and_Sprint_Plan_v1.0.docx` §41 ("Post-POC Roadmap Themes") lists Cost fourth, with the one-line scope "Model/tool budgets, attribution, optimisation." `specs/DEVOS-POST-POC-BACKLOG-AND-SPRINT-PLAN.md` §10 carried this into E23 as "real spend attribution/optimization beyond today's alert-only budget check (`DEVOS-098`)." This document turns that one line into real epics, stories and sprints — the same way `DEVOS-WORKFLOW-EXPANSION-AND-DESIGNER-BACKLOG.md` did for E20/E21 and `DEVOS-GOVERNANCE-AND-POLICY-AS-CODE-BACKLOG.md` did for E22.

As with Governance, there is no single dedicated pre-POC baseline spec for this theme (there was no `DevOS_16_Cost_Specification`). Four existing pre-POC baseline specs each name this theme's future scope explicitly and are treated as authoritative inputs here, not re-derived from scratch:

- `Analysis/DevOS_02_Detailed_Functional_Specification_v1.0.docx` — §3.2 ("Future Scope": *"Enterprise cost optimisation"*), §36 ("Future Functional Capabilities": *"Advanced cost and token management"*).
- `Analysis/DevOS_04_Technical_Architecture_Specification_v1.0.docx` — its own maturity-phase table places "Governance, cost, analytics, policy" together in "Phase 7 — Enterprise," and its non-functional table names "Availability/cost" as a real provider-dependency concern.
- `Analysis/DevOS_06_Agent_Framework_Specification_v1.0.docx` — §9 (Agent Selection Algorithm: *"Apply optional performance/cost preferences"*), its Selection Criteria table (*"Cost: Budget tier"*), its Execution Record table (*"Usage: Cost analysis"*), AG-NFR-009 (*"Execution limits must prevent uncontrolled loops/cost"*), and §43/44 ("Future": *"Model routing based on quality/cost/latency"*).
- `Analysis/DevOS_08_Tool_and_Integration_Framework_Specification_v1.0.docx` — §38's Tool Health/Metrics table (*"Usage/cost: Economics where available"*).
- `Analysis/DevOS_10_Core_Platform_and_Control_Plane_Specification_v1.0.docx` — §52 ("Explicitly Deferred": *"Advanced billing/cost engine"*), §53 ("Future Capabilities": *"Platform cost controls"*).

All five predate the POC by design and all point at the same gap: the POC built only a single-model, flat-rate cost estimate and a one-time, project-scoped, alert-only budget check, explicitly deferring the richer attribution/reporting/control model these specs already describe. This document is the reconciliation: what those specs originally called for, against what Sprints 1–16 actually built, scoped into buildable stories.

---

## 2. Grounding — confirmed against the real, current implementation

Per `AGENTS.md` §7/§8, this section states what is actually true today, verified by direct code inspection, not assumed from the original specs' aspirational scope.

| Concept | Original spec intent | Current reality (verified) |
| --- | --- | --- |
| Token/usage capture | Agent Framework §"Execution Record": *"Usage: Record token/usage data where available"* | Real per-execution `usage`/`estimatedCostUsd` is captured today (DEVOS-089 — `packages/domain/src/agents/agent-execution.ts`, migration `0026`), but only ever populated by the real Gemini adapter (`packages/agents/src/providers/gemini.ts`). The deterministic `FixtureModelAdapter` used by every e2e/regression test populates neither field — expected, not a bug, and disclosed as such at the time. |
| Cost estimation model | Functional spec §36 ("Advanced cost and token management"); Agent Framework's "cost policy"/"budget tier" selection criteria | `estimateCostUsd` (`packages/agents/src/pricing.ts`) applies a single flat USD-per-1,000-token rate to every execution's `promptTokens`/`candidatesTokens`, regardless of `modelReference`. `AgentExecution.modelReference` and `AgentInvocationResult.modelReference` both already exist and are recorded, but the pricing function never reads either — one disclosed, approximate rate for one model family, no multi-model table at all. |
| Budget threshold | Core Platform spec §53 ("Platform cost controls"); §52 explicitly defers "Advanced billing/cost engine" | `Project.budgetUsd` (DEVOS-098 — `packages/domain/src/projects/project.ts`, migration `0027`) is a single optional per-**project** threshold. `maybeAlertOnBudgetExceeded` (`packages/application/src/tasks/run-agent-task.ts`) fires exactly one `project.budget_exceeded` audit record the first time accumulated cost crosses it and never again — no earlier warning tier, no organisation-level budget, no automatic spend cutoff (a deliberate, disclosed non-goal, not an oversight). |
| Cost visibility / reporting | Functional spec §36; source backlog's own E23 one-liner: *"Model/tool budgets, attribution, optimisation"* | `sumEstimatedCostUsdForProject` (`packages/database/src/repositories/agent-executions.ts`) is real, correct SQL, but it is only ever called internally by the budget-check above — **no API route returns it, and no UI page renders a project or organisation cost total.** The only place a human sees any cost figure today is a single task's own `estimatedCostUsd` inside `RunsPage.tsx`'s per-run agent-execution-summary list (DEVOS-036) — a per-task number, not a rollup, and not searchable/filterable/exportable. |
| Cross-project / organisation aggregation | Core Platform spec's Organisation-as-tenant-boundary; DEVOS-147 already proved the pattern for audit records | No `AgentExecutionRepository` method aggregates across projects or organisations today. DEVOS-147's `listAuditRecordsForOrganisation` (E22, Sprint 16) is the direct, already-proven precedent for exactly this kind of cross-project query inside one organisation — nothing analogous exists for cost yet. |
| Tool-invocation cost | Tool & Integration spec §38: *"Usage/cost: Economics where available"* | `ToolInvocation` (`packages/domain/src/tools/tool-invocation.ts`) records no cost/usage field at all. More importantly: none of this codebase's real provider integrations (GitHub PRs, Render deployment, Vault credentials, Auth0 OIDC — DEVOS-104–108) expose a real, queryable per-call cost figure today. The spec's own qualifier — "where available" — is, in practice, "not available" for every real provider this codebase actually calls. |
| Cost-aware agent selection | Agent Framework §9 (Agent Selection Algorithm: *"Apply optional performance/cost preferences"*); Selection Criteria table (*"Cost: Budget tier"*) | **Corrected 2026-09-19 — see `specs/DEVOS-AGENT-SELECTION-BACKLOG.md` §1.** `apps/worker/src/agent-task-router.ts` already dispatches by the resolved agent version's real `configuration.role` (commit `a0086e2`, closing `DEVOS-PRODUCTION-READINESS-ROADMAP.md` gap G1) — DEVOS-038's own verification-debt entry describing hardcoded-key routing is stale, not current fact. The real remaining gap is narrower: `agentRef` is still a single literal 1:1 key with nothing to choose *among* — there is no selection *algorithm*, because no task has ever had more than one candidate agent to consider. That precondition is scoped separately in `specs/DEVOS-AGENT-SELECTION-BACKLOG.md`, still with no cost/performance preference (no real data exists for one). |

**Conclusion this backlog is built on:** the raw ingredient — real per-execution token usage and a real (if approximate, single-model) cost estimate — is genuinely real, the same way E22 found the policy/audit *capture* mechanism already solid. What's missing is exactly what the source backlog's own one-liner names: (a) accurate multi-model cost estimation, (b) **any** visible reporting/rollup surface at all, project- or organisation-scoped, (c) a richer, tiered budget control beyond a single one-time project-scoped alert, and (d) real attribution by workflow/agent/work item rather than a flat per-task number nobody can search. Tool-invocation cost and cost-aware agent selection are both named in the pre-POC specs but have no real underlying data source in this codebase today — no real provider bills anything, and agent selection has no algorithm to extend a preference onto. This backlog closes the four gaps that have real data behind them; it names the two that don't as explicit non-goals (§9) rather than fabricating numbers or building an algorithm with nothing to select between.

---

## 3. Delivery Principles (carried forward, `DEVOS-POST-POC-BACKLOG-AND-SPRINT-PLAN.md` §2 / prior epic backlogs §3, still correct)

- Prioritise closing the specific, named gaps in §2 above over speculative generality — extend the real `AgentExecution.estimatedCostUsd`/`Project.budgetUsd` mechanism that already works, do not replace it with a new billing subsystem.
- Never present an estimate as an authoritative billing figure (DEVOS-089's own disclosed convention) — every new rate/table this epic adds stays labelled as an approximation, the same way the existing one is.
- Respect tenant isolation (Security spec ADR-SEC-005) — any organisation-level cost rollup aggregates across an organisation's own projects, never across organisations, mirroring DEVOS-147's own real precedent exactly.
- Every sprint ends with demonstrable functionality, verified for real (real Postgres, a real dev-server run, a real crossed threshold producing a real visible alert) — not simulated.
- No automatic spend cutoff/enforcement anywhere in this epic — DEVOS-098's own explicit design choice (audit-visible alert, not a payment/throttling system) carries forward unchanged; richer budgets stay alert-only.

---

## 4. Priority Model (unchanged, carried forward)

| Priority | Meaning |
| --- | --- |
| P0 | Blocks the epic's own stated outcome entirely |
| P1 | Required for a credible, demonstrable MVP of the epic |
| P2 | Real value, deferrable to a later sprint without blocking the epic's own acceptance |

---

## 5. Epic Map

| Epic | Outcome | Priority | Sprint | Story detail |
| --- | --- | --- | --- | --- |
| E23 | Cost Management — accurate multi-model cost estimation, real project- and organisation-level cost visibility/reporting, richer tiered budget controls, and real spend attribution by workflow/agent/work item | P1 | 17–18 | §6 below |

---

## 6. Product Backlog — E23 Cost Management

### Sprint 17 — Cost Data Foundations & Visibility

| ID | Story | Est. | Pri | Acceptance summary |
| --- | --- | --- | --- | --- |
| DEVOS-149 | Real per-model cost estimation | 2d | P0 | `estimateCostUsd` (`packages/agents/src/pricing.ts`) gains a `modelReference` parameter and a real, disclosed-approximate per-model rate table (keyed by the actual model identifiers `packages/agents/src/providers/gemini.ts` sends), falling back to today's single default rate for any unrecognised reference — byte-for-byte identical output for the one model in production use today, proven by re-running every existing `pricing.test.ts`/`gemini.test.ts` case unmodified. |
| DEVOS-150 | Organisation-level and breakdown cost queries | 3d | P0 | `AgentExecutionRepository` gains `sumEstimatedCostUsdForOrganisation` (joining `agent_executions` → `workflow_tasks` → `workflow_runs` → `projects`, mirroring DEVOS-147's own real cross-project join pattern) and a real cost-breakdown query grouped by project and agent role — the first cost query in the product that spans multiple projects within one organisation, matching §7's own flagged precedent. |
| DEVOS-151 | Real cost API surface | 2d | P0 | New `GET /projects/:projectId/cost` and `GET /organisations/:organisationId/cost-report` routes expose DEVOS-150's totals/breakdown plus the pre-existing `sumEstimatedCostUsdForProject` — today unreachable from any client — with the same membership/tenant checks every other project/organisation-scoped route already enforces. |
| DEVOS-152 | Cost dashboard UI | 3d | P1 | A new "Cost" view (a dedicated page or a new section alongside `GovernancePage.tsx`'s own established pattern — decide during implementation, record the choice) renders real project and organisation totals, a real breakdown by agent role, and a real budget-vs-actual indicator against DEVOS-098's existing `budgetUsd` — the first place a human can see rollup cost data anywhere in the product, closing the "no reporting surface at all" gap §2 confirmed. |
| DEVOS-153 | Validation, documentation, and gap disclosure | 1d | P1 | Full monorepo `pnpm turbo run typecheck lint test build` green; any real gap the new pricing table/queries/routes/UI surfaces recorded in this document's own decision log, not silently patched or hidden. |

**Sprint objective:** cost stops being an internal-only number one budget check reads and becomes real, visible, multi-model-aware data a human can actually query and see.
**Exit criteria:** a real organisation's real accumulated spend across more than one of its projects is shown correctly in the new dashboard, broken down by agent role, using a per-model rate rather than one flat global rate.

### Sprint 18 — Budget Controls & Attribution

| ID | Story | Est. | Pri | Acceptance summary |
| --- | --- | --- | --- | --- |
| DEVOS-154 | Tiered, recurring budget alerts | 2d | P0 | `maybeAlertOnBudgetExceeded`'s single one-time-crossing alert becomes a real, configurable multi-tier mechanism (e.g. a "warning" threshold below 100% plus the existing hard-crossing alert), each tier firing its own distinct, real audit record exactly once per crossing — still audit-only, no automatic cutoff, extending rather than replacing DEVOS-098's proven mechanism. |
| DEVOS-155 | Organisation-level budget | 2d | P0 | `Organisation` gains an optional `budgetUsd` (mirroring `Project.budgetUsd`'s own additive, optional pattern exactly), checked against DEVOS-150's real organisation cost rollup through the same tiered-alert mechanism as DEVOS-154 — closing the Core Platform spec's own named "platform cost controls" gap at the tenant level, not just per-project. |
| DEVOS-156 | Attribution by workflow and work item | 2d | P1 | DEVOS-150's breakdown query and DEVOS-152's dashboard both gain a further grouping by workflow definition and work item (not only agent role), so a real user can see which workflow type or which piece of work is actually expensive — the real "attribution" half of the source backlog's own "spend attribution/optimization" one-liner. |
| DEVOS-157 | Real end-to-end pilot: multi-tier budgets, org rollup, dashboard, compliance export | 2d | P0 | A real organisation with two real projects genuinely crosses a real warning threshold and then a real hard project-level threshold under real (or, if a live-provider quota constraint recurs as it has before, the existing deterministic fixture adapter, disclosed exactly like DEVOS-089's own precedent) executions; both real alerts appear correctly in DEVOS-152's dashboard and in DEVOS-147's existing compliance export — live-verified against real Postgres, mirroring this codebase's own established pilot-verification convention (DEVOS-100/108/126/137/148). |

**Sprint objective:** budget control becomes a real, tiered, organisation-aware mechanism, and cost data becomes genuinely attributable to the workflow/work item that caused it, not just the agent that ran it.
**Exit criteria:** the source backlog's own three-word E23 scope — "budgets, attribution, optimisation" — has real, live-verified evidence for the first two; optimisation (model routing, cost-aware agent selection) is explicitly deferred to Sprint 19 (below), since no real selection algorithm exists yet for a cost preference to attach to.

### Sprint 19 (proposed, not yet scoped) — Tool-Invocation Cost & Cost-Aware Agent Selection

Per your direction, the two items §2/§9 found have no real data or infrastructure to build on yet are not dropped — they are named here, epic-level only, as the next candidate sprint after Sprint 18, the same way `DEVOS-POST-POC-BACKLOG-AND-SPRINT-PLAN.md` §10 originally named E20–E27 before each was scoped in turn. They are deliberately left unscoped (no story IDs, no estimates) because each has a real precondition that Sprints 17–18 do not themselves satisfy:

- **Tool-invocation cost tracking** (Tool & Integration spec §38) — real scoping needs a real provider that actually exposes a per-call cost figure. None of today's real integrations (GitHub, Render, Vault, Auth0) do. Before this can be scoped as more than a schema placeholder, either one of those providers' real cost/billing APIs would need to be integrated (a real provider-integration task in its own right, not a cost-reporting one), or the item stays named-only until such a provider exists.
- **Cost-aware agent selection / model routing** (Agent Framework §9/§43) — real scoping needs a real agent-selection algorithm to extend, and `apps/worker/src/agent-task-router.ts` does not have one to select *between multiple candidates* (role-based dispatch to a single resolved agent already exists — see the corrected §2 row above). Building that real selection algorithm is itself a separate, non-trivial precondition task before a cost preference could meaningfully attach to it.

**Update, 2026-09-19:** the agent-selection precondition above has since been scoped as its own document, `specs/DEVOS-AGENT-SELECTION-BACKLOG.md` (Sprint 19 — Agent Selection Foundations, DEVOS-158–162), approved, converted to `specs/sprints/sprint-19/`, and is now **COMPLETE** (see `DEVOS-BUILD-STATE.md`'s 2026-09-19 (Sprint 19) state-change-log entry). It deliberately reused the "Sprint 19" name this section reserved but narrowed it to only the selection-algorithm precondition; tool-invocation cost tracking and true cost-aware selection built on top of it remain unscoped, still pending a real provider cost figure, and would become a future sprint.

**Update, 2026-09-19 (post-Sprint-19):** per the user's explicit direction, tool-invocation cost tracking is deliberately set aside until **after the full DevOS build is done** — not the next item to scope. This is a timing decision, not a scope change: the precondition itself (no real provider exposes a per-call cost figure) is unchanged, and this document's own §9 "what not to build" reasoning still applies until that precondition is met.

---

## 7. Dependencies

- Sprint 18 (`DEVOS-155`/`DEVOS-157`) depends on Sprint 17's `DEVOS-150` organisation rollup query already existing — same epic-internal sequencing precedent as E20→E21's Sprint 11→13 dependency and E22's Sprint 15→16 dependency.
- `DEVOS-150`'s organisation-spanning query is, like `DEVOS-147` before it, a real exception to this codebase's usual per-project repository access pattern (every other repository method takes a `projectId`). Confirm during implementation whether it should be built the same way `DEVOS-147` was (a real join, not a client-side loop over every project) — this document assumes yes, for consistency with the now-established precedent, but the choice must be recorded, not silent, per `AGENTS.md` §8.
- `DEVOS-152`'s dashboard depends on `DEVOS-151`'s routes; `DEVOS-156`'s attribution UI depends on `DEVOS-150`'s extended breakdown query already grouping by workflow/work item.
- This epic does not depend on E20/E21/E22 in either direction beyond reusing `DEVOS-147`'s already-proven cross-project query pattern and (in `DEVOS-157`) its existing compliance-export surface — cost is a Core Platform/Agent Framework concern, orthogonal to workflow node types, the visual designer, and the policy/approval engine. It is sequenced fourth here only because that is source §41's own listed order, which `DEVOS-POST-POC-BACKLOG-AND-SPRINT-PLAN.md` §10 already carried forward unchanged.

## 8. Definition of Done (Sprints 17–18)

- Every acceptance-summary cell in §6 is independently, really verified (real Postgres, a real dev-server run, a real crossed threshold producing a real visible alert and dashboard entry) — not asserted from code review alone, matching every prior sprint's own established convention.
- Full monorepo `pnpm turbo run typecheck lint test build` stays green throughout (excluding `@devos/e2e-tests` only where this repo's own existing Windows-timing caveats already apply).
- `DEVOS-BUILD-STATE.md`/`DEVOS-ROADMAP.md` are updated only on the user's explicit approval of each step, per `AGENTS.md` §18/§19 — this document does not authorize touching either.

## 9. What NOT to build in Sprints 17–18

Per the pre-POC specs' own deferred/future lists (Core Platform §52/§53, Functional §3.2/§36, Agent Framework §43/44, carried forward verbatim): a full enterprise billing/invoicing engine, automatic spend cutoffs or throttling (alert-only remains the model, unchanged from DEVOS-098), real-time third-party FinOps tool integration, cross-organisation cost benchmarking, and any change to the Tool Gateway's provider-adapter chain, credential broker, or authentication/identity provider (unaffected by this epic — this epic changes what cost data is captured and shown, not how tools or agents are invoked). Also deferred — per your direction, to the proposed Sprint 19 (§6 above) rather than dropped, and named here rather than silently skipped:

- **Tool-invocation cost tracking** (Tool & Integration spec §38) — no real provider this codebase calls (GitHub, Render, Vault, Auth0) exposes a real per-call cost figure today; adding a cost field with no real data source to populate it would mean fabricating numbers, which this backlog's own §3 principle explicitly rules out.
- **Cost-aware agent selection / model routing** (Agent Framework §9/§43) — `apps/worker/src/agent-task-router.ts` has no multi-candidate selection algorithm yet (its existing role-based dispatch, corrected in §2 above, still only ever resolves one literal `agentRef`); there is nothing for a cost preference to attach to until that algorithm itself is built (now scoped separately in `specs/DEVOS-AGENT-SELECTION-BACKLOG.md`), which is out of Sprint 17–18's own scope.

Also out of scope for these two sprints specifically: any part of E24–E27.

---

## 10. Open Decision For The User

This document proposes E23 as Sprint 17–18, matching source §41's own listed order (Workflow Expansion → Workflow Designer → Governance → **Cost**) and `DEVOS-POST-POC-BACKLOG-AND-SPRINT-PLAN.md`'s pre-existing sequencing note — consistent with your own direction that Cost is next. **Resolved:** tool-invocation cost tracking and cost-aware agent selection are deferred to a proposed Sprint 19 rather than dropped, per your direction — see §6's new "Sprint 19 (proposed, not yet scoped)" subsection and §9. One thing remains worth confirming before conversion into real `specs/sprints/sprint-17/` task files:

1. **Sprint 17/18 story split.** If a different split, an added/removed story, or a different priority ordering is wanted, say so now — per `AGENTS.md` §35, converting this into `specs/sprints/sprint-17/` task files, and any implementation, still requires your explicit separate approval.
