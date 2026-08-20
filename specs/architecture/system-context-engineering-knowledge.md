# DevOS System Context and Engineering Knowledge Model

**Document:** System Context and Engineering Knowledge Specification  
**Product:** DevOS  
**Step:** 3.3.4  
**Status:** Draft for confirmation  
**Repository:** `C:\Development\devos`

---

## 1. Purpose

This document defines the conceptual model for how DevOS understands and manages the engineering context required to perform software development work.

DevOS is an agentic software development platform. Its agents cannot reliably perform engineering work from a work item alone. They require relevant information about the product, project, architecture, repository, standards, constraints, previous decisions, and the current change.

This specification defines:

- what constitutes DevOS project context;
- the major categories of engineering knowledge;
- how context relates to projects, work items, workflows, tasks, agents, and artifacts;
- the distinction between authoritative and generated information;
- context precedence;
- context assembly principles;
- freshness and versioning requirements;
- traceability requirements;
- boundaries for what an agent should receive.

This is a conceptual specification. It does not define the final database schema, retrieval implementation, vector database, indexing technology, or model-specific context mechanism.

---

## 2. Why Context Is a First-Class DevOS Capability

Traditional software development relies heavily on human developers carrying project knowledge in their heads and accessing information through repositories, documents, issue trackers, and conversations.

An agentic development platform cannot rely on this implicit knowledge.

An agent must be deliberately supplied with the information required to make a sound decision.

The conceptual model is:

```text
Work Item
    +
Project Context
    +
Engineering Knowledge
    +
Repository Context
    +
Relevant Artifacts
    +
Applicable Policies
    +
Task Instructions
    |
    v
Execution Context
    |
    v
Agent
    |
    v
Output
```

Context therefore becomes a core platform capability rather than an incidental implementation detail.

---

## 3. Relationship to Previous Specifications

The previous specifications establish:

- the DevOS product purpose;
- the conceptual architecture;
- the DevOS domain model.

This document extends those models by defining the information domain used by workflows and agents.

The conceptual progression is:

```text
Product Overview
       |
       v
Conceptual Architecture
       |
       v
Domain Model
       |
       v
System Context & Engineering Knowledge
       |
       v
Technical Architecture
```

---

## 4. Context Domains

DevOS should conceptually recognise the following categories of context.

| Context Domain       | Purpose                                                  |
| -------------------- | -------------------------------------------------------- |
| Organisation Context | Organisation-wide rules and reusable knowledge           |
| Project Context      | Stable information about the software project            |
| Product Context      | Information about the product and its purpose            |
| Architecture Context | System architecture and design information               |
| Engineering Context  | Engineering standards, conventions and practices         |
| Repository Context   | Source-code and repository structure                     |
| Work Context         | Information specific to the requested change             |
| Workflow Context     | Current workflow and previous workflow outputs           |
| Task Context         | Information required for the current task                |
| Artifact Context     | Relevant specifications, designs, plans and decisions    |
| Integration Context  | Information retrieved from connected engineering systems |
| Policy Context       | Rules governing what the agent may and may not do        |

These domains may overlap.

The purpose of the classification is to make the source and authority of information explicit.

---

# 5. Organisation Context

Organisation Context represents information that applies across multiple projects.

Examples include:

- engineering principles;
- organisation-wide security requirements;
- development standards;
- approved technology policies;
- AI usage policies;
- compliance requirements;
- reusable engineering guidance.

Organisation Context should not automatically override project-specific requirements.

A precedence model must determine which source has authority when information conflicts.

---

# 6. Project Context

Project Context represents stable information about a particular software project.

Examples include:

- project purpose;
- technology stack;
- repository locations;
- development environments;
- architecture documentation;
- engineering conventions;
- deployment environments;
- project-specific constraints;
- project terminology;
- project-specific policies.

Project Context forms the baseline knowledge for agents operating on that project.

---

# 7. Product Context

Product Context describes what the software is intended to achieve.

Examples include:

- product vision;
- target users;
- business goals;
- product capabilities;
- product constraints;
- domain terminology;
- business rules;
- supported use cases;
- product roadmap context where relevant.

Product Context should help agents understand **why** a change is being made.

It should not be confused with implementation details.

---

# 8. Architecture Context

Architecture Context describes how the system is structured.

