# DevOS Build Roadmap

**Product:** DevOS  
**Purpose:** Authoritative roadmap for the DevOS implementation build  
**Repository:** `C:\Development\devos`  
**Last Updated:** 2026-08-20

---

## 1. Purpose

This document is the authoritative roadmap for building DevOS.

The roadmap takes DevOS from its completed specification foundation through implementation of the POC control plane, deterministic workflow validation, real agent execution, controlled engineering tools, and final POC acceptance.

The roadmap is intentionally sequential.

---

## 2. Build Governance Rules

### 2.1 One step at a time

DevOS is built one step/sub-step at a time.

The assistant must:

1. Work only on the current step/sub-step.
2. Complete the requested step/sub-step.
3. Stop.
4. Wait for explicit user confirmation before proceeding.
5. Never skip ahead without the user's instruction.

### 2.2 Repository is the technical source of truth

The repository specification files and build-state files are authoritative.

Chat memory provides continuity between conversations, but if there is a conflict, the repository state takes precedence.

### 2.3 File handling rule

For every file created, renamed or modified, explicitly state:

- **Action:** Create / Rename / Modify
- **Filename**
- **Final repository path**
- **Purpose**

When generating Markdown/specification files, provide a downloadable `.md` file rather than a large Markdown block for manual copying.

### 2.4 No premature implementation

Do not implement future roadmap capabilities early merely because they are desirable.

Each step must satisfy its own acceptance criteria before the next step begins.

---

# 3. Roadmap

## Phase 1 — Specification & Architecture Foundation

### Step 1 — Repository Foundation
**Status:** COMPLETE

Initial DevOS repository and development environment established.

### Step 2 — Initial Project Foundation
**Status:** COMPLETE

Initial project/tooling foundation established.

### Step 3 — Specification Foundation
**Status:** COMPLETE

The core DevOS specification foundation was established.

### Step 4 — Complete POC Specifications
**Status:** COMPLETE

The complete POC specification set is in place.

---

## Phase 2 — Implementation Foundation

### Step 5 — Implementation Bootstrap
**Status:** CURRENT

Establish the actual implementation structure described by the specifications.

Planned areas:

- monorepo/workspace configuration;
- TypeScript configuration;
- package manager configuration;
- linting;
- formatting;
- test framework;
- build configuration;
- environment configuration;
- application/package skeletons;
- initial CI foundation.

### Step 5.1 — Implementation Bootstrap Foundation
**Status:** COMPLETE

Bootstrap foundation established and validated.

### Step 5.2 — Shared Contracts & Configuration Foundation
**Status:** COMPLETE

Implemented and validated the Sprint 1 foundation tasks:

- DEVOS-003 — Shared Contracts;
- DEVOS-004 — Configuration Package.

Both tasks passed their required validation gates.

### Step 5.3
**Status:** NEXT

Proceed only after explicit user confirmation.

---

## Phase 3 — Persistence Foundation

### Step 6 — PostgreSQL & Database
**Status:** NOT STARTED

Implement the PostgreSQL system of record defined by:

`specs/database/poc-database-schema.md`

Includes:

- Docker PostgreSQL;
- migrations;
- database connection;
- schema;
- repositories;
- seed data;
- transaction support;
- concurrency controls.

---

## Phase 4 — API & Contract Foundation

### Step 7 — API Implementation
**Status:** NOT STARTED

Implement the API contracts defined by:

`specs/api/poc-api-contracts.md`

Initial areas:

- health;
- projects;
- work items;
- workflows;
- workflow versions;
- workflow runs;
- tasks;
- artifacts.

---

## Phase 5 — Domain & Application

### Step 8 — Core Domain Implementation
**Status:** NOT STARTED

Implement the DevOS domain entities, value objects, rules and state transitions.

Core concepts include:

