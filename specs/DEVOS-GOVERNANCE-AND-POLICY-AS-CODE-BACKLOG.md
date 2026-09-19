# DevOS Governance & Policy-as-Code Backlog

**Document:** E22 (Governance & Policy-as-Code) Backlog & Sprint Plan
**Version:** 1.0
**Status:** Proposed — awaiting explicit user review and approval before Sprint 15 begins
**Predecessor:** `specs/DEVOS-POST-POC-BACKLOG-AND-SPRINT-PLAN.md` §5/§10, which named E22 but explicitly left it "not yet scoped" pending the E19 gate. `specs/DEVOS-WORKFLOW-EXPANSION-AND-DESIGNER-BACKLOG.md` (E20/E21) is now itself COMPLETE (`DEVOS-BUILD-STATE.md`, Sprint 14 entry) — this document is the next theme in source §41's own listed order (Workflow Expansion → Workflow Designer → **Governance** → Cost → ...), produced the same way that document was produced for E20/E21, but does not itself authorize starting Sprint 15 (see Status above and §11 below).
**Task-ID authority:** Continues the real, continuous numbering used by `specs/sprints/sprint-01`–`sprint-14`, `specs/DEVOS-POST-POC-BACKLOG-AND-SPRINT-PLAN.md`, and `specs/DEVOS-WORKFLOW-EXPANSION-AND-DESIGNER-BACKLOG.md` (`DEVOS-001`–`DEVOS-137`), starting at `DEVOS-138`.

---

## 1. Purpose

`Analysis/DevOS_POC_Product_Backlog_and_Sprint_Plan_v1.0.docx` §41 ("Post-POC Roadmap Themes") lists Governance third, with the one-line scope "Policy-as-code, compliance, approvals." `specs/DEVOS-POST-POC-BACKLOG-AND-SPRINT-PLAN.md` §10 carried this into E22 as "a real policy engine beyond today's capability/risk check; richer approval models; compliance reporting." This document turns that one line into real epics, stories and sprints — the same way `DEVOS-WORKFLOW-EXPANSION-AND-DESIGNER-BACKLOG.md` did for E20/E21 before Sprint 11 began.

Unlike E20/E21, there is no single dedicated pre-POC baseline spec for this theme (there was no `DevOS_16_Governance_Specification`). Three existing pre-POC baseline specs each name this theme's future scope explicitly and are treated as authoritative inputs here, not re-derived from scratch:

- `Analysis/DevOS_12_Security_and_Identity_Architecture_Specification_v1.0.docx` — §10 (ABAC/Policy Attributes), §14 (Policy Inheritance is actually specified in the Core Platform doc, not here — see below), §52 ("Explicitly Deferred": *"Full policy-as-code platform"*), §53 ("Future Security Capabilities": dynamic risk-based authorisation, policy simulation before deployment, fine-grained ABAC, security posture dashboards).
- `Analysis/DevOS_10_Core_Platform_and_Control_Plane_Specification_v1.0.docx` — §14 (Policy Inheritance: organisation → project → resource → invocation, "a lower-level configuration must not weaken a higher-level mandatory policy"), §52/§53 (defers "full enterprise policy-as-code," names "advanced policy-as-code" and "fine-grained ABAC" as future capabilities).
- `Analysis/DevOS_02_Detailed_Functional_Specification_v1.0.docx` §36 ("Future Functional Capabilities"): *"Enterprise policy-as-code."*

All three predate the POC by design and all three point at the same gap: the POC intentionally built only a flat, capability/risk-keyed policy check and a single fixed approval gate (source backlog §14, `DEVOS-070`–`DEVOS-077`), explicitly deferring the richer model these specs already describe. This document is the reconciliation: what those specs originally called for, against what Sprints 1–14 actually built, scoped into buildable stories.

---

## 2. Grounding — confirmed against the real, current implementation

Per `AGENTS.md` §7/§8, this section states what is actually true today, verified by direct code inspection, not assumed from the original specs' aspirational scope.

