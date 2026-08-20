# DevOS Software Change Workflow Specification

**Document:** Software Change Workflow Specification  
**Product:** DevOS  
**Version:** 1.0  
**Status:** Reference Workflow  
**Purpose:** Define the first complete DevOS workflow for taking a software change from work item through discovery, requirements, technical design, implementation planning, development, validation, review, release readiness, release and closure.  
**Repository:** `C:\Development\devos`

---

## 1. Purpose

The Software Change Workflow is the first reference workflow for DevOS.

It demonstrates how DevOS coordinates:

- specialised agents;
- human decisions;
- project knowledge and context;
- engineering tools;
- durable artifacts;
- workflow state;
- events and audit;
- security and authority controls.

The workflow is deliberately structured around the engineering lifecycle rather than around individual AI agents.

Agents are replaceable execution capabilities operating within controlled workflow tasks.

The workflow should support assisted execution initially and progressively increasing autonomy as reliability is demonstrated.

Human approval gates are explicit and configurable.

---

## 2. Workflow Objective

The workflow transforms an eligible software change request into a validated, reviewed and releasable software change while producing a complete evidence chain:

```text
Work Item
   |
   v
Requirements
   |
   v
Technical Design
   |
   v
Implementation Plan
   |
   v
Code Change
   |
   v
Test Evidence
   |
   v
Review Evidence
   |
   v
Release Evidence
```

The workflow objectives are to:

- reduce discovery and planning cycle time;
- improve consistency of requirements and technical design;
- provide developers with implementation-ready plans;
- automate repetitive engineering work;
- maintain human control over consequential decisions;
- create traceability from business request to deployed change.

---

## 3. Scope

### 3.1 In Scope

- feature changes;
- bug fixes;
- refactoring changes;
- documentation-linked changes;
- repository-based software projects;
- automated testing and review;
- controlled release activities.

### 3.2 Out of Scope for v1

- major enterprise portfolio planning;
- fully autonomous production deployment by default;
- autonomous security policy changes;
- complex incident response;
- non-software business processes;
- organisation-wide cost optimisation.

---

## 4. Preconditions

Before the workflow starts, the following must exist or be available:

- DevOS organisation;
- DevOS project;
- eligible work item;
- registered repository;
- required knowledge sources;
- required published agents;
- required tools/integrations;
- project policies;
- approval roles;
- target environment policies.

If a required precondition is not satisfied, the workflow must not silently proceed.

---

## 5. Workflow Triggers

The workflow supports the following conceptual triggers:

| Trigger         | Description                                               |
| --------------- | --------------------------------------------------------- |
| Manual          | Authorised user starts workflow for an eligible work item |
| Work item event | Configured issue/task event starts workflow               |
| API             | External system requests execution                        |
| Scheduled       | Optional trigger for eligible recurring change classes    |

The initial POC should prioritise:

1. manual trigger;
2. work-item trigger.

---

## 6. Workflow Stages

| Stage                      | Primary Output                  |
| -------------------------- | ------------------------------- |
| 1. Intake & Triage         | Validated change request        |
| 2. Discovery & Analysis    | Analysis findings               |
| 3. Requirements            | Approved PRD                    |
| 4. Technical Design        | Technical Design                |
| 5. Implementation Planning | Implementation Plan             |
| 6. Human Planning Gate     | Approved implementation package |
| 7. Development             | Code changes / pull request     |
| 8. Automated Validation    | Test evidence                   |
| 9. Engineering Review      | Review evidence                 |
| 10. Release Readiness      | Release evidence                |
| 11. Release                | Deployment/change result        |
| 12. Closure                | Complete traceability           |

---

## 7. High-Level Flow

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
PRD
   |
   v
Technical Design
   |
   v
Implementation Plan
   |
   v
+-----------------------------+
| HUMAN PLANNING APPROVAL     |
+-----------------------------+
   |
   v
Development Agent
   |
   v
Code Change / Pull Request
   |
   v
Automated Tests
   |
   v
