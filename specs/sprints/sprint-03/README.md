# Sprint 3 — Knowledge, Context, Policy & Approval

**Historical source:** `Analysis/DevOS_POC_Sprint_3_Implementation_Tasks_v1.0.docx`
**Conversion date:** 2026-08-21

## Goal

Give agents governed access to knowledge/context and introduce the first human approval gate: planning is grounded in authorised context and cannot proceed to development until a human approves the planning package (source §1–§2).

## Architecture

`Task → Context Assembly (Knowledge Sources + Repository/Document Retrieval + Project Context + Policies) → Context Manifest (provenance) → Agent Runtime → Agent Output → Policy Evaluation → Approval Request → Human Decision → Workflow Continues (or returns to planning)`

This extends Sprint 2's agent runtime (`packages/agents`, `runAgentTask`, the four planning-path agents) rather than replacing it: the context manifest mechanism Sprint 2 already introduced for DEVOS-030 is the base this sprint's context-provenance work extends, per `specs/architecture/system-context-engineering-knowledge.md` §21/§22 and the "Context ≠ Authority" principle (`AGENTS.md` §27). The workflow engine gains its first real human-in-the-loop gate (`AWAITING_APPROVAL`), extending Sprint 1's workflow state machine rather than introducing a parallel one.

## Task authority

The task files in this directory are concise, version-controlled conversions of the historical developer-ready specification (`Analysis/DevOS_POC_Sprint_3_Implementation_Tasks_v1.0.docx`). That source states identical generic implementation-instructions/acceptance-criteria/definition-of-done boilerplate for every task, plus one task-specific one-line description each; the converted acceptance criterion for each task below concretizes that generic bar using the task's own stated description, grounded in the authoritative specs listed per task, following the same pattern used for Sprint 1 and Sprint 2's conversions. Per-task dependencies are not stated individually in the source (only a sprint-wide dependency on Sprint 2) — the dependencies listed below are inferred from the natural build order implied by the task backlog sequence and each task's description, and should be confirmed rather than assumed authoritative.

**Spec-grounding gaps, flagged up front (see the full spec-grounding research for detail):**

- There is **no database table for knowledge persistence anywhere in `specs/database/poc-database-schema.md`** — the domain model (`specs/architecture/domain-model.md` §8) defines _Knowledge Item / Knowledge Collection / Knowledge Reference_, not "KnowledgeSource," and storage/retrieval mechanism is explicitly deferred (`specs/architecture/system-context-engineering-knowledge.md` §39: "This document does not decide: ... database schema"). DEVOS-039's naming and persistence shape are therefore an implementation-level assumption, not a spec-mandated one.
- The domain model's approval lifecycle diagram (`domain-model.md` §20) shows five conceptual states (Required/Requested/Rejected/Changes Requested/Approved), but the `approvals` table's documented `status` column (`poc-database-schema.md` §11.1) lists only three values (Pending/Approved/Rejected). DEVOS-045 must reconcile this explicitly rather than silently picking one.
- `context_manifests` persistence is explicitly hedged in the schema spec ("a POC implementation **may** store context manifests... **where persistence is needed**") — DEVOS-030 (Sprint 2) already persists a first-cut version of this table; DEVOS-042 extends it rather than building a parallel mechanism.
- No policy evaluation algorithm or rule language is specified anywhere; only "policy evaluation occurs server-side" (`poc-api-contracts.md` §31) and "must be deterministic and independent of model output" (`repository-code-structure.md` §17) are stated as constraints. DEVOS-044's evaluator design is therefore an implementation choice, to be flagged in the decision log.
- No named `ApprovalRejected`/`ChangesRequested` workflow event exists in `specs/workflows/software-change-workflow.md` §30 (only `ApprovalRequested`/`ApprovalGranted`) — DEVOS-045/047 extend the event naming convention by analogy, flagged as an assumption.

## In scope

Project-scoped knowledge sources, controlled repository/document retrieval, a deterministic context builder (source selection, filtering, size limits), context provenance (source references and manifests, extending Sprint 2's context manifest), a policy model (rules/capabilities/decisions) and a deterministic policy evaluator, an approval model (requests, decisions, scope hashes) with a minimal approval UI, a human planning-approval gate that blocks development until granted, explicit uncertainty/insufficient-context handling, and security/context-isolation tests.

## Out of scope / deferred

Production autonomy, an advanced policy DSL, and an enterprise governance suite (source §4, verbatim). Also explicitly deferred by `specs/architecture/system-context-engineering-knowledge.md` §39: vector databases, embeddings, semantic search, full-text search, repository indexing technology, file chunking strategy, and retrieval algorithms — DEVOS-040's retrieval implementation must stay simple (e.g. direct file/artifact lookup) rather than building search infrastructure.

## Sprint-wide acceptance criteria

- Context supplied to an agent execution is authorised, relevant, traceable, and version-aware (`system-context-engineering-knowledge.md` §37 Domain Invariants).
- Every material context item has recorded provenance (source type, identifier, version, retrieved-at, authority).
- Policy evaluation is deterministic, server-side, and independent of model output.
- An approval decision is bound to the exact evidence/version being approved and is attributable to an authorised human.
- The planning workflow transitions to `AWAITING_APPROVAL` and cannot proceed to development until approval is granted.
- Missing/insufficient context produces an explicit uncertainty signal ("I do not have enough information to determine this."), never a fabricated result.
- Security/context-isolation tests demonstrate cross-project isolation and that retrieved content cannot grant tool authority.

(Source §8, Sprint-Level Definition of Done, concretized against the specs above.)

## Quality gates

Context manifest completeness and provenance (auditable per execution, extending Sprint 2's mechanism), policy-evaluator determinism (same inputs → same decision, tested without any model call), approval scope-hash binding (an approval cannot be replayed against different evidence), planning-gate enforcement (a run genuinely cannot proceed past `AWAITING_APPROVAL` without an explicit decision), and security/context tests (cross-project isolation, no tool authority from context).

## Key risks (source §11, carried forward verbatim)

- **Scope creep** — protect the vertical slice; defer non-essential platform features.
- **Architecture drift** — enforce package boundaries and contract tests.
- **Agent quality** — require structured outputs, evidence, and regression fixtures.
- **Security** — never let model output become authority (`AGENTS.md`'s "Context ≠ Authority" principle applies directly here, and is the explicit subject of this sprint's approval gate).
- **Provider lock-in** — use adapters from the first implementation (already established in Sprint 2; this sprint does not change the model-provider boundary).
- **Reliability** — test restart, duplicate delivery, and idempotency before adding autonomy (already demonstrated in Sprint 1/2; this sprint's new `AWAITING_APPROVAL` state must be added to those same reliability guarantees, not exempted from them).
- **Over-engineering** — prefer modular monolith patterns until scale proves extraction necessary.

## Exit criteria

Sprint 3 is complete when its sprint-level Definition of Done is met, the demo (context provenance and the planning approval gate blocking, then allowing, development) can be performed in the target environment, and no critical defect or security issue remains open against the sprint goal. (Source §12.)
