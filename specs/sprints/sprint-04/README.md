# Sprint 4 — Tool Gateway, Git & Development Workspace

**Historical source:** `Analysis/DevOS_POC_Sprint_4_Implementation_Tasks_v1.0.docx`
**Conversion date:** 2026-08-22

## Goal

Enable controlled software modification through the Tool Gateway, Git integration, and a development workspace: an approved plan can be executed by a development agent in a controlled workspace and produce a branch/PR (source §1–§2).

## Architecture

`Approved Implementation Plan → Development Agent (repository context) → Tool Gateway (validate → authorise → invoke → record) → Git Adapter (workspace: branch/commit) → PR Creation Capability → Mutation Safety (idempotency/audit)`

This is the sprint where `packages/tools` and `packages/integrations` — named in `specs/architecture/repository-code-structure.md` but empty scaffolds since Sprint 1 — are populated for the first time, extending the agent runtime (Sprint 2) and the policy/approval control plane (Sprint 3) rather than replacing them: the Tool Gateway consults DEVOS-044's policy evaluator for capability authorization, and the development task only becomes runnable once DEVOS-047's planning-approval gate has been granted (§7 Dependencies).

## Task authority

The task files in this directory are concise, version-controlled conversions of the historical developer-ready specification (`Analysis/DevOS_POC_Sprint_4_Implementation_Tasks_v1.0.docx`), following the exact conversion pattern used for Sprint 2/3. Per-task dependencies are inferred from the natural build order implied by the backlog sequence, not stated individually in the source.

**Spec-grounding gaps, flagged up front** (full detail in each task file; see the session's spec-grounding research for exact quotes):

- **Git/GitHub mechanics have no concrete API contract anywhere in the specs.** GitHub is the only named provider (`packages/integrations/src/github/...`), but there is no field-by-field GitHub API schema, no auth-flow choice, and — critically — **no `repositories`/`branches`/`commits`/`pull_requests` table anywhere in `poc-database-schema.md`**, and no corresponding domain entities in `domain-model.md`.
- **"Controlled workspace" (DEVOS-055) is the thinnest task in the sprint** — the word "workspace" appears in the spec corpus exactly once, as a negative security constraint ("Development agent workspaces must not contain unrelated credentials"). No entity, table, lifecycle, or isolation mechanism is specified.
- **"Mutation safety controls" / "branch binding" (DEVOS-059) have no spec grounding as named mechanisms at all** — idempotency itself is well-specified (API `Idempotency-Key` header, a dedicated DB idempotency section, retry rules), but "branch binding" appears nowhere in the spec corpus.
- **Repository-context retrieval (DEVOS-056)'s underlying mechanism (indexing/search/chunking) is explicitly, deliberately deferred** by `specs/architecture/system-context-engineering-knowledge.md` §39 ("This document does not decide: ... repository indexing technology; file chunking strategy; retrieval algorithms").
- **No dedicated PR-related workflow event exists** (`PullRequestCreated`/`CodeChangeCreated`) — only the generic `ToolInvocationCompleted`.
- **User-authorized scoping decision (2026-08-22):** live verification of the Git adapter uses a local, throwaway git repository only — no real GitHub API calls are made this sprint. PR creation is verified against a fake/local provider, not the real GitHub API, to avoid any risk to the user's actual GitHub account/repositories. Real GitHub API integration remains explicitly flagged as future work, not fabricated as already live-verified.

## In scope

Tool capability definitions (schemas, risk class, policy reference), the Tool Gateway (validate/authorise/invoke/record), an integration + credential-reference abstraction, a Git adapter (repository read/branch/commit operations via the real `git` CLI against a repository — local or remote, since git itself is provider-agnostic), a controlled ephemeral development workspace, repository-context retrieval (bounded file listing/read/search, no indexing infrastructure), a development agent that executes an approved implementation plan into a real code change, a PR-creation capability (behind a swappable provider port; fake/local provider exercised live this sprint), mutation safety controls (idempotency, an explicit branch-binding check design, audit), a minimal development UI (workspace/diff/PR evidence), and an end-to-end proof of approved-plan → workspace → code change → PR evidence.

## Out of scope / deferred

Production deployment, multiple Git providers, unrestricted tool execution (source §4, verbatim). Also explicitly out of scope for this sprint (per the user's live-verification scoping decision): real GitHub API calls of any kind — real PR creation, real branch pushes to a real remote, and GitHub credential/OAuth handling are designed as a swappable port but not live-exercised.

## Sprint-wide acceptance criteria

- Tool actions are authorised centrally, independent of model output (Tool Gateway).
- Tool authority is re-evaluated on every invocation; the existence of a workflow task or agent instruction never itself grants permission.
- Credentials are referenced, never stored or logged as plaintext; raw secrets never reach agent context.
- The Git adapter can read a repository, create a branch, and create a commit, verified against a real (local) git repository.
- A development workspace is isolated per task and contains no unrelated credentials.
- The development agent executes only through the Tool Gateway — it does not directly access infrastructure.
- Tool invocations are idempotent and fully audited.
- The full slice (approved plan → workspace → code change → PR evidence) is demonstrated end-to-end.

(Source §8, Sprint-Level Definition of Done, concretized against the specs above.)

## Quality gates

Tool Gateway authorization determinism (policy-evaluator-backed, no model dependency), capability input/output schema validation, credential-reference-only persistence (no plaintext secrets in the database or logs), Git adapter correctness against a real local repository, workspace isolation (no credential leakage), idempotent tool invocation (a duplicate request does not duplicate the external side effect), and full audit coverage of every tool invocation and PR-creation attempt.

## Key risks (source §11, carried forward verbatim)

- **Scope creep** — protect the vertical slice; defer non-essential platform features.
- **Architecture drift** — enforce package boundaries and contract tests.
- **Agent quality** — require structured outputs, evidence, and regression fixtures.
- **Security** — never let model output become authority (the development agent proposes a code change; the Tool Gateway, not the model, authorizes and executes it).
- **Provider lock-in** — use adapters from the first implementation (the Git adapter must not assume GitHub-specific behavior beyond the adapter boundary, even though GitHub is the only provider named in the specs).
- **Reliability** — test restart, duplicate delivery, and idempotency before adding autonomy (directly relevant to DEVOS-059's mutation-safety controls, given this sprint introduces the first _external, real-world_ side effects of the whole POC).
- **Over-engineering** — prefer modular monolith patterns until scale proves extraction necessary.

## Exit criteria

Sprint 4 is complete when its sprint-level Definition of Done is met, the demo (approved plan → workspace → code change → pull request evidence) can be performed in the target environment, and no critical defect or security issue remains open against the sprint goal. (Source §12.)