| Concept | Original spec intent | Current reality (verified) |
| --- | --- | --- |
| Policy scope/hierarchy | Core Platform spec §14: policy flows organisation → project → resource → invocation, with a mandatory child-override-of-parent restriction ("a lower-level configuration must not weaken a higher-level mandatory policy") | `packages/domain/src/policy/policy.ts`'s `Policy` type has a nullable `projectId` (comment: org-wide policies "remain representable later"), but `PolicyRepository` (`packages/database/src/repositories/policies.ts`) has no `listForOrganisation` method and `packages/application/src/policy/create-policy.ts` requires `projectId` on every create call. There is no organisation-scoped policy today, and no override-precedence logic anywhere — it is a **flat per-project list**, org-wide is schema-level only. |
| Policy attributes (ABAC) | Security spec §10: policy should key off organisation, project, team, user role, **agent identity/version, workflow identity/version, tool capability, resource, branch, environment, risk level, data classification, approval state, time/window, execution origin** | `packages/policy/src/evaluator/policy-evaluation.ts`'s `PolicyRule.condition`/`PolicyEvaluationRequest` key off exactly **`action`, `actorRole`, `resourceType`, `environment`** — four attributes, none of the agent-version/workflow-version/branch/risk-level/time-window attributes the spec lists exist in the type at all. |
| Policy decision model | Security spec §47: `decision` is `ALLOW`/`DENY`/`APPROVAL_REQUIRED`, with `policy_version`, `reason`, `risk` | `packages/policy/src/evaluator/evaluate-policies.ts`'s `evaluatePolicies` already returns a real 4-way `PolicyEvaluationResult.decision`: `'ALLOW' | 'DENY' | 'REQUIRE_APPROVAL' | 'CONFLICT'`, plus `reason`/`matchedPolicyId`/`matchedPolicyKey`. This part of the spec is already substantially real — confirmed call sites: `packages/tools/src/gateway/invoke-tool.ts` (the Tool Gateway chain, right after capability lookup) and `packages/application/src/approval/decide-approval.ts` (the approval-decision path, DEVOS-110/111). |
| Approval model | Security spec §5 (separation of duties for high-risk ops where organisational policy requires it) and Designer/backlog's own "richer approval models" | `packages/domain/src/approval/approval.ts`'s `Approval` type and `packages/application/src/approval/decide-approval.ts`'s `decideApproval` implement a **single fixed decider gate**: any project `OWNER` may decide (code comment: "no dedicated 'reviewer' role exists"). Confirmed absent: multi-approver/N-of-M support, separation-of-duties enforcement (`decidedBy === requestedBy` is never checked), an expiry field or expiry logic, and risk-tiered approval routing (requirements come only from the generic policy evaluator's `REQUIRE_APPROVAL` outcome or the hardcoded `APPROVAL` graph-node type from DEVOS-122 — not from the requested action's own risk tier). |
| Capability/risk model | Security spec's authority envelope + risk classification concept | `packages/domain/src/tools/tool-capability.ts`'s `ToolCapability.riskClass` is a **single scalar field** per capability (type in `packages/contracts`). No multi-dimensional or per-target risk score exists. |
| Audit records | Security spec §32 (Audit Model) + Functional spec's Governance artifact type ("approval records, decisions, audit evidence") | `packages/domain/src/audit/audit-record.ts`'s `AuditRecord` (table added by `packages/database/migrations/0012_audit_records.ts`) is real and already covers a wide, growing category set (`project.*`, `membership.*`, `work-item.*`, `workflow.*`, `workflow_run.*`, `artifact.created`, `approval.requested`, `policy.published`, `agent_version.published`, `tool_invocation.*`, `project.budget_exceeded`, per DEVOS-077/115/116). This is genuinely solid — the gap is not audit *capture*, it's audit *reporting* (next row). |
| Compliance reporting | Security spec §53: "security posture dashboards"; source backlog: "compliance reporting" | `apps/web/src/pages/GovernancePage.tsx` already exists and is real, but **read-only and per-project only**: three flat lists (Policies, Approvals, "Risk activity" = audit records filtered to `outcome === 'FAILURE'`), backed by `packages/application/src/audit/list-audit-records.ts`'s `listAuditRecordsForProject`. No cross-project aggregation, no date-range/search/filter beyond the project scope, no export, no dashboard/chart. |
| Policy authoring UI | Implied by any real "policy-as-code" claim — an author needs an authoring surface | Searched all of `apps/web/src`: **no create/edit/publish policy UI exists anywhere.** `GovernancePage.tsx` only renders `key`/`version`/`status`/`publishedAt` from `listPoliciesForProject`. The only way to author a policy today is a direct call to `packages/application/src/policy/create-policy.ts`/`publish-policy.ts` (via the API or a seed script) — mirroring exactly the gap `specs/architecture/organisations-and-project-types.md` §2 flagged for `WorkflowVersion` before Sprint 14 closed it. |

