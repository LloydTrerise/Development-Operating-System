# DevOS Domain Model

**Document:** Domain Model Specification  
**Product:** DevOS  
**Step:** 3.3.3  
**Status:** Draft for confirmation  
**Repository:** `C:\Development\devos`

---

## 1. Purpose

This document defines the conceptual domain model for DevOS.

It establishes the principal business and engineering concepts that exist within the DevOS platform, the responsibilities of those concepts, their relationships, lifecycle principles, ownership boundaries, and the rules that must remain stable as the implementation evolves.

This specification sits between the DevOS Product Overview and the later technical architecture.

It does not define database tables, API contracts, TypeScript classes, or deployment architecture.

The purpose is to ensure that later implementation decisions are derived from a stable domain model rather than allowing infrastructure or framework choices to define the product model.

---

## 2. Relationship to Previous Specifications

### 2.1 Product Overview

The Product Overview defines what DevOS is intended to achieve.

### 2.2 Conceptual Architecture

The Conceptual Architecture defines the major logical areas of the platform and how they cooperate.

### 2.3 Domain Model

This document defines the important things that exist inside those areas and the relationships between them.

The progression is therefore:

```text
Product Intent
      |
      v
Conceptual Architecture
      |
      v
Domain Model
      |
      v
Technical Architecture
      |
      v
Implementation
```

---

## 3. Core Domain Principle

DevOS is fundamentally a **workflow-oriented software development platform**.

The central domain concept is therefore the **Workflow**.

A workflow expresses engineering intent and sequencing.

A workflow is executed as a **Workflow Run**.

A workflow run is composed of **Tasks**.

Tasks may be performed by **Agent Executions**.

Agents require **Context and Knowledge**.

Tasks produce or consume **Artifacts**.

Some workflow transitions require **Approvals**.

Agents and workflows may interact with external systems through **Integrations and Tool Capabilities**.

Execution produces **Events and Audit Records**.

The core model is:

```text
Work Item
    |
    v
Workflow Version
    |
    v
Workflow Run
    |
    v
Tasks
    |
    v
Agent Executions
    |
    +---- Context / Knowledge
    |
    +---- Tool Capabilities
    |
    +---- Artifacts
    |
    +---- Approvals
    |
    v
Execution Events / Audit
```

This relationship is the foundation of DevOS.

---

## 4. Domain Boundaries

DevOS is divided conceptually into the following domains.

| Domain                  | Primary Concepts                                        | Responsibility                                 |
| ----------------------- | ------------------------------------------------------- | ---------------------------------------------- |
| Identity & Organisation | Organisation, User, Role, Permission                    | Determines who can access what                 |
| Project                 | Project, Project Context, Standards, Constraints        | Defines the engineering environment            |
| Work Management         | Work Item                                               | Defines the engineering work requested         |
| Workflow                | Workflow Template, Workflow Version, Workflow Run, Task | Defines what happens and in what order         |
| Agent                   | Agent, Agent Version, Capability, Agent Execution       | Defines how AI performs work                   |
| Knowledge               | Knowledge Item, Collection, Reference                   | Provides reusable information                  |
| Artifact                | Artifact, Artifact Version, Artifact Link               | Preserves durable engineering outputs          |
| Approval                | Approval Gate, Approval Request, Decision               | Provides human control                         |
| Integration             | Integration, Connection, Tool Capability                | Provides controlled external capabilities      |
| Observability           | Execution Event, Audit Event, Metric                    | Provides operational and traceability evidence |
| Governance              | Policy, Configuration                                   | Controls platform behaviour                    |

These are logical domains.

They do not necessarily require separate services or databases.

---

## 5. Core Entities

## 5.1 Organisation

An Organisation is the top-level tenancy and security boundary.

Responsibilities include:

- owning users and memberships;
- owning projects;
- owning organisation-level workflows;
- owning reusable agents;
- owning knowledge;
- owning policies;
- defining organisation-level configuration.

An organisation may contain multiple projects.

---

## 5.2 User

A User represents a human identity interacting with DevOS.

A user may:

- belong to one or more organisations;
- participate in projects;
- initiate work;
- review artefacts;
- approve workflow transitions;
- administer configuration according to permissions.

