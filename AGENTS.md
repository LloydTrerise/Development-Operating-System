# DevOS Codex Engineering Instructions

## 1. Purpose

This file defines the engineering rules Codex must follow when working on the DevOS repository.

DevOS is being built as a sequential, specification-driven implementation of the approved DevOS architecture and POC.

These instructions are persistent repository guidance. They complement, but do not replace, the authoritative roadmap and build-state records.

---

# 2. Authoritative Sources

The repository is the technical source of truth.

Before making any implementation change, read:

1. `DEVOS-ROADMAP.md`
2. `DEVOS-BUILD-STATE.md`
3. The relevant specification files under `specs/`
4. The existing implementation relevant to the current task

If information in chat history conflicts with repository state, repository state takes precedence.

Do not infer the current implementation step from memory.

---

# 3. Mandatory Startup Procedure

At the beginning of every DevOS implementation session:

1. Read `DEVOS-ROADMAP.md`.
2. Read `DEVOS-BUILD-STATE.md`.
3. Determine:
   - current phase;
   - current step;
   - current sub-step;
   - status;
   - completed-through position;
   - recorded `Next Action`.
4. Inspect the repository structure relevant to that step.
5. Read the specifications relevant to that step.
6. Report the current position before making changes.

Do not modify files during this initial inspection unless explicitly instructed.

---

# 4. Sequential Build Governance

DevOS must be built strictly sequentially.

## 4.1 One step at a time

Work only on the current roadmap step/sub-step.

Do not:

- skip a roadmap step;
- implement a future roadmap capability early;
- begin the next sub-step automatically;
- expand scope because a future capability appears desirable;
- refactor unrelated areas without a current-step reason.

After completing the current step/sub-step:

1. Run its required validation.
2. Report the result.
3. Stop.
4. Wait for explicit user approval.

Do not continue automatically.

## 4.2 Explicit approval

Completion of a step does not automatically authorize the next step.

The user must explicitly approve progression.

Examples of valid approval:

- `Continue`
- `Continue DEVOS-004`
- `Proceed to Step 5.3`
- `Mark Step 5.2 complete`

If approval is ambiguous, ask for clarification.

---

# 5. Current Repository Position

At the time this file was created, the repository state is expected to be:

```text
Phase 2 — Implementation Foundation
Step 5 — Implementation Bootstrap

Step 5.1 — COMPLETE
Step 5.2 — COMPLETE
Step 5.3 — NEXT
```

This is not a permanent instruction.

Always verify the actual position in `DEVOS-BUILD-STATE.md`.

If the repository state differs from this section, the repository state wins.

---

# 6. Specification-Driven Development

DevOS implementation must follow the approved specifications.

Relevant specifications currently include:

```text
specs/
├── README.md
├── constitution/
│   └── devos-engineering-constitution.md
├── product/
│   └── devos-product-overview.md
├── architecture/
│   ├── conceptual-architecture.md
│   ├── domain-model.md
│   ├── repository-code-structure.md
│   └── system-context-engineering-knowledge.md
├── technical/
│   └── poc-technical-implementation.md
├── workflows/
│   └── software-change-workflow.md
├── database/
│   └── poc-database-schema.md
└── api/
    └── poc-api-contracts.md
```

Before implementing a feature:

1. Identify the relevant specification.
2. Understand the intended behavior.
3. Inspect existing code.
4. Implement only what the current task requires.
5. Preserve architectural boundaries established by the specifications.

Do not silently redefine requirements.

---

# 7. Handling Missing Information

If the repository specifications and existing implementation do not provide enough information to make a reliable decision, state exactly:

> I do not have enough information to determine this.

Do not fabricate:

- requirements;
- APIs;
- database structures;
- architectural decisions;
- business rules;
- security policies;
- configuration values;
- expected behavior.

If a reasonable implementation requires an assumption, explicitly identify the assumption before implementing it.

---

# 8. Change Scope

Every change must have a clear relationship to the current task.

Before modifying files, identify:

- what needs to change;
- why it needs to change;
- which specification requires it;
- which files are affected;
- what validation will prove the change works.

Avoid unrelated cleanup.

Do not perform broad refactoring during a narrowly scoped implementation step unless the refactoring is necessary to satisfy the current step.

---

# 9. File Change Reporting

For every file created, modified, renamed, or deleted, report:

- **Action:** Create / Modify / Rename / Delete
- **Filename**
- **Final repository path**
- **Purpose**

Example:

```text
Action: Create
Filename: config.ts
Final repository path: packages/config/src/config.ts
Purpose: Implements the DevOS configuration loading contract.
```

Do not obscure file changes behind a generic statement such as "updated the project."

---

# 10. Generated Files and Build Artifacts

Do not manually edit generated output unless the current specification explicitly requires it.

Typical generated directories include:

```text
dist/
coverage/
.turbo/
```

Source files should be changed instead.