Examples include:

- conceptual architecture;
- system architecture;
- component responsibilities;
- service boundaries;
- data flows;
- integration boundaries;
- architectural decisions;
- architecture constraints;
- security boundaries.

Architecture Context helps an agent understand **where and how** a change belongs in the system.

---

# 9. Engineering Context

Engineering Context describes how the team develops software.

Examples include:

- coding standards;
- testing standards;
- branching conventions;
- pull request requirements;
- Definition of Done;
- review standards;
- quality requirements;
- documentation standards;
- security practices;
- CI/CD conventions.

The DevOS Engineering Constitution is an important source of engineering context for DevOS itself.

---

# 10. Repository Context

Repository Context describes the actual software implementation environment.

Examples include:

- repository structure;
- source directories;
- configuration files;
- package definitions;
- dependency information;
- build configuration;
- test configuration;
- relevant source files;
- generated code rules;
- repository-specific instructions.

Repository Context is dynamic.

It must therefore be treated differently from stable architectural documentation.

An agent working on implementation should generally receive relevant repository information rather than an unbounded copy of the entire repository.

---

# 11. Work Context

Work Context represents information specific to the requested change.

Examples include:

- work item description;
- acceptance criteria;
- business justification;
- known constraints;
- affected functionality;
- user impact;
- linked defects;
- related changes;
- explicit decisions already made.

Work Context is generally the most important source of immediate intent for an execution.

---

# 12. Workflow Context

Workflow Context represents information created or accumulated during the current workflow run.

Examples include:

- workflow state;
- completed tasks;
- previous agent outputs;
- validation results;
- approval decisions;
- unresolved questions;
- execution failures;
- decisions made during the workflow.

Workflow Context allows later tasks to build on earlier work without relying on conversational memory.

---

# 13. Task Context

Task Context is the subset of available information required for the current task.

A task should not automatically receive all project information.

For example:

```text
Architecture Task
    |
    +-- Product Context
    +-- Work Context
    +-- Existing Architecture
    +-- Relevant Constraints
    +-- Relevant Requirements
```

Whereas:

```text
Implementation Task
    |
    +-- Approved Specification
    +-- Approved Technical Design
    +-- Implementation Plan
    +-- Relevant Repository Context
    +-- Engineering Standards
    +-- Tests / Validation Requirements
```

Task Context is assembled specifically for the task.

---

# 14. Artifact Context

Artifacts are an important source of engineering knowledge.

Relevant artifacts may include:

- requirements;
- specifications;
- architecture documents;
- technical designs;
- implementation plans;
- test plans;
- review reports;
- decision records;
- validation reports.

Artifacts should be selected based on relevance and authority.

The latest artifact is not automatically the authoritative artifact.

For example, an approved specification may have greater authority than a newer draft.

---

# 15. Integration Context

DevOS may obtain context from external engineering systems.

Examples include:

- issue trackers;
- source control systems;
- CI/CD platforms;
- testing systems;
- documentation systems.

Integration Context should preserve the source of the information.

For example:

```text
Source:
    Issue Tracker

Object:
    DEVOS-123

Information:
    Acceptance criteria

Retrieved:
    2026-08-18

Version / Revision:
    <source-specific revision>
```

This enables traceability and helps determine whether the information has changed.

---

# 16. Policy Context

Policy Context defines constraints that apply to an execution.

Examples include:

- permitted AI providers;
- data handling restrictions;
- permitted tools;
- required approvals;
- autonomy limits;
- production access restrictions;
- security requirements.

Policy Context is not optional instruction.

It forms part of the execution constraints.

---

# 17. Authoritative Sources

Not all context sources have equal authority.

DevOS should conceptually classify sources.

Possible authority levels include:

```text
1. Platform / Organisation Policy
2. Project Constitution / Standards
3. Approved Product / Requirements Documents
4. Approved Architecture / Technical Design
5. Approved Decisions
6. Current Work Item
7. Repository State
8. Generated / Proposed Information
9. Transient Agent Reasoning
```

The exact precedence rules may vary by context type.

The important principle is:

> Agents must not resolve conflicting authoritative information by guessing.

When authoritative information conflicts and the conflict cannot be resolved by defined precedence rules, the workflow should surface the conflict for resolution.

---

# 18. Context Precedence