A user is distinct from an AI agent.

---

## 5.3 Role

A Role represents a named set of permissions.

Examples include:

- Organisation Administrator;
- Project Administrator;
- Product Owner;
- Engineering Manager;
- Developer;
- Reviewer.

The exact role catalogue is not defined by this document.

Roles control access to capabilities; they do not define workflow behaviour.

---

## 5.4 Permission

A Permission represents an allowed capability within DevOS.

Permissions may control access to:

- projects;
- workflows;
- agents;
- artefacts;
- tools;
- approvals;
- configuration;
- administrative functions.

The permission model should support least privilege.

---

## 5.5 Project

A Project represents a bounded software product, application, repository, or engineering initiative managed by DevOS.

A project provides the primary context boundary for engineering work.

A project may contain:

- work items;
- repositories;
- project context;
- standards;
- constraints;
- workflow runs;
- integrations;
- artefacts;
- project-specific policies.

---

## 5.6 Project Context

Project Context represents structured information that applies to a project.

Examples include:

- product information;
- architecture information;
- engineering standards;
- coding conventions;
- repository conventions;
- business rules;
- environmental constraints;
- project instructions.

Project Context provides stable information to workflows and agents.

It should be distinguishable from transient task-specific context.

---

## 5.7 Work Item

A Work Item represents a unit of engineering work.

Examples include:

- feature;
- enhancement;
- defect;
- technical change;
- refactoring task;
- security remediation.

A work item may originate:

- directly within DevOS;
- from an issue tracker;
- through an API;
- through another supported entry point.

The Work Item is the business-level request.

It is not itself the workflow execution.

---

# 6. Workflow Domain

## 6.1 Workflow Template

A Workflow Template is a reusable definition of an engineering process.

It defines:

- workflow purpose;
- required inputs;
- workflow steps;
- dependencies;
- conditions;
- approvals;
- expected outputs;
- completion criteria;
- failure/recovery behaviour.

A workflow template is reusable.

It does not represent one specific execution.

---

## 6.2 Workflow Version

A Workflow Version is an immutable published version of a workflow template.

Versioning is required because historical workflow runs must remain interpretable.

A workflow run must identify the exact workflow version that was executed.

A published workflow version must not be silently modified after execution has begun.

---

## 6.3 Workflow Run

A Workflow Run represents one concrete execution of a workflow version.

It maintains:

- the originating work item;
- the workflow version;
- current state;
- execution history;
- task state;
- approvals;
- artefact relationships;
- execution events;
- completion or failure information.

A work item may have multiple workflow runs.

This allows:

- retries;
- revised executions;
- different workflow versions;
- rework;
- recovery after failure.

---

## 6.4 Task

A Task is a discrete activity within a workflow run.

A task:

- has a defined purpose;
- receives inputs;
- performs an activity;
- produces outputs;
- has a lifecycle state;
- may require an agent;
- may require tools;
- may require validation;
- may require approval.

A task is the primary executable unit within a workflow.

A task is not necessarily synonymous with a Jira issue or external work item.

---

# 7. Agent Domain

## 7.1 Agent

An Agent represents a reusable AI capability.

An agent defines:

- purpose;
- role;
- operating instructions;
- capabilities;
- constraints;
- required context;
- permitted tools;
- expected outputs;
- validation expectations.

An agent is reusable across workflows.

The agent does not own workflow sequencing.

---

## 7.2 Agent Version

An Agent Version is an immutable version of an agent configuration.

Versioned agent information may include:

- instructions;
- model policy;
- capabilities;
- tool permissions;
- context requirements;
- output contract;
- validation rules.

Versioning allows historical executions to identify exactly which agent configuration was used.

---

## 7.3 Capability

A Capability represents something an agent is authorised and able to perform.

Capabilities should be expressed at a level that allows workflow definitions to depend on capabilities rather than specific vendors or implementations.

Examples include:

- analyse requirements;
- inspect repository;
- create specification;
- modify source code;
- run tests;
- review code;
- create an artefact.

---

## 7.4 Agent Execution

An Agent Execution represents one concrete invocation of an agent against a task.

It records conceptual information such as:

