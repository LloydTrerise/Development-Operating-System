# DevOS POC Technical Implementation Specification

**Document:** POC Technical Implementation Specification  
**Product:** DevOS  
**Version:** 1.0  
**Purpose:** Sprint 1 Technical Implementation Baseline  
**Repository:** `C:\Development\devos`

---

## 1. Purpose

This specification defines the technical implementation baseline for the DevOS POC.

It translates the approved DevOS conceptual architecture, domain model, repository structure, and POC technical architecture into an implementation-oriented baseline for the first working vertical slice.

The POC is intentionally a **modular monolith with asynchronous workers**.

The objective is to prove that DevOS can reliably orchestrate software-development work with:

- durable workflow state;
- PostgreSQL persistence;
- asynchronous task execution;
- versioned contracts;
- controlled application boundaries;
- artifacts;
- events and audit;
- project isolation;
- restart/recovery behaviour.

The first proof point is reliable orchestration, not autonomous AI.

---

## 2. POC Architectural Position

The DevOS POC uses:

```text
Web
  |
REST API
  |
Application Services
  |
Domain
  |
PostgreSQL + Outbox
  |
Queue / Worker
  |
Deterministic Task Stub
  |
Artifact Store
```

This is a vertical-slice implementation.

The architecture must retain the boundaries required to replace the deterministic task stub with real agent execution in a later sprint.

---

## 3. Core Technical Decisions

| Area                        | POC Decision                           |
| --------------------------- | -------------------------------------- |
| Architecture style          | Modular monolith                       |
| Runtime model               | Asynchronous workers                   |
| API                         | REST/JSON                              |
| Persistence                 | PostgreSQL                             |
| Durable workflow state      | PostgreSQL                             |
| Event delivery              | Transactional outbox                   |
| Background execution        | Queue + worker                         |
| Agent execution in Sprint 1 | Deterministic stub                     |
| Artifact metadata           | PostgreSQL                             |
| Large artifact content      | Object-storage boundary                |
| AI execution                | Deferred to Sprint 2                   |
| External actions            | Tool Gateway boundary                  |
| Human control               | Approval state                         |
| Security                    | Server-side identity, scope and policy |
| Deployment                  | Local/containerised POC                |
| Service extraction          | Deferred until justified               |

---

## 4. Architecture Principles

### 4.1 Modular monolith first

DevOS should begin as a modular monolith.

Modules must have explicit boundaries even though they execute within the same deployable application.

Microservices are not required for the POC.

### 4.2 Durable state

Workflow and task state must not depend on worker memory.

A worker restart must not cause a workflow to appear completed when it was not.

### 4.3 Asynchronous execution

Long-running work must execute asynchronously.

The API should create or request execution and return without holding an HTTP request open for the complete workflow.

### 4.4 Contract-first boundaries

API, event, artifact, agent, and tool boundaries should have explicit schemas.

### 4.5 Server-side authority

Security, project scope, policy, and approval authority must be enforced by the server.

Model output is never itself an authority decision.

### 4.6 Provider abstraction

Provider-specific SDKs must remain behind adapter boundaries.

### 4.7 Versioned AI behaviour

Future agent instructions, workflows, and artifacts must be versioned so historical executions remain interpretable.

### 4.8 Explicit context

Every agent task must eventually receive an explicit context package.

---

## 5. Technical Module Model

The POC aligns with the repository structure:

```text
apps/
├── api/
├── worker/
└── web/

packages/
├── domain/
├── application/
├── workflow/
├── agents/
├── knowledge/
├── artifacts/
├── tools/
├── policy/
├── identity/
├── integrations/
├── events/
├── database/
├── contracts/
├── observability/
└── config/
```

Not every package requires full implementation in Sprint 1.

Only capabilities needed by the vertical slice should be implemented.

---

## 6. API Application

The API application is responsible for:

- HTTP handling;
- authentication middleware;
- authorisation;
- request validation;
- routing;
- controller translation;
- application-service invocation;
- response formatting;
- error handling;
- correlation.