- Organisation;
- Project;
- Work Item;
- Workflow;
- Workflow Version;
- Workflow Run;
- Task;
- Agent;
- Agent Version;
- Agent Execution;
- Artifact;
- Artifact Version;
- Approval;
- Policy;
- Integration;
- Tool Capability;
- Event;
- Audit Record.

---

## Phase 6 — Workflow Engine

### Step 9 — Workflow Runtime
**Status:** NOT STARTED

Implement the DevOS orchestration kernel.

Includes:

- workflow loading;
- workflow versioning;
- run creation;
- task creation;
- task transitions;
- dependencies;
- retries;
- failure;
- completion;
- cancellation;
- pause/resume;
- durable execution state.

---

## Phase 7 — Asynchronous Execution

### Step 10 — Queue & Worker
**Status:** NOT STARTED

Implement asynchronous task execution.

Target flow:

`API → Task → Queue → Worker → Execute → Persist Result → Advance Workflow`

Worker restart/recovery must be demonstrated.

---

## Phase 8 — Evidence & Artifacts

### Step 11 — Artifact Management
**Status:** NOT STARTED

Implement:

- Artifact;
- Artifact Version;
- provenance;
- content references;
- retrieval.

The system must support versioned engineering artifacts such as:

- Discovery Report;
- PRD;
- Technical Design;
- Implementation Plan;
- Validation Evidence;
- Review Evidence;
- Release Evidence.

---

## Phase 9 — Human Control

### Step 12 — Approvals & Policies
**Status:** NOT STARTED

Implement the governance/control layer.

Initial gates:

`Planning Approval → Development → Release Approval`

Includes:

- approval requests;
- approve/reject;
- evidence binding;
- policy evaluation;
- audit trail.

---

## Phase 10 — Deterministic Vertical Slice

### Step 13 — Deterministic Software Change Workflow
**Status:** NOT STARTED

Run the complete Software Change Workflow using deterministic task implementations before introducing real AI.

Target:

`Work Item → Intake → Discovery → PRD → Technical Design → Implementation Plan → Human Approval → Development → Validation → Review → Release Readiness → Closure`

This proves the DevOS control plane independently of AI variability.

---

## Phase 11 — Context & Knowledge

### Step 14 — Engineering Context System
**Status:** NOT STARTED

Implement task-specific context assembly and context manifests.

Initial context sources:

- Project;
- Work Item;
- Repository;
- Architecture;
- Artifacts;
- Policies.

Principle:

`Context ≠ Authority`

---

## Phase 12 — Agent Runtime

### Step 15 — Agent Framework
**Status:** NOT STARTED

Introduce the real DevOS agent abstraction.

Initial agent roles:

- Triage Agent;
- Discovery Agent;
- Requirements Agent;
- Architect Agent;
- Planning Agent.

Agents are versioned and execute within explicit context and capability boundaries.

---

## Phase 13 — Model Gateway

### Step 16 — LLM / Model Gateway
**Status:** NOT STARTED

Implement:

`Agent → Agent Runtime → Model Gateway → Provider Adapter → LLM`

Includes:

- structured outputs;
- provider abstraction;
- model configuration;
- retries;
- timeout handling;
- failure handling;
- cost/token tracking;
- prompt/version references.

---

## Phase 14 — Tool Gateway

### Step 17 — Engineering Tool Integration
**Status:** NOT STARTED

Introduce controlled external engineering actions.

Initial integrations:

- Git;
- issue tracker;
- CI/test.

Target:

`Agent → Tool Gateway → Policy → Capability → Provider Adapter → External System`

Start with read-heavy operations before controlled mutations.

---

## Phase 15 — AI Planning Vertical Slice

### Step 18 — AI-Assisted Planning
**Status:** NOT STARTED

Execute a real work item through:

`Work Item → Discovery Agent → PRD → Architect Agent → Technical Design → Planning Agent → Implementation Plan → Human Approval`

This is the first major proof of the strategic DevOS capability.

---