Engineering Review
   |
   +---- FAIL ----> Rework ----> Development
   |
   +---- PASS
          |
          v
Release Readiness
   |
   v
+-----------------------------+
| HUMAN RELEASE APPROVAL      |
+-----------------------------+
   |
   v
Release / Deployment
   |
   v
Closure + Evidence
```

---

## 8. Workflow Principles

1. Every meaningful stage produces an explicit artifact or evidence.
2. Every stage has a defined input contract and output contract.
3. Agents never bypass the workflow engine.
4. Agents never receive unrestricted tool authority.
5. Human approval is explicit and bound to the evidence being approved.
6. Failures are visible and recoverable where safe.
7. Rework returns to the smallest appropriate prior stage.
8. Published workflow versions are immutable.
9. Material actions are auditable.
10. Missing information is recorded as uncertainty rather than invented.
11. Workflow execution must survive worker/application restart.
12. Workflow transitions depend on evidence and validation, not agent claims alone.

---

## 9. Workflow-Level State

The workflow supports these conceptual states:

| State               | Meaning                                 |
| ------------------- | --------------------------------------- |
| `PENDING`           | Run created but not started             |
| `RUNNING`           | One or more executable tasks are active |
| `WAITING`           | Waiting for timer, event or dependency  |
| `AWAITING_APPROVAL` | Human decision required                 |
| `PAUSED`            | Explicitly paused                       |
| `FAILED`            | Terminal failure                        |
| `CANCELLED`         | Cancelled                               |
| `COMPLETED`         | Successful terminal state               |

The workflow runtime must enforce legal transitions.

---

## 10. Workflow-Level Data

A workflow run should retain:

| Data              | Required             |
| ----------------- | -------------------- |
| Work item         | Yes                  |
| Project context   | Yes                  |
| Workflow version  | Yes                  |
| Run inputs        | Yes                  |
| Task history      | Yes                  |
| Artifacts         | Where generated      |
| Context manifests | For agent executions |
| Approvals         | Where gates exist    |
| Tool invocations  | For external actions |
| Audit events      | Yes                  |
| Final outcome     | Yes                  |

---

# 11. Stage 1 — Intake & Triage

## Purpose

Determine whether the change is sufficiently defined and eligible for the Software Change Workflow.

## Activities

- validate work item completeness;
- classify the change;
- identify affected systems;
- identify missing information;
- determine workflow eligibility.

## Actors

| Task                            | Actor           |
| ------------------------------- | --------------- |
| Validate work item completeness | Triage Agent    |
| Classify change                 | Triage Agent    |
| Identify affected systems       | Analysis Agent  |
| Identify missing information    | Analysis Agent  |
| Determine workflow eligibility  | Workflow Policy |

## Missing Information

If critical information is missing, the workflow must state:

> I do not have enough information to determine this.

It must identify the missing information rather than invent assumptions.

## Outputs

| Output                  | Description                                 |
| ----------------------- | ------------------------------------------- |
| Change Classification   | Feature, bug, refactor, documentation, etc. |
| Initial Scope           | Affected areas                              |
| Known Constraints       | Business and technical constraints          |
| Unknowns                | Information gaps                            |
| Risk Classification     | Initial R0–R4                               |
| Workflow Recommendation | Proceed or request clarification            |

---

# 12. Stage 2 — Discovery & Analysis

## Purpose

Establish sufficient system and business context before requirements are finalised.

## Inputs

- work item;
- project context;
- repository context;
- architecture context;
- coding standards;
- security policies;
- testing standards;
- relevant knowledge.

## Activities

The discovery process should:

1. identify relevant repository/system context;
2. inspect relevant architecture;
3. identify affected components;
4. identify dependencies;
5. identify constraints;
6. identify existing patterns;
7. identify relevant tests;
8. identify risks;
9. identify uncertainties.

## Outputs

A Discovery/Analysis artifact should capture:

- relevant context;
- affected areas;
- dependencies;
- constraints;
- risks;
- unknowns;
- assumptions that are explicitly supported;
- information that remains unavailable.

---

# 13. Stage 3 — Requirements

## Purpose

Transform discovery findings and the change request into an implementation-ready product requirements specification.

## Primary Agent

Requirements Agent.

## Inputs

- validated change request;
- discovery findings;
- project context;
- relevant product knowledge;
- applicable standards.

## Output

A versioned PRD.

The PRD must contain sufficient information for technical design.

## Validation

The PRD must be validated before the workflow proceeds.

Validation should check:

- completeness;
- consistency;
- acceptance criteria;
- scope;
- traceability;
- unresolved uncertainty.

---

# 14. Stage 4 — Technical Design

## Purpose

Translate approved requirements into an implementation-oriented technical design.

## Primary Agent

Architect Agent.

## Inputs

- approved PRD;
- discovery findings;
- current architecture;
- repository context;
- engineering standards;
- security constraints.

## Output

A versioned Technical Design artifact.

The design should address:

- affected components;
- architectural changes;
- data changes;
- API changes;
- integration changes;
- security implications;
- testing implications;
- operational implications;
- migration considerations;
- design decisions and trade-offs.

## Validation

Technical design must be validated against:

- approved requirements;
- current architecture;
- project constraints;
- security requirements.

---

# 15. Stage 5 — Implementation Planning

## Purpose

Convert the technical design into an implementation-ready plan.

## Primary Agent

Planning Agent.

## Inputs

- approved PRD;
- approved Technical Design;
- repository context;
- engineering standards;
- test requirements.

## Output

A versioned Implementation Plan.

The implementation plan should specify:

- implementation tasks;
- task dependencies;
- files/components likely to change;
- contracts;
- database changes;
- API changes;
- tests;
- validation;
- security considerations;
- observability;
- acceptance criteria;
- Definition of Done.

The plan must be sufficiently detailed for the development agent to implement without independently rediscovering the design.

---

# 16. Stage 6 — Human Planning Approval

## Purpose

Prevent consequential development work from starting before the planning package has been reviewed.

The approval package consists of:

- discovery findings;
- PRD;
- technical design;
- implementation plan;
- applicable context/provenance;
- validation evidence.

## Approval Rule

Development must not begin until the configured planning approval is granted.

Approval is:

- explicit;
- attributable;
- auditable;
- associated with the exact evidence/version being approved.

## Rejection

If rejected:

```text
Planning Approval
       |
       v