**Conclusion this backlog is built on:** the POC's policy/approval/audit mechanism (`DEVOS-070`–`DEVOS-077`) is real, not a stub — the 4-way `evaluatePolicies` decision and the audit-capture pipeline are already solid foundations, more complete than the workflow-engine gap E20 found. What's actually missing is exactly what the three baseline specs and the post-POC backlog both name: (a) the policy *language* has almost none of the ABAC attributes the spec calls for, (b) there is no organisation-level policy or inheritance/override precedence, (c) approval is a single-approver, non-expiring, non-risk-tiered gate with no separation-of-duties check, (d) there is no authoring UI for policy at all, and (e) "compliance reporting" does not exist — `GovernancePage.tsx` is a per-project audit viewer, not a reporting surface. This backlog closes those five gaps; it does not rebuild the parts that already work.

---

## 3. Delivery Principles (carried forward, `DEVOS-POST-POC-BACKLOG-AND-SPRINT-PLAN.md` §2 / `DEVOS-WORKFLOW-EXPANSION-AND-DESIGNER-BACKLOG.md` §3, still correct)

- Prioritise closing the specific, named gaps in §2 above over speculative generality — extend the real `PolicyRule`/`evaluatePolicies` and `Approval` types that already work, do not replace them with a new policy engine.
- Keep policy evaluation outside the model (Security spec ADR-SEC-002) and keep every decision auditable (ADR-SEC-006/§32) — both already proven through Sprints 1–14, both must survive richer attributes and multi-approver routing untouched.
- Respect tenant isolation (Security spec ADR-SEC-005: "Organisation is the mandatory data/security boundary") — compliance reporting aggregates across an organisation's own projects, never across organisations.
- Every sprint ends with demonstrable functionality, verified for real (real Postgres, real dev servers, a real end-to-end decision/approval/report) — not simulated.
- Per the Security spec's own MVP/deferred split (§51/§52): richer ABAC, org-level policy, multi-approver/expiry/separation-of-duties, and compliance reporting are in scope; a full enterprise policy-as-code DSL/marketplace, dynamic behavioural risk scoring, PAM/SCIM integration, and automated security-incident workflows are explicitly not (§9 below).

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
| E22 | Governance & Policy-as-Code — a real ABAC-capable policy engine with organisation-level scope, richer approval models (multi-approver, separation-of-duties, expiry, risk-tiered routing), a policy authoring UI, and real cross-project compliance reporting | P1 | 15–16 | §6 below |

---

## 6. Product Backlog — E22 Governance & Policy-as-Code

### Sprint 15 — Policy Engine Foundations