- task;
- agent version;
- execution state;
- input context;
- model information;
- outputs;
- tool calls;
- validation results;
- timing;
- errors.

A task may have multiple agent executions when retries or alternative executions are required.

---

# 8. Knowledge Domain

## 8.1 Knowledge Item

A Knowledge Item represents reusable information available to authorised DevOS workflows.

Examples include:

- engineering standards;
- architecture guidance;
- organisational policies;
- design patterns;
- domain knowledge;
- lessons learned;
- reusable procedures.

Knowledge is distinct from project-specific context, although project workflows may reference organisation-level knowledge.

---

## 8.2 Knowledge Collection

A Knowledge Collection groups related knowledge items.

Collections may represent:

- an organisation knowledge base;
- a technical domain;
- an engineering discipline;
- a product area;
- a standards library.

The exact storage and retrieval mechanism is deferred to technical architecture.

---

## 8.3 Knowledge Reference

A Knowledge Reference represents the relationship between a workflow, project, task, or agent and a knowledge item.

References allow DevOS to identify which knowledge was intentionally supplied to an execution.

This supports:

- traceability;
- reproducibility;
- context inspection;
- access control.

---

# 9. Artifact Domain

## 9.1 Artifact

An Artifact represents a durable engineering output.

Examples include:

- product requirements;
- specifications;
- architecture documents;
- technical designs;
- implementation plans;
- task specifications;
- test plans;
- review reports;
- decision records;
- validation reports.

Artifacts form part of the system of record for engineering work.

---

## 9.2 Artifact Version

An Artifact Version represents a specific immutable version of an artifact.

Versioning allows DevOS to preserve:

- previous decisions;
- previous generated outputs;
- approved versions;
- superseded versions;
- historical workflow outputs.

An artifact may have many versions.

---

## 9.3 Artifact Link

An Artifact Link represents a relationship between artifacts or between an artifact and another domain object.

Examples include:

- specification derived from requirements;
- technical design derived from specification;
- implementation plan based on technical design;
- test plan validating implementation;
- review report evaluating implementation.

Artifact links provide explicit traceability.

---

# 10. Approval Domain

## 10.1 Approval Gate

An Approval Gate represents a workflow point where human judgement is required before execution may continue.

Approval gates are defined by workflow configuration.

Examples include:

- specification approval;
- architecture approval;
- implementation approval;
- production deployment approval.

---

## 10.2 Approval Request

An Approval Request represents a concrete request for a human decision.

It is associated with a workflow run and an approval gate.

A workflow may be paused while an approval request is pending.

---

## 10.3 Decision

A Decision represents the outcome of an approval request.

Conceptual outcomes include:

- approved;
- rejected;
- changes requested.

A decision should identify the responsible user and remain part of the execution history.

---

# 11. Integration Domain

## 11.1 Integration

An Integration represents a configured connection between DevOS and an external engineering system.

Examples include:

- source control;
- issue tracking;
- CI/CD;
- test systems;
- security systems;
- collaboration platforms.

An integration represents the connection and configuration boundary.

---

## 11.2 Tool Capability

A Tool Capability represents a discrete action that an integration or internal service exposes to DevOS.

Examples include:

- read repository;
- create branch;
- create pull request;
- read issue;
- update issue;
- run pipeline;
- retrieve test results.

Agents should be granted capabilities explicitly.

Workflows should depend on capabilities rather than directly depending on vendor-specific APIs.

---

## 11.3 Tool Permission

A Tool Permission defines which agent versions, workflows, tasks, or users may invoke a capability.

This supports least privilege and governance.

---

# 12. Governance Domain

## 12.1 Policy

A Policy represents a configurable rule governing platform behaviour.

Policies may apply at:

- organisation level;
- project level;
- workflow level;
- agent level;
- tool level;
- environment level.

Examples include:

- model/provider restrictions;
- tool restrictions;
- approval requirements;
- data handling rules;
- autonomy limits.

---

# 13. Observability Domain

## 13.1 Execution Event

An Execution Event represents a significant state or activity transition.

Examples include:

### Workflow events

- started;
- paused;
- resumed;
- completed;
- failed;
- cancelled.

### Task events

- queued;
- started;
- completed;
- failed;
- retried.