A conceptual precedence model is:

```text
Higher Authority
       |
       v
Mandatory Policies
       |
       v
Project Constraints
       |
       v
Approved Requirements
       |
       v
Approved Architecture / Design
       |
       v
Approved Decisions
       |
       v
Current Work Item
       |
       v
Current Repository State
       |
       v
Generated Proposals
       |
       v
Transient Agent Reasoning
       |
       v
Lower Authority
```

This is a conceptual model rather than a universal ordering.

A later technical specification should define precedence for individual context types.

---

# 19. Context Freshness

Context has different freshness characteristics.

### Stable Context

Examples:

- organisation policies;
- engineering constitution;
- architecture principles.

Stable context changes infrequently.

### Moderately Dynamic Context

Examples:

- product documentation;
- technical designs;
- project standards.

These may change as the product evolves.

### Highly Dynamic Context

Examples:

- repository state;
- issue status;
- CI results;
- test results;
- branch state.

These should generally be retrieved close to execution time.

The context system should therefore consider freshness when assembling execution context.

---

# 20. Context Versioning

Where the source supports versioning, DevOS should retain the relevant version or revision.

Examples:

- Git commit;
- artifact version;
- workflow version;
- agent version;
- issue revision;
- document version.

The goal is reproducibility.

A historical execution should be able to identify the information that materially influenced the execution.

---

# 21. Context Provenance

Every material context item should have provenance.

Conceptually:

```text
Context Item
    |
    +-- Source Type
    +-- Source Identifier
    +-- Source Version
    +-- Retrieved At
    +-- Authority
    +-- Project
    +-- Applicable Scope
```

Provenance allows users and the platform to answer:

- Where did this information come from?
- Was it authoritative?
- What version was used?
- When was it retrieved?
- Which task used it?

---

# 22. Context Assembly

Context assembly is the process of constructing the execution context for a task.

Conceptually:

```text
1. Identify Task
       |
       v
2. Identify Required Context
       |
       v
3. Identify Applicable Policies
       |
       v
4. Retrieve Authoritative Sources
       |
       v
5. Retrieve Relevant Project Context
       |
       v
6. Retrieve Relevant Artifacts
       |
       v
7. Retrieve Relevant Repository / Integration Data
       |
       v
8. Apply Precedence Rules
       |
       v
9. Detect Conflicts
       |
       v
10. Validate Context Sufficiency
       |
       v
11. Assemble Execution Context
       |
       v
12. Execute Agent
```

The context assembler should be a deterministic platform capability wherever practical.

The AI agent should not be solely responsible for discovering its own context.

---

# 23. Context Sufficiency

Before an agent begins a task, DevOS should determine whether the available information is sufficient for the task.

The platform should distinguish between:

### Sufficient Context

The agent has the required information and can proceed.

### Incomplete Context

Required information is missing.

### Conflicting Context

Authoritative sources disagree.

### Stale Context

The information may no longer represent the current system state.

### Untrusted Context

The information cannot be established as authoritative.

When information is insufficient to determine the correct result, DevOS should not instruct the agent to invent a conclusion.

The required response in such a situation is:

> I do not have enough information to determine this.

The workflow should then determine whether to:

- request additional information;
- ask for human clarification;
- retrieve additional context;
- return to an earlier task.

---

# 24. Context Budgeting

AI model context is finite.

DevOS should therefore optimise for:

- relevance;
- authority;
- recency;
- completeness;
- minimal unnecessary information.

The objective is not to supply the maximum amount of context.

The objective is to supply the **minimum sufficient context**.

Conceptually:

```text
Available Project Knowledge
          |
          v
Relevance Filtering
          |
          v
Authority Filtering
          |
          v
Freshness Filtering
          |
          v
Task Requirements
          |
          v
Context Budget
          |
          v
Agent Execution Context
```

---

# 25. Context Reuse

Context should be reusable where appropriate.

Examples:

- the same project architecture may be required by several agents;
- the same engineering constitution may apply to many tasks;
- the same approved specification may be used by implementation and test agents.

However, reusable context must still respect:

- permissions;
- freshness;
- version;
- scope;
- task relevance.

---

# 26. Context and Security

Context may contain sensitive information.

Examples include:

- source code;
- credentials references;
- proprietary architecture;
- customer information;
- security configuration;
- internal business rules.

The context system must therefore respect:

- organisation permissions;
- project permissions;
- agent permissions;
- tool permissions;
- model-provider policies.

An agent must not receive information merely because the information exists somewhere in DevOS.

Access to information must be authorised.

---

# 27. Context and AI Model Providers

Information sent to an AI model may cross a trust boundary.

The model gateway must therefore enforce applicable policies before transmitting context.

Conceptually:

```text
Context Assembly
      |
      v
Security / Policy Check
      |
      v
Approved Context
      |
      v
Model Gateway
      |
      v
AI Provider
```

The model provider must not determine what project information it is allowed to receive.

That decision belongs to DevOS policy and governance.

---

# 28. Context and Repository State

Repository information is particularly important for implementation agents.

The repository context should allow an agent to understand:

- where relevant code lives;
- how the application is structured;
- applicable project instructions;
- relevant dependencies;
- existing implementation patterns;
- relevant tests;
- current branch or revision;
- relevant configuration.

Repository context should normally be tied to a specific revision or execution point where reproducibility requires it.

---

# 29. Context and Artifacts

Artifacts should be treated as structured project knowledge.

A later task may consume an earlier artifact:

```text
Requirements
    |
    v
Technical Design
    |
    v
Implementation Plan
    |
    v
Implementation
```

The consuming task should be able to identify:

- which artifact;
- which version;
- whether it was approved;
- who approved it;
- whether it has been superseded.

---

# 30. Context and Agent Roles

Different agents require different context.

For example:

### Product Analyst

Needs:

- product context;
- business goals;
- work item;
- user needs;
- constraints;
- relevant historical decisions.

### Architect

Needs:

- product context;
- requirements;
- current architecture;
- system constraints;
- repository structure where relevant;
- integration context.

### Developer

Needs:

- approved requirements;
- approved technical design;
- implementation plan;
- relevant repository context;
- engineering standards;
- test requirements.

### Test Agent

Needs:

- requirements;
- acceptance criteria;
- technical design;
- implementation changes;
- test standards;
- existing test structure.

### Code Reviewer

Needs:

- requirements;
- approved design;
- implementation changes;
- engineering standards;
- validation results.

The exact agent catalogue is defined separately.

---

# 31. Context and Workflow Stages

Context requirements change as work moves through the workflow.

A conceptual model is:

```text
Analysis
   |
   +-- Product Context
   +-- Work Context
   +-- Business Context

Specification
   |
   +-- Analysis Outputs
   +-- Requirements
   +-- Product Context

Architecture
   |
   +-- Approved Requirements
   +-- Current Architecture
   +-- Repository Context
   +-- Technical Constraints

Planning
   |
   +-- Approved Design
   +-- Repository Context
   +-- Engineering Standards

Implementation
   |
   +-- Approved Specification
   +-- Approved Design
   +-- Implementation Plan
   +-- Repository Context
   +-- Engineering Standards

Validation
   |
   +-- Requirements
   +-- Implementation
   +-- Tests
   +-- Validation Standards
```

This reinforces the principle that context should be task-specific.

---

# 32. Context Change Detection

Where context is material to an execution, DevOS should be able to detect significant changes.

Examples:

- specification changed;
- architecture changed;
- repository revision changed;
- work item changed;
- policy changed;
- integration data changed.

A material context change may require:

- context reassembly;
- task restart;
- workflow revalidation;
- human review.

The exact change-detection mechanism is deferred.

---

# 33. Context Conflicts

Conflicts may occur.

Example:

```text
Architecture Document:
    Service A owns customer validation.

Repository:
    Validation currently occurs in Service B.

Work Item:
    Requests changes to Service B.
```

The agent should not silently choose one source.

DevOS should:

1. identify the conflict;
2. determine whether precedence resolves it;
3. if not, surface the conflict;
4. prevent consequential decisions based on unresolved ambiguity where appropriate.

---

# 34. Knowledge vs Context

DevOS should distinguish between **Knowledge** and **Context**.

### Knowledge

Reusable information that may apply to many tasks.

Examples:

- coding standards;
- design patterns;
- organisation practices.

### Context

Information assembled for a specific execution.

Examples:

- the current work item;
- the approved design for that change;
- the relevant source files;
- the current branch.