## Phase 16 — Development Agent

### Step 19 — AI-Assisted Implementation
**Status:** NOT STARTED

Extend the workflow to:

`Approved Plan → Development Agent → Repository → Code → Tests → Pull Request`

The development agent operates through the Tool Gateway.

---

## Phase 17 — Validation & Review

### Step 20 — Automated Engineering Validation
**Status:** NOT STARTED

Implement:

- build;
- lint;
- type checking;
- unit tests;
- integration tests;
- contract tests;
- E2E tests;
- security checks;
- review;
- rework loop.

Target:

`Development → Validation → Review → PASS / Rework`

---

## Phase 18 — Controlled Release

### Step 21 — Controlled Release
**Status:** NOT STARTED

Implement:

- release readiness;
- release approval;
- staging deployment;
- release evidence;
- rollback information;
- closure.

Production automation remains controlled until governance is proven.

---

## Phase 19 — Engineering Intelligence

### Step 22 — DevOS Engineering Intelligence
**Status:** NOT STARTED

Capture operational intelligence such as:

- workflow duration;
- stage duration;
- agent duration;
- human wait time;
- rework;
- failures;
- tool failures;
- approval time;
- cost;
- success rate.

---

## Phase 20 — POC Hardening

### Step 23 — Security & Reliability Hardening
**Status:** NOT STARTED

Test:

- tenant/project isolation;
- permission bypass;
- context/prompt injection;
- tool abuse;
- secret exposure;
- replay;
- duplicate execution;
- worker failure;
- database failure;
- provider failure;
- malicious artifacts;
- audit integrity.

---

## Phase 21 — POC Acceptance

### Step 24 — End-to-End DevOS Demonstration
**Status:** NOT STARTED

Demonstrate:

`Real Work Item → AI Discovery → AI Requirements → AI Architecture → AI Implementation Plan → Human Approval → AI Development → Automated Tests → AI Review → Release Gate → Controlled Release → Complete Audit Trail`

The demonstration must provide traceability for:

- why the change happened;
- what information was used;
- which agent performed each execution;
- which tools were used;
- what humans approved;
- what changed;
- what evidence proves the result.

---

# 4. Current Position

**Current Phase:** Phase 2 — Implementation Foundation

**Current Step:** Step 5 — Implementation Bootstrap

**Current Sub-step:** Step 5.3

**Status:** NEXT

**Completed through:** Step 5.2

**Do not proceed to Step 5.3 until the user explicitly approves proceeding.**

---

# 5. Completed Specification Files

The following files are currently part of the DevOS specification foundation:

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

---

# 6. Continuity Protocol

If work continues in a new chat, the assistant should:

1. Read `DEVOS-ROADMAP.md`.
2. Read `DEVOS-BUILD-STATE.md`.
3. Determine the recorded current step.
4. Check the repository structure where necessary.
5. Continue only from the recorded NEXT item.
6. Never restart the roadmap from memory if repository state is available.
7. Never skip a step.
8. Stop after the current step/sub-step.
9. Wait for explicit user approval before continuing.
10. Update the build-state file whenever a step/sub-step is completed.

Recommended new-chat instruction:

> Continue the DevOS build. Read `DEVOS-ROADMAP.md` and `DEVOS-BUILD-STATE.md` first. Determine the current step and continue only from the recorded NEXT step. Do not skip ahead.

---

# 7. Roadmap Change Control

The roadmap may change as DevOS evolves.

A roadmap change must:

1. be explicitly requested or approved;
2. preserve completed work;
3. update this document;
4. update `DEVOS-BUILD-STATE.md`;
5. record the reason for the change.

The assistant must not silently rewrite the roadmap.

---

# 8. Definition of Roadmap Completion

The roadmap is complete when Step 24 has passed the defined POC acceptance criteria and DevOS can demonstrate the end-to-end software change lifecycle with traceable AI-assisted engineering execution.