Changes Requested
       |
       v
Appropriate Planning Stage
       |
       v
New Artifact Version
       |
       v
Re-approval
```

---

# 17. Stage 7 — Development

## Purpose

Implement the approved plan through controlled repository actions.

## Primary Agent

Development Agent.

## Inputs

- approved implementation package;
- repository context;
- development policies;
- tool permissions.

## Expected Activities

The Development Agent may:

- create a feature branch;
- inspect source code;
- modify source code;
- create/update tests;
- run permitted local validation;
- create commits;
- create a pull request where authorised.

## Authority

The agent does not receive unrestricted repository access.

Each external action must pass through the Tool Gateway and applicable policy.

## Output

- code change;
- commit evidence;
- pull request where applicable;
- implementation evidence.

---

# 18. Stage 8 — Automated Validation

## Purpose

Determine whether the implementation satisfies the approved requirements and engineering quality expectations.

Validation may include:

- build;
- type checking;
- lint;
- unit tests;
- integration tests;
- contract tests;
- security checks;
- relevant E2E tests.

## Output

Test/Validation Evidence artifact.

The workflow must record:

- commands executed;
- results;
- failures;
- warnings;
- environment;
- relevant revision;
- timestamp;
- traceability to the implementation.

An agent must not claim validation succeeded unless the relevant checks actually ran and passed.

---

# 19. Stage 9 — Engineering Review

## Purpose

Independently assess the implementation against the approved specification and engineering standards.

## Primary Agent

Code Review Agent.

## Inputs

- approved requirements;
- technical design;
- implementation plan;
- code change;
- validation evidence;
- engineering standards.

## Findings

Findings may be classified as:

- `BLOCKER`;
- `MAJOR`;
- `MINOR`;
- `NOTE`.

## Outcome

```text
Review
  |
  +---- PASS
  |
  +---- CHANGES_REQUIRED
             |
             v
          Rework
             |
             v
        Development