Knowledge may become part of context.

Context is the execution-specific result of selecting relevant information.

---

# 35. System of Record

The following should be considered authoritative DevOS records where applicable:

- approved artifacts;
- workflow definitions and versions;
- workflow run state;
- agent versions;
- approval decisions;
- policy configuration;
- execution history;
- audit records.

Agent conversation text alone should not be considered the system of record.

---

# 36. Context Lifecycle

A conceptual context lifecycle is:

```text
Discovered
   |
   v
Classified
   |
   v
Authorised
   |
   v
Retrieved
   |
   v
Validated
   |
   v
Assembled
   |
   v
Consumed
   |
   v
Recorded for Traceability
```

Not every context item requires permanent storage.

However, material context used in consequential decisions should be traceable.

---

# 37. Domain Invariants

The following rules should remain true:

1. Agents must receive authorised context only.
2. Context must be relevant to the task.
3. Context should be traceable to its source.
4. Authoritative information must not be silently overridden by generated information.
5. Conflicting authoritative information must be surfaced when precedence cannot resolve it.
6. Historical executions must retain sufficient context provenance for meaningful reconstruction.
7. Project context must remain isolated between projects.
8. Sensitive information must respect policy and access controls.
9. Repository context should be associated with an appropriate revision when reproducibility requires it.
10. Approved artifacts must be distinguishable from drafts.
11. The platform, not the AI model, owns context assembly policy.
12. Missing information must not be replaced with fabricated assumptions.
13. Context selection must be task-specific.
14. Context may be reused only when scope, authority, freshness, and permissions remain valid.

---

# 38. Implications for the DevOS Architecture

The conceptual architecture must therefore support:

- a project context store;
- artifact retrieval;
- knowledge retrieval;
- repository inspection;
- integration context retrieval;
- context classification;
- context authorisation;
- context assembly;
- provenance;
- version awareness;
- freshness checks;
- conflict detection;
- context sufficiency checks;
- model-provider policy enforcement.

These capabilities may initially be implemented inside a modular application.

The domain model should not be weakened simply because the first implementation is small.

---

# 39. Deferred Technical Decisions

This document does not decide:

- vector databases;
- embeddings;
- semantic search;
- full-text search;
- repository indexing technology;
- file chunking strategy;
- retrieval algorithms;
- model context-window strategy;
- caching technology;
- object storage;
- database schema;
- event infrastructure;
- exact security implementation.

Those decisions belong to the technical architecture and later implementation specifications.

---

# 40. Acceptance Criteria for Step 3.3.4

Step 3.3.4 is complete when:

- [ ] DevOS context domains are defined.
- [ ] Organisation context is defined.
- [ ] Project and product context are defined.
- [ ] Architecture and engineering context are defined.
- [ ] Repository context is defined.
- [ ] Work, workflow, task, artifact, and integration context are defined.
- [ ] Policy context is defined.
- [ ] Context authority is defined conceptually.
- [ ] Context precedence is defined conceptually.
- [ ] Context freshness is addressed.
- [ ] Context versioning is addressed.
- [ ] Context provenance is addressed.
- [ ] Context assembly is defined.
- [ ] Context sufficiency and conflict handling are defined.
- [ ] Context budgeting is addressed.
- [ ] Security implications are addressed.
- [ ] Model-provider boundaries are addressed.
- [ ] Context requirements by workflow stage are addressed.
- [ ] Context lifecycle is defined.
- [ ] Domain invariants are defined.
- [ ] Technical implementation decisions are explicitly deferred.

---

# 41. Result

The DevOS System Context and Engineering Knowledge Model establishes that:

**DevOS must deliberately assemble the information required by each agent.**

**Context is task-specific rather than a complete dump of project information.**

**Authoritative information must be distinguishable from generated proposals.**

**Context must be traceable to its source and, where necessary, its version.**

**Policies and permissions constrain what information an agent may receive.**

**Repository state must be treated as dynamic engineering context.**

**Artifacts form an important part of the durable engineering knowledge base.**

**Conflicts and missing information must be surfaced rather than guessed.**

**The platform owns context assembly; the AI model consumes the resulting execution context.**

This establishes the conceptual foundation for the technical design of DevOS context, knowledge, retrieval, and agent execution.