| ID | Story | Est. | Pri | Acceptance summary |
| --- | --- | --- | --- | --- |
| DEVOS-138 | Extend policy conditions with real ABAC attributes | 3d | P0 | `PolicyRule.condition`/`PolicyEvaluationRequest` (`packages/policy/src/evaluator/policy-evaluation.ts`) gain the highest-value attributes Security spec §10 names that the engine can evaluate from data it already has: agent identity/version (from the real `AgentVersion` already resolved on every planning-path execution, DEVOS-109), workflow identity/version (from the real `WorkflowVersion` a run already references), and risk level (from `ToolCapability.riskClass`, already real). Existing policies with only `actorRole`/`resourceType`/`environment`/`action` conditions continue to evaluate identically (additive fields, not a breaking schema change) — proven by re-running every existing `evaluatePolicies` unit test unmodified. |
| DEVOS-139 | Real organisation-level policy scope | 3d | P0 | `PolicyRepository` gains a real `listForOrganisation` method; `createPolicy`/`publishPolicy` (`packages/application/src/policy/`) accept a policy with no `projectId` and persist it as organisation-wide; `evaluatePolicies`'s caller resolves the effective rule set as **organisation policies + the target project's own policies**, with Core Platform spec §14's own mandatory precedence rule enforced (a project-scoped rule cannot turn an organisation-mandatory `DENY`/`REQUIRE_APPROVAL` into `ALLOW` for the same `action`) — the first real policy inheritance in the product, closing the schema-level-only placeholder §2 found. |
| DEVOS-140 | Policy authoring UI | 3d | P0 | A real create/edit/publish policy form added to `GovernancePage.tsx` (today read-only), reusing the existing, unmodified `create-policy.ts`/`publish-policy.ts` application functions and DEVOS-139's new organisation-scope option — closing the "no authoring UI anywhere" gap §2 confirmed, the same way DEVOS-140's predecessor (Sprint 14's `WorkflowsPage.tsx`, DEVOS-136) closed the equivalent gap for `WorkflowVersion`. |
| DEVOS-141 | Policy simulation against real historical requests | 2d | P1 | Before publishing a policy (draft state), an author can run it against a real, recent sample of the organisation's own `AuditRecord`s (already-captured real tool-invocation/approval decisions) and see what decision (`ALLOW`/`DENY`/`REQUIRE_APPROVAL`/`CONFLICT`) it would have produced for each — Security spec §53's "policy simulation before deployment," deliberately narrowed to real historical data rather than a synthetic what-if engine (no new data generation, no hypothetical-request builder). |
| DEVOS-142 | Validation, documentation, and gap disclosure | 1d | P1 | Full monorepo `pnpm turbo run typecheck lint test build` green; any real gap the new attributes/hierarchy/simulation surfaces (matching every prior sprint's own honest-disclosure convention) recorded in this document's own decision log, not silently patched or hidden. |

**Sprint objective:** the policy engine itself becomes real ABAC (per Security spec §10), with a genuine organisation-level scope and an authoring surface — not just a richer decision enum wrapped around a flat, per-project, four-attribute rule table.
**Exit criteria:** a policy authored through the new UI, scoped to an organisation, keyed on a real agent-version or workflow-version attribute, is shown (via DEVOS-141) to produce the intended decision against real historical requests, then published and confirmed to actually govern a new real request end to end.

### Sprint 16 — Richer Approval Models & Compliance Reporting

| ID | Story | Est. | Pri | Acceptance summary |
| --- | --- | --- | --- | --- |
| DEVOS-143 | Multi-approver (N-of-M) approval support | 3d | P0 | `Approval` (`packages/domain/src/approval/approval.ts`) gains a real requirement for more than one distinct decider before resolving; `decideApproval` records each real decision and only transitions the approval to its terminal state once the configured threshold of distinct approvers is met — reusing the existing atomic decision/run-transition transaction (DEVOS-111) unchanged, extended rather than replaced. |
| DEVOS-144 | Separation-of-duties enforcement | 1d | P0 | `decideApproval` rejects a decision where the deciding identity is the same identity that requested the approval (Security spec §5: "the requester and approver should be distinct identities where organisational policy requires separation of duties") — configurable per policy (DEVOS-139/140's new organisation-scoped policy can mandate it), off by default to preserve every existing Sprint 1–14 test's own single-approver behaviour. |
| DEVOS-145 | Approval expiry | 2d | P1 | `Approval` gains a real `expiresAt`; a `PENDING` approval past its expiry transitions to a new terminal `EXPIRED` status (not left pending forever) via the same dispatcher-polling model `WAIT` node execution already established (DEVOS-121) — no new scheduler subsystem. A workflow task blocked on an `EXPIRED` approval reaches a terminal failed/skipped state rather than hanging. |
| DEVOS-146 | Risk-tiered approval routing | 2d | P0 | The number of distinct approvers DEVOS-143 requires (and whether DEVOS-144's separation-of-duties rule applies) scales with the requested action's `riskClass` (already real, §2) — a low-risk capability needs one approver, a high-risk one needs N, closing the source backlog's own named "richer approval models" gap directly, via policy configuration rather than a hardcoded risk table. |
| DEVOS-147 | Cross-project compliance reporting | 3d | P1 | `GovernancePage.tsx` gains a real, organisation-scoped (not cross-organisation — tenant isolation, ADR-SEC-005) reporting view: search/filter by project, actor, action category and date range, plus a real CSV export of the matching `AuditRecord`s — the first real cross-project aggregate view in the product, extending `list-audit-records.ts` with a real `listAuditRecordsForOrganisation` rather than looping the existing per-project call client-side. |
| DEVOS-148 | Real end-to-end pilot: org policy, multi-approver decision, compliance export | 2d | P0 | A real organisation-scoped, risk-tiered policy (DEVOS-138/139/146) requires two distinct approvers for a real high-risk tool invocation; two real, distinct users decide it (proving DEVOS-143/144 together); the resulting audit trail is confirmed present in a real DEVOS-147 compliance export — live-verified against real Postgres, mirroring this codebase's own established pilot-verification convention (DEVOS-100/108/126/137). |

**Sprint objective:** approval stops being a single fixed OWNER-only gate and becomes a real, risk-aware, policy-configurable control; audit data becomes a real cross-project reporting surface, not just a per-project flat list.
**Exit criteria:** the source backlog's own three-word E22 scope — "policy-as-code, compliance, approvals" — is closed with real evidence for all three, matching the Security spec's own §49 "Initial Acceptance Criteria" items this epic specifically targets ("a high-risk tool action can require human approval," "material security decisions are auditable," extended to their real richer form).

---

## 7. Dependencies

- Sprint 16 (`DEVOS-146`) depends on Sprint 15 (`DEVOS-138`'s real `riskClass` attribute already being evaluable in a policy condition, and `DEVOS-139`'s organisation-scoped policy being the natural place to configure a risk-tier table) — same epic-internal sequencing precedent as E20→E21's Sprint 11→13 dependency.
- `DEVOS-144` (separation-of-duties) and `DEVOS-146` (risk-tiered routing) both extend policy *configuration*, not the evaluator's core decision logic — confirm in review that neither requires a breaking change to `PolicyEvaluationResult`'s existing `ALLOW | DENY | REQUIRE_APPROVAL | CONFLICT` shape, consumed unchanged by `invoke-tool.ts` and `decide-approval.ts`.
- `DEVOS-147`'s cross-project reporting is the first query in the product that spans multiple projects within one organisation. Flag in review whether the existing per-project repository access pattern (every other repository method takes a `projectId`) needs a deliberate, disclosed exception for this one method, or whether it should be built by fetching each project's own membership-checked audit list and aggregating server-side — either is acceptable, but the choice must be recorded, not silent, per `AGENTS.md` §8.
- This epic does not depend on E20/E21 in either direction — policy/approval/audit are Core Platform/Security concerns, orthogonal to workflow node types and the visual designer. It could in principle have run before E20/E21; it is sequenced third here only because that is source §41's own listed order, which `DEVOS-POST-POC-BACKLOG-AND-SPRINT-PLAN.md` §10 already carried forward unchanged.

## 8. Definition of Done (Sprints 15–16)

- Every acceptance-summary cell in §6 is independently, really verified (real Postgres, a real dev-server run, a real multi-user approval decision, a real export file) — not asserted from code review alone, matching every prior sprint's own established convention.
- Full monorepo `pnpm turbo run typecheck lint test build` stays green throughout (excluding `@devos/e2e-tests` only where this repo's own existing Windows-timing caveats already apply).
- `DEVOS-BUILD-STATE.md`/`DEVOS-ROADMAP.md` are updated only on the user's explicit approval of each step, per `AGENTS.md` §18/§19 — this document does not authorize touching either.

## 9. What NOT to build in Sprints 15–16

Per the Security spec's own §52 "Explicitly Deferred" list (carried forward verbatim, still correct, and per the Core Platform spec's matching §52/§53): a full enterprise policy-as-code DSL or marketplace, advanced behavioural anomaly detection, continuous/dynamic risk scoring (as opposed to this epic's static `riskClass`-tiered routing), privileged access management (PAM) integration, enterprise SCIM lifecycle automation, hardware-backed identity, advanced data-loss prevention, automated threat intelligence, automated security-incident workflows, automated least-privilege recommendations, secrets rotation orchestration, and security posture dashboards beyond DEVOS-147's real audit-export reporting view. Also out of scope for these two sprints specifically: any change to the Tool Gateway's provider-adapter chain, credential broker, or authentication/identity provider (all already real and unaffected by this epic — this epic changes what is *evaluated and who must approve*, not how identity or credentials work), and any part of E23–E27.

---

## 10. Open Decision For The User

This document proposes E22 as Sprint 15–16, matching source §41's own listed order (Workflow Expansion → Workflow Designer → Governance) and `DEVOS-POST-POC-BACKLOG-AND-SPRINT-PLAN.md`'s pre-existing E20→E21→E22 sequencing note. Per that document's §9, the E19 gate's own question — "which of E20–E27 has the highest real value right now" — has not been formally re-answered since E20/E21 shipped; this document assumes the answer is "continue in listed order." If a different epic (E23–E27) should come first instead, or if Sprint 15/16's scope split above should be adjusted, say so before this plan is converted into real `specs/sprints/sprint-15/` task files — per `AGENTS.md` §35, that conversion, and any implementation, still requires your explicit separate approval.