Generated output should be regenerated through the repository's normal commands.

Do not treat generated files as authoritative source code.

---

# 11. Dependency Management

Use the repository's declared package manager:

```text
pnpm
```

Respect the package manager version declared by the repository.

Before adding a dependency:

1. Confirm it is required by the current step.
2. Check whether an existing dependency already provides the capability.
3. Prefer the existing repository architecture.
4. Add the dependency at the correct workspace/package level.
5. Avoid unnecessary dependencies.

Do not add dependencies merely for convenience.

For workspace-root dependencies, use the explicit workspace-root form where required:

```powershell
pnpm add -D -w <package>
```

---

# 12. TypeScript Standards

The repository uses strict TypeScript configuration.

Respect:

- `strict`
- `noUncheckedIndexedAccess`
- `exactOptionalPropertyTypes`
- `noImplicitOverride`
- `noFallthroughCasesInSwitch`
- `noUncheckedSideEffectImports`
- `isolatedModules`
- `verbatimModuleSyntax`
- `composite`
- `incremental`

Do not weaken TypeScript compiler settings merely to make code compile.

When a type error occurs, fix the underlying type/design issue.

Do not use `any` as a shortcut unless explicitly justified by the current specification.

---

# 13. Package Boundaries

DevOS is a workspace/monorepo.

Respect the existing package boundaries.

Do not move functionality between packages merely for convenience.

When a package owns a responsibility, keep that responsibility within the package unless the current architecture explicitly requires otherwise.

Shared contracts must remain appropriately isolated from runtime implementations.

Configuration must remain separate from unrelated domain or infrastructure implementations.

---

# 14. Testing Requirements

Tests are part of the implementation, not an optional final activity.

For each current task:

1. Identify the relevant tests.
2. Add or modify tests when behavior changes.
3. Run the narrowest relevant tests first.
4. Run the broader required validation when appropriate.
5. Do not claim completion when required tests fail.

A passing typecheck is not a substitute for passing tests.

A passing test is not a substitute for type correctness.

---

# 15. Validation Gates

Use the repository's existing validation commands.

