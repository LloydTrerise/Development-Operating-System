# Sprint 28 — Risk-Based Approval Gate Reduction

**Source:** `specs/DEVOS-AUTONOMY-INTEGRATION-BACKLOG.md` §6.2 (E27, Risk-Based Approval Gate Reduction thread).
**Conversion date:** 2026-09-20
**Status:** Converted alongside Sprint 27, per the same explicit user approval ("proceed") of the backlog document. Independent of Sprint 27 — no shared code, table, or sequencing dependency (backlog §7) — and may begin before, after, or interleaved with it, subject to AGENTS.md §4.1's one-task-at-a-time governance.

## Goal

DevOS's approval-gate mechanism (`ApprovalNodeConfig`/`resolveApprovalRequirements`, built Sprint 15–16, DEVOS-138–148) is entirely static — `requiredApprovers`/`enforceSeparationOfDuties`/`requiredRejections` come from author-set JSON, never from any measured signal. DevOS also already computes real reliability signals from real captured data (`computeAgentVersionQuality`, DEVOS-172–176; `aggregateEngineeringEvidence`'s DORA/pass-rate metrics, DEVOS-163–171) that today feed nothing but `selectAgentForTask`'s own agent-dispatch tie-break. This sprint adds one real, narrow, floor-protected bridge between the two: a workflow author can configure an `APPROVAL` node so that a genuinely demonstrated reliability threshold reduces (never eliminates) how many human approvers are required — with a durable, inspectable audit trail proving exactly which evidence justified the reduction.

## Grounding (confirmed by direct code inspection before scoping — see the backlog document §2.1 for full citations)

- `evaluatePolicies` (`packages/policy/src/evaluator/evaluate-policies.ts`) is purely declarative rule matching by design — it accepts no numeric/statistical input, and this sprint does not change that; the reliability check is a separate, additive step in `resolveApprovalRequirements`, not a new kind of policy condition evaluated inside the policy engine.
- No dynamic approval-reduction mechanism exists anywhere today — confirmed absent by whole-repo grep (`auto-approve`, `waive`, `reliability.?threshold`, etc.).
- The tool-invocation `REQUIRE_APPROVAL` policy path has its own pre-existing, disclosed gap (`invoke-tool.ts` treats it identically to `DENY`, never creating a real `Approval` row) — this sprint scopes strictly to the `APPROVAL` graph node, which is real and already exercised in every workflow since Sprint 11/12, and does not touch the tool-invocation path.
- `computeAgentVersionQuality` (`packages/domain/src/agents/compute-agent-version-quality.ts`) already computes a real per-`AgentVersion` pass rate from real `REVIEW_EVIDENCE`/`CODE_CHANGE` data — this sprint adds zero new capture, only a new read of already-captured data.

## Real design decisions this sprint's own grounding surfaced

1. **A hard floor, never a bypass.** `requiredApprovers` can be reduced but never configured below 1 by this mechanism — a deliberate, disclosed scope limit (backlog §10 Decision 2), not an oversight. No new policy effect (e.g. an auto-approve `ALLOW` outcome) is introduced.
2. **A minimum sample size, not just a passing rate.** A brand-new, unproven agent version must not be able to trigger a reduction by accident — the reliability query must be able to answer "insufficient sample" distinctly from "threshold met"/"threshold unmet".
3. **Evidence-bound audit, mirroring `Approval.evidenceReference`.** Every applied (or withheld) reduction is durably recorded against the exact reliability evidence that justified the decision — the same evidence-binding discipline this codebase already uses for approval decisions themselves.
4. **Scoped to the `APPROVAL` graph node only.** The tool-invocation `REQUIRE_APPROVAL` path remains untouched and separately unscoped, since it doesn't yet even create a real `Approval` row to attach a reduction to.

## In scope

- **DEVOS-198** — Real reliability-signal query at approval-creation time.
- **DEVOS-199** — Additive, floor-protected approval-requirement reduction on the `APPROVAL` node.
- **DEVOS-200** — Governance visibility for applied reductions.
- **DEVOS-201** — Real end-to-end pilot: reduction genuinely conditional on real evidence.
- **DEVOS-202** — Validation, documentation, and gap disclosure.

## Out of scope

Any full bypass, auto-approve, or zero-required-approvers outcome (backlog §9/§10 Decision 2). Any change to the tool-invocation `REQUIRE_APPROVAL` path or its own pre-existing gap. Any change to `evaluatePolicies`/`evaluatePoliciesWithPrecedence`'s deterministic evaluation semantics. A general-purpose weighted risk-scoring engine or a stored `reliability_score` table. Any part of Sprint 27 (the separate, independent Integration Adapter Expansion thread of the same epic).

## Task index

| ID        | Story                                                                  | File           |
| --------- | ------------------------------------------------------------------------ | -------------- |
| DEVOS-198 | Real reliability-signal query at approval-creation time                  | `DEVOS-198.md` |
| DEVOS-199 | Additive, floor-protected approval-requirement reduction on `APPROVAL`   | `DEVOS-199.md` |
| DEVOS-200 | Governance visibility for applied reductions                             | `DEVOS-200.md` |
| DEVOS-201 | Real end-to-end pilot: reduction genuinely conditional on real evidence  | `DEVOS-201.md` |
| DEVOS-202 | Validation, documentation, and gap disclosure                            | `DEVOS-202.md` |