### Agent events

- invoked;
- tool called;
- output produced;
- failed.

### Approval events

- requested;
- approved;
- rejected;
- changes requested.

### Artifact events

- created;
- versioned;
- approved;
- superseded.

### Integration events

- connected;
- invoked;
- succeeded;
- failed.

### Security events

- access granted;
- access denied;
- policy violation.

---

## 13.2 Audit Event

An Audit Event records a material action where historical accountability is required.

Audit records should be sufficiently durable to determine:

- who or what acted;
- what action occurred;
- what object was affected;
- when it occurred;
- what the outcome was.

Audit records should be treated as append-oriented history.

---

# 14. Core Entity Relationships

The principal conceptual relationships are:

| Relationship                          | Cardinality | Meaning                                               |
| ------------------------------------- | ----------: | ----------------------------------------------------- |
| Organisation -> User                  |    1 : many | An organisation has many members                      |
| Organisation -> Project               |    1 : many | Projects belong to an organisation                    |
| Project -> Work Item                  |    1 : many | A project contains engineering requests               |
| Work Item -> Workflow Run             |    1 : many | A work item may have multiple executions              |
| Workflow Template -> Workflow Version |    1 : many | A workflow evolves through immutable versions         |
| Workflow Version -> Workflow Run      |    1 : many | Runs execute a published workflow version             |
| Workflow Run -> Task                  |    1 : many | A run contains workflow tasks                         |
| Task -> Agent Execution               |    1 : many | A task may have retries or multiple executions        |
| Agent -> Agent Version                |    1 : many | Agents evolve through versions                        |
| Agent Version -> Agent Execution      |    1 : many | Executions identify the exact agent version used      |
| Task -> Artifact                      |    1 : many | Tasks can produce multiple artifacts                  |
| Artifact -> Artifact Version          |    1 : many | Artifacts are versioned                               |
| Workflow Run -> Approval Request      |    1 : many | A run may require multiple human decisions            |
| Project -> Project Context            |    1 : many | A project has multiple context items                  |
| Organisation -> Knowledge Item        |    1 : many | Reusable knowledge may be organisation-scoped         |
| Project -> Integration                |    1 : many | A project may have configured engineering connections |
| Integration -> Tool Capability        |    1 : many | Connections expose discrete capabilities              |
| Agent Version -> Tool Capability      | many : many | Agent versions may be permitted specific tools        |
| Workflow Run -> Execution Event       |    1 : many | Every run produces execution history                  |

---

# 15. Conceptual Relationship Diagram

```text
Organisation
 |
 +-- Users / Roles / Permissions
 |
 +-- Projects
 |    |
 |    +-- Project Context
 |    |
 |    +-- Work Items
 |    |     |
 |    |     +-- Workflow Runs
 |    |           |
 |    |           +-- Tasks
 |    |           |    |
 |    |           |    +-- Agent Executions
 |    |           |    |
 |    |           |    +-- Artifacts
 |    |           |
 |    |           +-- Approval Requests
 |    |           |
 |    |           +-- Execution Events
 |    |
 |    +-- Integrations
 |
 +-- Knowledge
 |
 +-- Agents
 |    |
 |    +-- Agent Versions
 |          |
 |          +-- Agent Executions
 |          |
 |          +-- Tool Permissions
 |
 +-- Workflow Templates
      |
      +-- Workflow Versions
            |
            +-- Workflow Runs
```

This is a conceptual relationship model, not a database schema.

---

# 16. Workflow State Model

Workflow state represents the current truth of execution.

A conceptual lifecycle is:

```text
Created
   |
   v
Queued
   |
   v
Running
   |
   +------> Waiting for Approval
   |
   +------> Waiting for Input
   |
   +------> Failed
   |
   v
Validating
   |
   v
Completed
```

A workflow may also support cancellation.

The exact state machine and legal transitions will be defined in the workflow technical specification.

The important domain rule is that workflow state is explicit and durable.

---

# 17. Task State Model

Tasks are independently observable within a workflow run.

A conceptual lifecycle is:

```text
Pending
   |
   v
Queued
   |
   v
Running
   |
   +------> Blocked
   |
   +------> Failed
   |
   v
Validating
   |
   v
Completed
```