```

---

# 20. Rework

Rework is a first-class workflow path.

When validation or review identifies required changes:

1. evidence is published;
2. the workflow identifies the appropriate return stage;
3. a new task execution is created;
4. the developer/agent receives the relevant findings;
5. changes are made;
6. validation runs again;
7. review runs again.

The workflow must preserve previous outputs and execution history.

Rework must not destroy traceability.

---

# 21. Stage 10 — Release Readiness

## Purpose

Determine whether the change is ready for release.

Checks may include:

- required tests pass;
- review passes;
- acceptance criteria pass;
- security checks pass;
- required approvals exist;
- release evidence is complete;
- no unresolved blockers remain.

## Output

Release Readiness Evidence.

---

# 22. Stage 11 — Release

Release is a controlled external action.

The workflow must verify:

- target environment;
- applicable policy;
- required approval;
- tool capability;
- authorised credentials;
- release evidence.

Production or destructive actions require explicit configured controls.

## Release Result

The workflow records:

- action;
- target;
- revision;
- provider result;
- timing;
- outcome;
- relevant logs/evidence.

---

# 23. Stage 12 — Closure

Closure occurs only when the required workflow success criteria are satisfied.

Closure should publish:

- final outcome;
- final artifacts;
- release evidence;
- review evidence;
- validation evidence;
- approval evidence;
- execution history;
- traceability;
- audit information.

The workflow then reaches `COMPLETED`.

---

# 24. Retry Rules

1. Retry only transient failures automatically.
2. Do not automatically retry permission denials.
3. Bound agent retries.
4. Record every attempt.
5. Preserve previous outputs for diagnosis.
6. Prevent repeated external side effects through idempotency.
7. Escalate after the configured retry threshold.

---

# 25. Human Intervention

The workflow supports explicit human intervention:

| Action  | When                            |
| ------- | ------------------------------- |
| Pause   | User needs investigation        |
| Resume  | Issue resolved                  |
| Retry   | Task failed safely              |
| Rework  | Output requires changes         |
| Skip    | Policy explicitly permits       |
| Cancel  | Change no longer required       |
| Approve | Gate requirements satisfied     |
| Reject  | Gate requirements not satisfied |

---

# 26. Security Model

The workflow must enforce:

- organisation/project scope;
- bounded agent authority;
- independently authorised tool calls;
- brokered secrets;
- configured approval for production actions;
- treatment of retrieved content as untrusted data;
- auditability of material actions.

Secrets must never be exposed directly to model context.

Context does not grant tool authority.

Retrieved instructions cannot override DevOS system policy.

---

# 27. Risk Model

| Risk | Example                            | Default Control                     |
| ---- | ---------------------------------- | ----------------------------------- |
| R0   | Read-only discovery                | Automatic                           |
| R1   | Generate PRD/design                | Automatic with validation           |
| R2   | Create feature branch/commit       | Policy controlled                   |
| R3   | Create/merge PR or external change | Review/approval                     |
| R4   | Production/destructive action      | Explicit approval + strong controls |

Risk classification may be refined as the platform matures.

---

# 28. Knowledge and Context Flow

For each agent execution:

1. identify work item and project;
2. resolve approved knowledge sources;
3. retrieve relevant architecture/code/documentation;
4. apply access controls;
5. create a context manifest;
6. provide context to the agent;
7. record sources used;
8. store provenance with the output.

---

# 29. Context Isolation

The workflow must ensure:

- only authorised project information is retrieved;
- sensitive content is excluded unless explicitly permitted;
- agent context is scoped to task purpose;
- context does not grant tool authority;
- retrieved instructions cannot override system policy;
- context manifests are retained for reproducibility where policy permits.

---

# 30. Event Flow

Important events include:

| Event                     | Typical Consumer         |
| ------------------------- | ------------------------ |
| `WorkflowRunStarted`      | Monitoring/audit         |
| `DiscoveryCompleted`      | Requirements task        |
| `ArtifactPublished`       | Workflow transitions     |
| `ApprovalRequested`       | Approval UI/notification |
| `ApprovalGranted`         | Workflow engine          |
| `AgentExecutionCompleted` | Workflow/artifact        |
| `ToolInvocationCompleted` | Workflow/audit           |
| `ValidationFailed`        | Rework logic             |
| `ReviewApproved`          | Release readiness        |
| `ReleaseCompleted`        | Closure/metrics          |

---

# 31. Observability

The workflow should expose telemetry for:

| Metric             | Purpose                   |
| ------------------ | ------------------------- |
| Workflow duration  | Cycle time                |
| Stage duration     | Bottleneck identification |
| Agent success rate | Agent reliability         |
| Tool failure rate  | Integration health        |
| Rework count       | Quality                   |
| Approval wait time | Human bottleneck          |
| Automation rate    | Workflow maturity         |
| Cost per run       | Future cost management    |
| Failure reason     | Improvement               |

Run history should remain observable.

---

# 32. Workflow Success Criteria

A workflow is successful when:

- change scope is satisfied;
- required artifacts are complete;
- acceptance criteria pass;
- code is reviewed;
- required tests pass;
- security checks pass;
- required approvals are complete;
- release evidence exists;
- material actions are traceable.

---

# 33. Functional Requirements

| ID      | Requirement                                                           |
| ------- | --------------------------------------------------------------------- |
| SCW-001 | Workflow shall accept an eligible software change work item.          |
| SCW-002 | Workflow shall perform intake and discovery.                          |
| SCW-003 | Workflow shall produce a PRD.                                         |
| SCW-004 | Workflow shall produce a technical design.                            |
| SCW-005 | Workflow shall produce an implementation plan.                        |
| SCW-006 | Workflow shall support a human planning approval gate.                |
| SCW-007 | Workflow shall perform controlled development-agent execution.        |
| SCW-008 | Workflow shall run automated validation.                              |
| SCW-009 | Workflow shall support review and rework loops.                       |
| SCW-010 | Workflow shall support release readiness checks.                      |
| SCW-011 | Workflow shall support configurable release approval.                 |
| SCW-012 | Workflow shall publish release/closure evidence.                      |
| SCW-013 | Workflow shall preserve artifact and action traceability.             |
| SCW-014 | Workflow shall enforce security and authority policies.               |
| SCW-015 | Workflow shall expose uncertainty and missing information explicitly. |

---

# 34. Non-Functional Requirements

| ID          | Requirement                                                                    |
| ----------- | ------------------------------------------------------------------------------ |
| SCW-NFR-001 | Workflow executions must be reproducible from versioned definitions/artifacts. |
| SCW-NFR-002 | Long-running stages must execute asynchronously.                               |
| SCW-NFR-003 | Material outputs must have provenance.                                         |
| SCW-NFR-004 | Human approvals must be auditable.                                             |
| SCW-NFR-005 | Failures must be recoverable where safe.                                       |
| SCW-NFR-006 | Agent authority must be bounded.                                               |
| SCW-NFR-007 | Workflow must support progressive automation.                                  |
| SCW-NFR-008 | Workflow must provide operational telemetry.                                   |

---

# 35. MVP Configuration

| Configurable Item   | Initial Default                      |
| ------------------- | ------------------------------------ |
| Planning approval   | Enabled                              |
| Code review         | Enabled                              |
| Production approval | Enabled                              |
| Auto-retry          | Limited                              |
| Rework loop         | Enabled                              |
| Release automation  | Staging first; production controlled |
| Agent selection     | Fixed published agents               |
| Tool selection      | Project allowlist                    |

---

# 36. POC Implementation Sequence

The reference workflow should be implemented progressively:

1. implement workflow definition for this flow;
2. implement trigger and intake;
3. implement artifact creation/binding;
4. implement requirements/design/planning agent tasks;
5. implement planning approval;
6. implement repository/development task;
7. implement test and validation tasks;
8. implement review/rework;
9. implement release readiness;
10. implement controlled release action;
11. implement closure and evidence;
12. run the complete vertical slice.

This sequence is consistent with the POC's vertical-slice delivery strategy.

---

# 37. POC Acceptance Scenario

Given a valid feature work item in a configured DevOS project:

1. DevOS starts the Software Change Workflow.
2. Discovery identifies relevant repository/system context.
3. Requirements Agent creates a PRD.
4. Architect Agent creates a technical design.
5. Planning Agent creates an implementation plan.
6. A human reviewer approves the planning package.
7. Development Agent creates a branch and implements the plan.
8. Automated validation executes.
9. Review identifies either approval or rework.
10. If rework is required, the workflow returns to development with traceability.
11. Once review and tests pass, release readiness is established.
12. Configured release approval is obtained.
13. Release action executes in the permitted environment.
14. DevOS publishes final evidence and closes the workflow.

---

# 38. Definition of Done for the Workflow

The workflow is complete when:

- all required workflow states are implemented;
- all tasks have explicit inputs/outputs;
- agents are versioned;
- tools are authorised;
- artifacts are versioned;
- approvals are enforced server-side;
- failures/retries are defined;
- the rework loop works;
- security controls work;
- traceability is complete;
- run history is observable;
- the end-to-end acceptance scenario passes.

---

# 39. Architectural Decisions

### ADR-SCW-001 — Planning Before Coding

The workflow deliberately separates discovery, requirements, design and implementation planning from development to improve readiness and reduce downstream ambiguity.

### ADR-SCW-002 — Human Planning Gate

The initial workflow requires human approval before consequential development begins.

### ADR-SCW-003 — Evidence-Driven Progression

Workflow transitions depend on explicit artifacts and results rather than agent claims alone.

### ADR-SCW-004 — Rework Is a First-Class Path

Validation and review failures return work to a controlled rework path rather than terminating the workflow.

### ADR-SCW-005 — Agents Are Replaceable

Workflow semantics reference agent roles/versions but do not depend on a particular model provider.

### ADR-SCW-006 — Tool Actions Are Independently Authorised

An agent reaching a workflow step does not automatically grant permission to perform the corresponding external action.

### ADR-SCW-007 — Progressive Autonomy

Human gates can be reduced only through explicit policy/configuration and demonstrated workflow reliability.

---

# 40. Future Evolution

Future workflow capabilities may include:

- automatic requirements clarification loops;
- AI-assisted workflow routing;
- adaptive test selection;
- automated safe rework;
- risk-based human gates;
- autonomous merge for low-risk changes;
- autonomous staging release;
- production autonomy for tightly controlled change classes;
- workflow performance optimisation;
- cost-aware agent/model selection;
- cross-workflow learning and engineering intelligence.

These are future capabilities and are not implied as Sprint 1 requirements.

---

# 41. Relationship to the DevOS Domain Model

The workflow uses the core DevOS domain concepts:

```text
Work Item
    |
    v