Controllers must not contain domain logic or direct database queries.

The API must use shared contracts.

---

## 7. Worker Application

The worker application is responsible for asynchronous task execution.

Responsibilities include:

- consuming queued work;
- loading durable workflow/task state;
- invoking application services;
- executing task handlers;
- recording task results;
- publishing durable events;
- handling retry/recovery behaviour.

Worker handlers must remain thin.

Business behaviour belongs in application/domain modules.

---

## 8. Web Application

The web application provides the minimum operational UI required to demonstrate the POC.

The UI should support, at minimum:

- authenticated access;
- project selection;
- work-item visibility;
- workflow start;
- workflow/run visibility;
- task status;
- artifact visibility;
- approval state where implemented;
- execution timeline where implemented.

The UI must not contain orchestration logic.

---

## 9. Domain Layer

The domain layer contains:

- entities;
- value objects;
- domain rules;
- state transitions;
- domain errors;
- domain interfaces.

The domain must not import:

- PostgreSQL clients;
- HTTP frameworks;
- React;
- provider SDKs;
- queue implementations.

The domain defines business meaning rather than infrastructure mechanics.

---

## 10. Application Layer

The application layer coordinates use cases.

Examples include:

- create project;
- create work item;
- start workflow;
- create workflow task;
- execute task;
- publish artifact;
- record approval;
- transition workflow state;
- retrieve workflow status.

Application services coordinate domain objects and infrastructure ports.

---

## 11. Workflow Runtime

The workflow runtime is the POC orchestration kernel.

It must support:

- workflow definition lookup;
- workflow version identification;
- workflow run creation;
- task creation;
- task scheduling;
- state transitions;
- completion conditions;
- failure handling;
- bounded retries;
- recovery after worker restart.

Workflow definitions should be declarative where practical.

Runtime mechanics remain code.

---

## 12. Workflow Definition

The first POC workflow is the **Software Change Workflow**.

The POC should initially prove the planning/execution control path rather than implementing every future autonomous capability.

Workflow definitions should identify:

- node identity;
- node type;
- agent/tool reference where applicable;
- input contract;
- output contract;
- transitions;
- retry policy;
- approval requirements;
- completion criteria.

Published workflow definitions must be immutable.

---

## 13. Workflow State

Workflow state is durable.

A conceptual state model is:

```text
CREATED
   |
   v
QUEUED
   |
   v
RUNNING
   |
   +----> WAITING_FOR_APPROVAL
   |
   +----> WAITING_FOR_INPUT
   |
   +----> FAILED
   |
   v
VALIDATING
   |
   v
COMPLETED
```

Cancellation should be represented explicitly where supported.

The exact legal state transitions are defined by the workflow runtime and workflow specification.

---

## 14. Task Execution

A workflow task should:

1. be created durably;
2. be eligible for execution;
3. be queued;
4. be claimed by a worker;
5. execute through an application boundary;
6. produce a result;
7. persist the result;
8. transition task state;
9. emit relevant events;
10. allow the workflow engine to determine the next transition.

A worker must not rely on in-memory state as the source of truth.

---

## 15. Queue and Worker Reliability

The POC must account for:

- duplicate delivery;
- worker restart;
- task retry;
- task timeout where applicable;
- idempotent processing;
- durable state before acknowledgement.

A job should only be acknowledged after the required durable state transition/result handling has completed.

---

## 16. Transactional Outbox

Events that represent durable state changes should use an outbox pattern where transactional consistency is required.

Conceptually:

```text
Application Transaction
       |
       +-- Update domain state
       |
       +-- Insert outbox event
       |
       v
Commit
       |
       v
Outbox Publisher
       |
       v
Event Consumer / Queue
```

This prevents the system from committing state while losing the corresponding event.

---

## 17. Database

PostgreSQL is the POC system of record.

It stores durable metadata and execution state.

The database should support:

- organisation/project scope;
- work items;
- workflow definitions and versions;
- workflow runs;
- tasks;
- agent execution metadata;
- artifact metadata;
- approvals;
- policies;
- integrations;
- events/outbox;
- audit records.

The detailed schema is defined separately in the POC database specification.

---

## 18. Database Principles

1. Use migrations.
2. Use explicit foreign keys.
3. Enforce important uniqueness constraints.
4. Enforce organisation/project scope where applicable.
5. Use transactions for related state changes.
6. Avoid direct cross-module persistence access.
7. Keep persistence models separate from domain models where necessary.
8. Index workflow/task lookup paths.
9. Preserve immutable/versioned records where required.

---

## 19. Artifact Storage

Artifact metadata should be stored in PostgreSQL.

Large artifact content should use an object-storage boundary rather than being placed directly into large database rows.

Artifact metadata should include:

- artifact identity;
- type;
- project/workflow/task association;
- version;
- status;
- provenance;
- storage reference;
- created/updated information.

Artifacts must be retrievable and version-aware.

---

## 20. Contracts

Shared contracts belong in:

```text
packages/contracts/
```

Contracts should cover:

- API requests/responses;
- workflow definitions;
- workflow run/task messages;
- artifact metadata;
- event payloads;
- agent input/output;
- tool invocation.

Schemas should be executable where practical.

The same contract should be used for validation and testing rather than duplicating definitions across applications.

---

## 21. API Baseline

The POC API uses:

```text
/api/v1
```

with:

- REST;
- JSON;
- UUID identifiers;
- explicit request/response schemas;
- standard error envelopes;
- asynchronous operation semantics.

Representative resource areas include:

```text
/projects
/work-items
/workflows
/runs
/tasks
/artifacts
/approvals
/agents
/tools
/integrations
/audit
```

The detailed API contracts are defined separately.

---

## 22. API Error Handling

Errors should use a consistent structure.

Conceptually:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {},
    "correlationId": "..."
  }
}
```

The API must not expose internal stack traces or sensitive information.

---

## 23. Idempotency and Concurrency

The POC should support idempotency for operations where duplicate requests could create duplicate effects.

Important examples include:

- workflow start;
- task execution;
- artifact publication;
- external tool mutation.

Optimistic concurrency should be used where state transitions could otherwise overwrite concurrent updates.

---

## 24. Identity and Authorisation

The API boundary must establish:

- authenticated principal;
- organisation scope;
- project scope;
- role/permission checks.

Security must not rely on model instructions.

The server must enforce access to:

- projects;
- work items;
- workflow runs;
- artifacts;
- tools;
- approvals.

Cross-project access must be rejected.

---

## 25. Configuration

Configuration must be validated at startup.

Configuration includes:

- database connection;
- queue configuration;
- application environment;
- authentication settings;
- provider configuration where applicable;
- storage configuration;
- logging settings.

Secrets must not be committed.

Use `.env.example` for names and documentation only.

---

## 26. Observability

The POC should provide structured:

- logs;
- correlation IDs;
- execution timing;
- task state transitions;
- queue metrics;
- error information;
- basic operational metrics.

Important runtime operations must be observable.

Sensitive values must not be logged.

---

## 27. Audit

Audit records should identify:

- actor;
- action;
- target;
- project;
- workflow/task where relevant;
- timestamp;
- outcome;
- correlation;
- applicable policy/approval where relevant.

Audit records must never contain raw credentials.

---

## 28. Security Boundaries

The POC must preserve these boundaries:

```text
User
  |
  v
API / Authorisation
  |
  v
Application
  |
  v
Domain
  |
  +----> Database
  |
  +----> Workflow Runtime
  |
  +----> Tool Gateway
  |
  +----> Agent Runtime
```

Agents must not directly access infrastructure.

Tools must not bypass policy.

Provider SDKs must not leak into domain/application logic.

---

## 29. Agent Runtime Boundary

The POC Sprint 1 uses a deterministic task implementation.

The future agent runtime must fit behind an explicit boundary such as:

```text
Agent Execution
      |
      v