A failed task may be retried according to workflow policy.

Task state must not be inferred solely from agent conversation output.

---

# 18. Agent Execution State Model

A conceptual agent execution lifecycle is:

```text
Created
   |
   v
Started
   |
   +------> Tool Invocation
   |
   +------> Failed
   |
   v
Output Produced
   |
   v
Validated
   |
   v
Completed
```

The final state model belongs in the technical design.

---

# 19. Artifact Lifecycle

A conceptual artifact lifecycle is:

```text
Created
   |
   v
Draft
   |
   v
Reviewed
   |
   v
Approved
   |
   v
Superseded
```

Not every artifact must pass through every state.

Artifact versions should remain immutable after publication or approval where reproducibility requires it.

---

# 20. Approval Lifecycle

A conceptual approval lifecycle is:

```text
Required
   |
   v
Requested
   |
   +------> Rejected
   |
   +------> Changes Requested
   |
   v
Approved
```

An approval decision must be attributable to an authorised human.

A pending approval may pause workflow execution.

---

# 21. Versioning Principles

Versioning is a core domain capability.

The following should be versioned where reproducibility requires it:

- workflow definitions;
- workflow versions;
- agent configurations;
- agent versions;
- instructions/prompts where material;
- artifacts;
- policies where execution depends on historical policy state.

A historical workflow run must be interpretable without relying on the current version of a workflow or agent.

---

# 22. Context Model

Context is explicit rather than implicit.

A task execution may draw context from:

```text
Organisation Rules
       +
Project Context
       +
Knowledge
       +
Work Item
       +
Workflow State
       +
Previous Artifacts
       +
Repository / Integration Information
       +
Agent Instructions
       +
Task Instructions
       |
       v
Execution Context
```

The context supplied to an agent should be:

- authorised;
- relevant;
- traceable;
- sufficient;
- appropriately scoped.

DevOS should not assume that an agent remembers previous workflow executions.

---

# 23. Artifact and Traceability Model

The domain model must support a chain such as:

```text
Business Need
      |
      v
Work Item
      |
      v
Requirements
      |
      v
Specification
      |
      v
Architecture / Design
      |
      v
Implementation Plan
      |
      v
Implementation
      |
      v
Validation
      |
      v
Review
      |
      v
Delivery
```

Each stage should be capable of referencing the artefacts and decisions that informed it.

This supports:

- impact analysis;
- auditability;
- review;
- change management;
- context construction;
- validation;
- reporting.

---

# 24. Event and State Model

DevOS should distinguish between **state** and **events**.

### State

State represents the current truth.

Examples:

- workflow is running;
- task is completed;
- approval is pending;
- artifact is approved.

### Events

Events represent what happened.

Examples:

- workflow started;
- task completed;
- agent invoked;
- approval requested;
- artifact version created.

The distinction is important because state provides efficient current access while events provide historical traceability.

---

# 25. Conceptual Data Ownership

Logical ownership should remain explicit even if multiple domains are initially implemented within one database.

| Data                       | Logical Owner     |
| -------------------------- | ----------------- |
| User and role data         | Identity          |
| Project metadata           | Project           |
| Work items                 | Work Management   |
| Workflow definitions       | Workflow          |
| Workflow execution state   | Workflow          |
| Agent definitions          | Agent             |
| Context                    | Project / Context |
| Knowledge                  | Knowledge         |
| Artifacts                  | Artifact          |
| Integration connections    | Integration       |
| Audit and execution events | Observability     |
| Policies                   | Governance        |

Logical ownership does not prescribe physical storage.

---

# 26. Domain Invariants

The following invariants should remain true:

1. A workflow is independent of a specific agent implementation.
2. A workflow run identifies the exact workflow version executed.
3. An agent execution identifies the exact agent version used.
4. Workflow state is durable.
5. Artifacts are durable.
6. Artifact versions preserve historical outputs.
7. Human approval is represented explicitly where required.
8. External capabilities are accessed through controlled integration boundaries.
9. Tool permissions are explicit.
10. Execution history is traceable.
11. Project-owned information is scoped to the appropriate project and organisation.
12. Agents do not own workflow sequencing.
13. AI models do not become the system of record.
14. Historical executions remain interpretable after definitions evolve.