Workflow Version
    |
    v
Workflow Run
    |
    +-- Tasks
    |    |
    |    +-- Agent Executions
    |    +-- Tool Invocations
    |
    +-- Artifacts
    |
    +-- Approvals
    |
    +-- Events
    |
    +-- Audit Records
```

The workflow does not redefine those domain concepts.

It defines how they cooperate to perform software change delivery.

---

# 42. Relationship to the DevOS Context Model

Each workflow stage receives task-specific context.

Context may include:

- project context;
- work item;
- approved artifacts;
- architecture;
- repository state;
- engineering standards;
- security policies;
- knowledge sources.

Context is authorised and traceable.

Context does not grant tool authority.

---

# 43. Relationship to the POC Technical Architecture

The workflow runs through the DevOS technical control plane:

```text
User
 |
 v
API
 |
 v
Application Services
 |
 v
Workflow Runtime
 |
 v
Durable Workflow State
 |
 v
Queue
 |
 v
Worker
 |
 +----> Agent Runtime
 |
 +----> Tool Gateway
 |
 +----> Artifact Management
 |
 +----> Validation
 |
 +----> Events / Audit
```

The workflow is therefore the primary vertical slice through the DevOS platform.

---

# 44. POC Boundary

The initial POC should use:

- one primary Software Change Workflow;
- one project type;
- controlled repository provider;
- controlled issue tracker;
- limited agent set;
- staging/non-production release;
- basic approval model;
- basic policy model;
- basic observability.

The POC should not introduce:

- marketplace functionality;
- autonomous production deployment;
- unnecessary workflow complexity.

---

# 45. Reference Workflow Principle

The Software Change Workflow should be the reference implementation against which DevOS is validated.

Every platform capability should justify its existence by enabling this workflow to execute more reliably, securely and traceably.

The workflow should be built as a vertical slice before additional workflows or advanced peripherals are introduced.

The first strategically important proof is the planning path:

```text
Work Item
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
Human Planning Approval
```

This demonstrates DevOS's ability to convert a software request into a structured, evidence-backed implementation package before consequential development begins.

Development, validation, review and release are then added as subsequent vertical slices.

---

# 46. Acceptance Criteria for This Specification

- [ ] Workflow purpose and objective are defined.
- [ ] Scope and exclusions are defined.
- [ ] Preconditions are defined.
- [ ] Trigger mechanisms are defined.
- [ ] All twelve workflow stages are defined.
- [ ] Workflow state is defined.
- [ ] Stage inputs and outputs are defined.
- [ ] Human planning approval is defined.
- [ ] Development authority is defined.
- [ ] Automated validation is defined.
- [ ] Engineering review is defined.
- [ ] Rework is a first-class workflow path.
- [ ] Release readiness and release approval are defined.
- [ ] Closure and evidence are defined.
- [ ] Retry and failure rules are defined.
- [ ] Security and context isolation are defined.
- [ ] Event and observability requirements are defined.
- [ ] Functional requirements are identified.
- [ ] Non-functional requirements are identified.
- [ ] MVP configuration is defined.
- [ ] POC acceptance scenario is defined.
- [ ] Definition of Done is defined.
- [ ] Architectural decisions are recorded.
- [ ] Future evolution is explicitly separated from current requirements.

---

# 47. Source and Authority

This Markdown specification represents the Git-ready form of the authoritative:

**DevOS Software Change Workflow Specification v1.0**

and incorporates the workflow-level execution principles established in the DevOS POC Software Change Workflow Detailed Execution Specification v1.0.

The reference source defines the twelve workflow stages, planning and release approval gates, risk model, context flow, event flow, functional requirements, non-functional requirements, MVP configuration, acceptance scenario and architectural decisions.

The detailed execution specification further establishes executable workflow behaviour, explicit state/data requirements, failure/rework paths, workflow configuration versus runtime code boundaries, and POC boundaries.

Where a lower-level implementation detail is not defined here, the higher-level DevOS constitution, architecture, domain model, technical implementation specification, and detailed execution specification take precedence.

---

## 48. Result

The DevOS Software Change Workflow establishes the reference engineering lifecycle:

**Work begins with an eligible change request.**

**DevOS performs structured intake and discovery.**

**Requirements, technical design and implementation planning are produced as durable, validated artifacts.**

**A human approval gate prevents consequential development from starting prematurely.**

**Development occurs through controlled agent and tool capabilities.**

**Automated validation and independent review provide evidence.**

**Failures return through explicit rework paths.**

**Release is governed by policy and approval.**

**Closure publishes the complete evidence and traceability chain.**

This workflow is the primary end-to-end behaviour that the DevOS POC must progressively prove.