Agent Runtime
      |
      v
Model Gateway
      |
      v
Provider Adapter
```

This permits Sprint 2 to introduce real model execution without redesigning the workflow domain.

---

## 30. Context Boundary

The future context system must fit behind an explicit boundary.

Conceptually:

```text
Task
 |
 v
Context Assembly
 |
 +-- Project Context
 +-- Work Item
 +-- Approved Artifacts
 +-- Repository Context
 +-- Policies
 +-- Knowledge
 |
 v
Context Manifest
 |
 v
Agent Runtime
```

Context must be authorised, relevant, traceable, and version-aware.

---

## 31. Tool Gateway Boundary

External actions must be requested through the Tool Gateway.

Conceptually:

```text
Agent / Workflow
       |
       v
Tool Gateway
       |
       +-- Policy Check
       +-- Permission Check
       +-- Input Validation
       |
       v
Provider Adapter
       |
       v
External System
```

Provider-specific mechanics remain in integration packages.

---

## 32. Failure Handling

Failures should be represented explicitly.

Relevant failure classes include:

- validation failure;
- task execution failure;
- queue failure;
- database failure;
- provider failure;
- permission failure;
- policy failure;
- missing context;
- approval rejection.

Retry must be bounded.

After retry limits are reached, the workflow should enter an explicit failure or rework state rather than appearing successful.

---

## 33. Worker Restart Recovery

The POC must test worker restart.

A worker restart must not:

- lose durable task state;
- falsely complete a task;
- orphan a workflow;
- create uncontrolled duplicate side effects.

The exact recovery mechanism is an implementation detail, but durable state and idempotency are mandatory.

---

## 34. Project Isolation

All project-owned operations must enforce project scope.

A user or agent operating in Project A must not access Project B data unless explicitly authorised.

This applies to:

- work items;
- workflow runs;
- tasks;
- artifacts;
- repository information;
- integrations;
- events;
- audit information.

---

## 35. Published Definition Immutability

Published workflow definitions and versions must not be modified in place.

If a workflow changes:

```text
Software Change v1
        |
        v
Software Change v2
```

Historical runs continue to reference v1.

The same principle applies to agent configurations and artifacts where versioning is required.

---

## 36. POC Agent Strategy

Sprint 1 deliberately does not begin with real LLM integration.

Instead:

```text
Workflow Task
     |
     v
Deterministic Task Stub
     |
     v
Structured Artifact
```

The stub proves:

- workflow scheduling;
- task execution;
- artifact publication;
- event generation;
- auditability;
- durable state;
- restart/recovery.

Sprint 2 introduces the real agent runtime and planning intelligence.

---

## 37. POC Software Change Workflow

The reference workflow is:

```text
Work Item
   |
   v
Intake & Triage
   |
   v
Discovery & Analysis
   |
   v
Requirements
   |
   v
Technical Design
   |
   v
Implementation Planning
   |
   v
Human Planning Approval
   |
   v
Development
   |
   v
Automated Validation
   |
   v
Engineering Review
   |
   v
Release Readiness
   |
   v
Release
   |
   v
Closure
```

The POC should progressively implement this as vertical slices.

The first implementation proof should establish the durable control plane and planning path before adding full autonomous development.

---

## 38. Sprint 1 Scope

Sprint 1 focuses on:

- repository bootstrap;
- database;
- migrations;
- contracts;
- configuration;
- API;
- worker;
- web shell;
- identity abstraction;
- projects;
- work items;
- workflow definitions;
- workflow runs/tasks;
- queue;
- deterministic task;
- artifacts;
- events/outbox;
- audit;
- basic UI;
- E2E;
- CI;
- hardening.

---

## 39. Sprint 1 Out of Scope

Sprint 1 should not attempt to deliver:

- real LLM execution;
- production deployment;
- vector database;
- agent marketplace;
- plugin marketplace;
- multiple specialist stores;
- autonomous production deployment;
- complex enterprise governance;
- unnecessary microservices.

The first proof point is reliable orchestration.

---

## 40. Sprint 2 Direction

Sprint 2 introduces the real agent framework and planning intelligence.

The expected direction is:

```text
Work Item
   |
   v
