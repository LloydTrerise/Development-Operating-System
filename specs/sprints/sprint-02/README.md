# Sprint 2 — Agent Framework and Planning Intelligence

**Historical source:** `Analysis/DevOS_POC_Sprint_2_Implementation_Tasks_v1.0.docx`
**Conversion date:** 2026-08-21

## Goal

Introduce a real agent framework and automate the discovery-to-planning path: DevOS should be able to take a work item and generate a discovery report, a PRD, a technical design, and an implementation plan using versioned agents backed by a real LLM provider — replacing the deterministic no-LLM stub handler that has stood in for agent execution since Sprint 1 (DEVOS-016).

## Architecture

`Work Item → Agent Runtime (LLM Provider Adapter + Versioned Prompts) → Schema-Validated Agent Output (Discovery → Requirements → Technical Design → Planning) → Workflow Engine → Artifact Store`

This extends, rather than replaces, Sprint 1's control plane: the workflow/task/worker/outbox/audit machinery built in Sprint 1 is reused as-is — only the task _handler_ changes, from the deterministic stub to real agent execution.

## Task authority

The task files in this directory are concise, version-controlled conversions of the historical developer-ready specification (`Analysis/DevOS_POC_Sprint_2_Implementation_Tasks_v1.0.docx`). That source states identical generic implementation-instructions/acceptance-criteria/definition-of-done boilerplate for every task, plus one task-specific one-line description each; the converted acceptance criterion for each task below concretizes that generic bar using the task's own stated description, following the same pattern used for Sprint 1's conversion. Per-task dependencies are not stated individually in the source (only a sprint-wide dependency on Sprint 1) — the dependencies listed below are inferred from the natural build order implied by the task backlog sequence and each task's description, and should be confirmed rather than assumed authoritative.

## In scope

Agent definitions and runtime, an LLM provider adapter, prompt/version management, structured (schema-validated) agent outputs, a context manifest recording what was supplied to each agent execution, four concrete agents (discovery, requirements, technical design, planning), wiring those agents into the existing workflow engine in place of the deterministic stub, a minimal agent-execution UI panel, and agent evaluation fixtures for regression testing.

## Out of scope / deferred

Autonomous code changes, production release, complex retrieval/vector infrastructure, and a plugin marketplace. (Source §4, verbatim.)

## Sprint-wide acceptance criteria

- A real agent runtime executes agent definitions and captures structured, schema-validated output.
- Prompts are versioned, not hardcoded inline per call.
- A work item can, through the real agent pipeline, produce a discovery report, a PRD, a technical design, and an implementation plan.
- Evaluation fixtures (golden inputs/outputs) exist for agent regression testing.
- The full planning path (work item → discovery → PRD → design → plan) passes end-to-end.

(Source §8, Sprint-Level Definition of Done.)

## Quality gates

Agent output schema validation, prompt/version traceability, context manifest completeness (what was supplied to each agent execution is recorded and auditable), agent evaluation fixture regression (tests run against recorded fixtures, not live API calls, to stay fast and free-tier-safe), and planning-path E2E evidence.

## Key risks (source §11, carried forward verbatim)

- **Scope creep** — protect the vertical slice; defer non-essential platform features.
- **Architecture drift** — enforce package boundaries and contract tests.
- **Agent quality** — require structured outputs, evidence, and regression fixtures.
- **Security** — model output must never become authority (`AGENTS.md`'s "Context ≠ Authority" principle applies directly here).
- **Provider lock-in** — build the LLM adapter so the provider is swappable from the first implementation. This project's Sprint 2 provider choice is Google Gemini (free tier, see `DEVOS-SPRINT1-DECISIONS.md`-style project memory) — the adapter interface (DEVOS-027) must not assume Gemini-specific behavior beyond the adapter boundary.
- **Reliability** — test restart, duplicate delivery, and idempotency before adding autonomy (already demonstrated for the deterministic case in Sprint 1's DEVOS-024; agent execution reuses the same task-queue mechanics, so this risk is largely inherited and mitigated, not new).
- **Over-engineering** — prefer modular monolith patterns until scale proves extraction necessary.

## Exit criteria

Sprint 2 is complete when its sprint-level Definition of Done is met, the demo (a real work item producing discovery, PRD, technical design, and implementation plan) can be performed in the target environment, and no critical defect or security issue remains open against the sprint goal. (Source §12.)