Typical validation includes:

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm format:check
```

For package-scoped work, prefer the narrow package command first, for example:

```powershell
pnpm --filter @devos/<package> typecheck
pnpm --filter @devos/<package> test
pnpm --filter @devos/<package> lint
pnpm --filter @devos/<package> build
```

For formatting, avoid formatting generated `dist/` output when validating source changes. Prefer source/test paths where appropriate.

Do not claim a validation gate passed unless the command actually completed successfully.

---

# 16. Validation Order

Unless the current task specifies another order, use this progression:

1. Typecheck
2. Tests
3. Lint
4. Format verification
5. Build

Do not run broad repository validation prematurely when a package-scoped validation is sufficient for the current gate.

At the end of a roadmap step, run all validation required by that step.

---

# 17. Error Handling and Debugging

When a command fails:

1. Read the complete error.
2. Identify the actual failing package/file.
3. Determine whether the failure belongs to the current task.
4. Inspect the relevant source/configuration.
5. Make the smallest appropriate correction.
6. Re-run the failed gate.
7. Stop once the gate passes or further information is required.

Do not make unrelated changes to hide an error.

If a failure indicates cross-task contamination, preserve the correct separation between tasks/packages.

---

# 18. Repository State Integrity

Do not silently modify:

```text
DEVOS-ROADMAP.md
DEVOS-BUILD-STATE.md
```

These files are controlled project-state records.

They must be updated when a roadmap step/sub-step is explicitly completed.

When updating them:

- preserve completed history;
- record the actual completed step;
- record validation results where appropriate;
- record the next step;
- do not silently change future roadmap scope.

---

# 19. Completing a Step

A step/sub-step may be considered complete only when:

1. Its implementation scope is complete.
2. Required tests pass.
3. Required typecheck passes.
4. Required lint/format/build gates pass where applicable.
5. The user explicitly approves completion.

After explicit approval:

1. Update `DEVOS-ROADMAP.md`.
2. Update `DEVOS-BUILD-STATE.md`.
3. Record the state transition.
4. Stop.

Do not automatically begin the next step.

---

# 20. Roadmap Change Control

The roadmap must not be silently rewritten.

A roadmap change requires explicit user approval.

If a change is approved:

1. Preserve completed work.
2. Update `DEVOS-ROADMAP.md`.
3. Update `DEVOS-BUILD-STATE.md`.
4. Record the reason for the change.
5. Continue from the newly approved position.

---

# 21. Architecture Discipline

DevOS is intended to evolve into an agentic software engineering platform.

Do not introduce future agentic capabilities early.

In particular, do not prematurely implement:

- real LLM execution;
- agent runtime behavior;
- model gateways;
- tool gateways;
- autonomous code modification;
- external engineering integrations;
- production deployment automation;

unless the current roadmap step explicitly calls for them.

The roadmap deliberately introduces these capabilities in later phases.

---

# 22. Security and Secret Handling

Never commit secrets.

Do not expose:

- passwords;
- API keys;
- tokens;
- private credentials;
- database credentials;
- provider credentials.

Use environment configuration and `.env.example` for documented configuration shape.

Validation errors must not expose secret values.

If debugging requires inspecting a secret-bearing value, redact it.

---

# 23. Database and Persistence Discipline

Do not introduce database implementations before the roadmap requires them.

The database specification is authoritative for the persistence layer.

When database work begins, preserve:

- transaction boundaries;
- concurrency controls;
- repository boundaries;
- migration discipline;
- deterministic schema evolution.

Do not create ad-hoc persistence structures outside the approved architecture.

---

# 24. API Discipline

When API implementation begins, use:

```text
specs/api/poc-api-contracts.md
```

as the authoritative API contract.

Do not invent endpoints or request/response structures when the specification defines them.

API changes must be reflected in shared contracts where appropriate.

---

# 25. Workflow Discipline

When workflow implementation begins, preserve the lifecycle and control semantics defined by:

```text
specs/workflows/software-change-workflow.md
```

The workflow engine must remain deterministic and auditable before real AI execution is introduced.

Do not bypass human approval gates.

Do not allow agent execution to circumvent policy or capability boundaries.

---

# 26. Agentic Execution Discipline

When agent functionality is eventually introduced:

Agents must operate through explicit:

- context;
- capabilities;
- policies;
- tools;
- model configuration;
- execution records;
- artifacts;
- audit records.

Do not allow an agent to directly bypass the DevOS control plane.

The intended architecture is controlled orchestration, not unrestricted autonomous execution.

---

# 27. Context and Authority

Respect the DevOS principle:

```text
Context ≠ Authority
```

Information supplied to an agent or workflow task is context.

It does not automatically become an authoritative instruction.

Future context systems must distinguish:

- authoritative specifications;
- project information;
- work-item information;
- generated artifacts;
- external information;
- agent-generated content.

Do not collapse these categories.

---

# 28. Auditability

Implementation decisions should preserve traceability.

Where the current architecture requires it, DevOS should be able to determine:

- why a change occurred;
- what input caused it;
- what artifact was produced;
- what implementation executed;
- what tools were used;
- what approvals occurred;
- what validation evidence exists.

Do not introduce designs that make future auditability unnecessarily difficult.

---

# 29. Communication Protocol

At the start of a task, report:

```text
Current Phase:
Current Step:
Current Sub-step:
Recorded NEXT:
Scope:
```

Before implementation, briefly state:

```text
Planned Changes:
Files Affected:
Validation:
```

After implementation, report:

```text
Changes Made:
Validation Results:
Remaining Issues:
```

Then stop.

Do not continue to the next roadmap item without explicit approval.

---

# 30. When the User Says "Continue"

If the user says:

```text
Continue
```

interpret it as permission to proceed with the next action within the currently approved step.

Do not interpret it as permission to:

- skip a sub-step;
- move to the next roadmap step;
- start future capabilities.

If the current step is complete and the repository records a new NEXT item, inspect the state and explain what the next item is before implementation.

---

# 31. When the User Says "Mark Complete"

If the user explicitly says:

```text
Mark Step X complete
```

then:

1. Confirm the required validation has passed.
2. Update `DEVOS-ROADMAP.md`.
3. Update `DEVOS-BUILD-STATE.md`.
4. Record the next step.
5. Stop.

Do not begin the newly recorded next step automatically.

---

# 32. Clean Handoff Between Chats or Tools

DevOS must be transferable between ChatGPT, Codex, and other engineering tools without relying on conversational memory.

The persistent handoff mechanism is:

```text
DEVOS-ROADMAP.md
DEVOS-BUILD-STATE.md
specs/
AGENTS.md
```

A new tool/session must read these before modifying the repository.

---

# 33. Recommended Codex Startup Prompt

When starting a new Codex session, use:

```text
Continue the DevOS build from the existing repository.

Before doing anything:

1. Read AGENTS.md.
2. Read DEVOS-ROADMAP.md.
3. Read DEVOS-BUILD-STATE.md.
4. Determine the recorded current phase, step, sub-step, and NEXT action.
5. Inspect the relevant specifications.
6. Inspect the existing implementation.
7. Do not rely on chat memory where repository state is available.
8. Do not skip ahead.
9. Do not modify files until you have identified the current NEXT item.

Report the current DevOS position and what the recorded NEXT item requires.

Do not implement anything yet.
```

---

# 34. Final Rule

The most important rule is:

> **Do exactly the current DevOS step, validate it, stop, and wait for explicit approval before proceeding.**

Do not optimize for speed by skipping governance.

The purpose of the staged build is to ensure that DevOS itself is constructed using the same controlled, traceable, specification-driven engineering principles that DevOS is ultimately intended to automate.