Real Agent Runtime
   |
   v
Discovery
   |
   v
PRD
   |
   v
Technical Design
   |
   v
Implementation Plan
   |
   v
Human Planning Gate
```

Real LLM integration should therefore be introduced only after the Sprint 1 control plane is reliable.

---

## 41. Implementation Sequence

The recommended technical implementation sequence is:

1. Repository/tooling bootstrap.
2. Database and migrations.
3. Contracts and configuration.
4. API/worker/web shells.
5. Identity abstraction.
6. Projects.
7. Work items.
8. Workflow definitions and versions.
9. Workflow runs and tasks.
10. Queue.
11. Deterministic task execution.
12. Artifacts.
13. Events/outbox.
14. Audit.
15. Basic UI.
16. E2E vertical slice.
17. CI.
18. Hardening.

---

## 42. Quality Gates

The POC must enforce:

| Gate         | Evidence                             |
| ------------ | ------------------------------------ |
| Architecture | Dependency rules pass                |
| Database     | Migration and constraints            |
| API          | Contract tests                       |
| Security     | Authentication and project isolation |
| Runtime      | Worker restart/retry test            |
| Data         | Artifact version/provenance          |
| Events       | Outbox test                          |
| UI           | Basic workflow visibility            |
| E2E          | Vertical slice passes                |
| CI           | Automated quality gates              |

---

## 43. Local Development

The expected developer workflow is:

```text
pnpm install
      |
      v
Start PostgreSQL
      |
      v
Run migrations
      |
      v
Seed development data
      |
      v
Start API / Worker / Web
      |
      v
Run tests
      |
      v