---

# 27. Key Domain Decisions

## 27.1 Workflow is first-class

The value of DevOS is orchestrated engineering processes, not isolated AI calls.

## 27.2 Agents are reusable

The same specialist capability should be usable across multiple workflows.

## 27.3 Artifacts are durable

Artifacts provide explicit handoffs and traceability between workflow stages.

## 27.4 Approvals are first-class

Human judgement must be represented and auditable.

## 27.5 Integrations expose capabilities

Workflows should depend on capabilities rather than vendor-specific APIs.

## 27.6 Versioning is pervasive

AI behaviour and workflow definitions change, so historical runs must remain interpretable.

## 27.7 Context is explicit

Reliable agent behaviour requires controlled and inspectable context assembly.

## 27.8 Execution is observable

Meaningful execution transitions must be inspectable.

## 27.9 Security follows domain boundaries

Organisation, project, tool, agent, and artifact access must be enforceable.

## 27.10 Autonomy is incremental

DevOS should be able to automate more stages without requiring a fundamentally different domain model.

---

# 28. Implications for Technical Architecture

This domain model implies that the later technical architecture must provide:

1. durable workflow execution state;
2. versioned workflow definitions;
3. versioned agent definitions;
4. isolated agent execution;
5. explicit context assembly;
6. durable artifact versioning;
7. human approval states;
8. controlled tool access;
9. execution event history;
10. auditability;
11. project and organisation isolation;
12. support for asynchronous long-running execution.

The technical architecture must preserve these domain boundaries even if the initial implementation uses a modular monolith.

---

# 29. Deferred Technical Decisions

This domain model intentionally does not decide:

- database tables;
- database technology beyond the already established PostgreSQL development environment;
- API design;
- service boundaries;
- queue/event technology;
- object storage technology;
- vector database;
- retrieval implementation;
- agent framework;
- model providers;
- authentication implementation;
- authorisation implementation;
- deployment topology.

Those decisions belong to subsequent technical specifications.

---

# 30. Initial DevOS Technology Alignment

The domain model is implementation-independent.

The current development environment is:

- Windows;
- repository: `C:\Development\devos`;
- Node.js 22.22.2;
- npm 10.9.7;
- pnpm 11.22.0;
- Git 2.53.0;
- Docker 29.4.1;
- Docker Compose 5.1.3;
- PostgreSQL through Docker.

These constraints inform implementation but do not alter the conceptual domain model.

---

# 31. Acceptance Criteria for Step 3.3.3

Step 3.3.3 is complete when:

- [ ] The principal DevOS domains are identified.
- [ ] The core domain entities are defined.
- [ ] The responsibility of each core entity is defined.
- [ ] Core entity relationships are documented.
- [ ] Workflow, workflow run, and task are clearly distinguished.
- [ ] Agent, agent version, and agent execution are clearly distinguished.
- [ ] Artifact and artifact version are clearly distinguished.
- [ ] Approval concepts are defined.
- [ ] Integration and tool capability concepts are defined.
- [ ] Context and knowledge concepts are defined.
- [ ] Execution events and audit concepts are defined.
- [ ] Domain ownership boundaries are defined.
- [ ] Versioning principles are defined.
- [ ] Workflow and execution lifecycle concepts are defined.
- [ ] Traceability requirements are defined.
- [ ] Domain invariants are defined.
- [ ] Technical implementation decisions are explicitly deferred where appropriate.

---

# 32. Result

The DevOS Domain Model establishes a stable conceptual model in which:

**Organisations own projects and platform configuration.**

**Projects contain engineering context and work.**

**Work Items express engineering intent.**

**Workflows define how engineering work is performed.**

**Workflow Runs represent concrete executions.**

**Tasks are the executable units within runs.**

**Agents provide reusable AI capabilities.**

**Agent Executions record concrete AI work.**

**Context and Knowledge provide authorised information.**

**Artifacts preserve durable engineering outputs.**

**Approvals represent human control.**

**Integrations expose controlled capabilities.**

**Events and Audit Records preserve execution history and accountability.**

This domain model is the conceptual foundation for the detailed technical architecture that follows.