Run reference workflow
```

Docker is used for PostgreSQL and other local infrastructure required by the POC.

---

## 44. Build and Validation

The repository should support:

```text
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm test:contract
pnpm test:integration
pnpm test:e2e
pnpm build
pnpm dev
```

Exact scripts may be adapted to the selected tooling, but the repository must expose consistent commands for local development and CI.

---

## 45. CI

CI must validate:

- installation;
- type checking;
- lint;
- unit tests;
- contract tests;
- build;
- dependency/security scanning;
- relevant integration tests;
- relevant E2E tests.

The pipeline must fail on relevant quality-gate failures.

---

## 46. Architecture Fitness

The implementation should explicitly prevent:

1. domain importing infrastructure;
2. API importing provider SDKs;
3. worker bypassing application services;
4. agents bypassing the tool gateway;
5. tools bypassing policy;
6. project-scope violations;
7. published workflow mutation;
8. large artifact content being stored directly in database rows.

---

## 47. Technical Risks

### AI variability

Mitigation:

- structured contracts;
- evaluation;
- approvals;
- retries.

### Tool misuse

Mitigation:

- capability permissions;
- policy evaluation;
- scoped credentials.

### Provider dependency

Mitigation:

- provider adapters;
- model gateway.

### Context leakage

Mitigation:

- permission-aware retrieval;
- explicit context assembly.

### Workflow complexity

Mitigation:

- versioned declarative workflows;
- controlled runtime.

### Long-running tasks

Mitigation:

- durable asynchronous state.

### Premature microservices

Mitigation:

- modular monolith first.

---

## 48. Service Extraction Criteria

Services should only be extracted when measurable need exists.

Possible triggers include:

- independent agent scaling;
- workflow reliability isolation;
- heavy knowledge indexing;
- integration isolation;
- material event volume;
- separate domain ownership.

The initial POC should not extract services merely for theoretical scalability.

---

## 49. Technical Decisions Deferred

The following remain open until justified:

- durable workflow framework versus custom state machine;
- cloud/container platform;
- queue/event technology;
- model provider and data residency;
- retrieval/embedding strategy;
- agent sandboxing;
- source-code access model;
- final API contract style beyond the POC baseline;
- multi-tenant production isolation;
- production SLOs and capacity targets.

These decisions must be resolved in the relevant detailed specifications before they become implementation requirements.

---

## 50. Definition of Done — Technical Foundation

The technical foundation is complete when:

- clean checkout builds;
- local environment is documented;
- applications start;
- database migrations work;
- API contracts are validated;
- project isolation works;
- workflow state is durable;
- worker executes tasks;
- artifact is created and retrievable;
- events/audit exist;
- worker restart/recovery is tested;
- CI passes.

---

## 51. Relationship to the Repository Structure

This technical specification must be implemented within:

```text
apps/
packages/
tests/
infrastructure/
```

and must respect the dependency rules established in:

```text
specs/architecture/repository-code-structure.md
```

The repository structure remains the implementation boundary.

---

## 52. Relationship to the Domain Model

The technical implementation must preserve the domain concepts:

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

Infrastructure must implement these concepts rather than redefine them.

---

## 53. Relationship to the Context Model

The technical implementation must support the context principles defined by the DevOS System Context and Engineering Knowledge Model:

- authorised context;
- task-specific context;
- provenance;
- version awareness;
- freshness;
- conflict detection;
- context sufficiency;
- project isolation.

The POC may implement only the context capabilities required by Sprint 1.

---

## 54. Source and Authority

This Git-ready specification represents the technical implementation baseline derived from the authoritative DevOS technical architecture and POC implementation planning material.

The authoritative technical architecture establishes the workflow-first kernel, modular-monolith-first approach, durable workflow state, capability-based integrations, versioned AI behaviour, explicit context assembly, and the phased implementation sequence.

The POC Sprint 1 task specification establishes that Sprint 1 should prove reliable orchestration before introducing real LLM execution and requires restart/recovery, isolation, artifact, event, audit, API, and CI evidence.

Where this implementation baseline is silent, the higher-level DevOS constitution, architecture, domain model, and approved technical specifications take precedence.

---

## 55. Acceptance Criteria for This Specification

- [ ] POC architecture is explicitly defined.
- [ ] Modular monolith approach is defined.
- [ ] Asynchronous worker model is defined.
- [ ] PostgreSQL persistence is defined.
- [ ] Transactional outbox approach is defined.
- [ ] API, worker, web, domain, application and infrastructure boundaries are defined.
- [ ] Workflow runtime responsibilities are defined.
- [ ] Durable workflow/task state is defined.
- [ ] Queue reliability and restart behaviour are addressed.
- [ ] Artifact storage boundary is defined.
- [ ] Shared contract approach is defined.
- [ ] Security and project isolation are defined.
- [ ] Agent runtime boundary is defined without prematurely introducing real LLM execution.
- [ ] Context boundary is defined.
- [ ] Tool gateway boundary is defined.
- [ ] Sprint 1 scope and exclusions are defined.
- [ ] Sprint 2 direction is identified.
- [ ] Implementation sequence is defined.
- [ ] Quality gates are defined.
- [ ] Technical risks are identified.
- [ ] Deferred technical decisions are explicitly identified.

---

## 56. Result

The DevOS POC technical implementation baseline establishes a deliberately small but durable architecture:

**A modular monolith provides the initial platform boundary.**

**PostgreSQL is the durable system of record.**

**The workflow runtime owns orchestration.**

**Workers provide asynchronous execution.**

**The transactional outbox preserves event reliability.**

**Artifacts preserve durable engineering evidence.**

**The API, application, domain, integration, and infrastructure boundaries remain explicit.**

**Security and project isolation are enforced server-side.**

**Sprint 1 proves orchestration using a deterministic task implementation.**

**Sprint 2 introduces real agent execution and planning intelligence.**

This allows DevOS to prove its core orchestration architecture before adding the complexity and variability of autonomous AI execution.
