# DevOS POC Database Schema Specification

**Document:** POC Database Schema Specification  
**Product:** DevOS  
**Version:** 1.0  
**Purpose:** PostgreSQL System-of-Record Baseline for the POC  
**Repository:** `C:\Development\devos`

---

## 1. Purpose

This specification defines the PostgreSQL database baseline for the DevOS POC.

PostgreSQL is the durable system of record for the DevOS control plane.

The database stores the durable metadata and state required to operate the DevOS workflow engine, including:

- organisations;
- projects;
- memberships;
- work items;
- workflow definitions;
- workflow versions;
- workflow runs;
- workflow tasks;
- agent definitions and versions;
- agent executions;
- artifacts and artifact versions;
- approvals;
- policies;
- integrations;
- tool capabilities;
- events;
- audit records.

The database is intentionally designed for the POC and should not introduce unnecessary infrastructure complexity.

---

## 2. Database Principles

The POC database must follow these principles:

1. PostgreSQL is the source of truth for durable control-plane state.
2. Schema changes are migration-driven.
3. Foreign keys enforce important relationships.
4. Uniqueness constraints enforce domain invariants.
5. Organisation/project scope is enforced for project-owned data.
6. Published/versioned records are immutable where required.
7. Transactions protect related state changes.
8. Event/outbox writes occur in the same transaction as material state changes where required.
9. Persistence models do not become the domain model.
10. Secrets are never stored as plaintext application data.
11. Large artifact content is stored outside normal relational rows where appropriate.
12. Indexes support the principal workflow and operational query paths.

---

## 3. Database Technology

The POC uses:

```text
PostgreSQL
```

PostgreSQL runs through Docker for local development.

The database package owns:

- connection management;
- migrations;
- repository implementations;
- persistence mappings;
- transaction boundaries;
- seed data where required.

---

## 4. Schema Organisation

The initial POC may use a single PostgreSQL schema:

```text
public
```

Logical boundaries are maintained through table naming, repository ownership and application/package boundaries.

Separate database schemas are not required for the POC unless implementation evidence demonstrates a need.

---

# 5. Organisation and Project Tables

## 5.1 `organisations`

Stores DevOS organisations.

Conceptual columns:

| Column       | Type        | Notes              |
| ------------ | ----------- | ------------------ |
| `id`         | UUID        | Primary key        |
| `name`       | TEXT        | Required           |
| `slug`       | TEXT        | Unique             |
| `status`     | TEXT        | Organisation state |
| `created_at` | TIMESTAMPTZ | Required           |
| `updated_at` | TIMESTAMPTZ | Required           |

---

## 5.2 `projects`

Stores DevOS projects.

| Column            | Type        | Notes                          |
| ----------------- | ----------- | ------------------------------ |
| `id`              | UUID        | Primary key                    |
| `organisation_id` | UUID        | FK                             |
| `name`            | TEXT        | Required                       |
| `slug`            | TEXT        | Unique within organisation     |
| `description`     | TEXT        | Optional                       |
| `status`          | TEXT        | Project state                  |
| `repository_id`   | UUID        | Optional integration reference |
| `created_at`      | TIMESTAMPTZ | Required                       |
| `updated_at`      | TIMESTAMPTZ | Required                       |

Project ownership is always scoped to an organisation.

Recommended constraint:

```text
UNIQUE (organisation_id, slug)
```

---

## 5.3 `memberships`

Associates users/principals with organisations and projects.

| Column            | Type        | Notes                                      |
| ----------------- | ----------- | ------------------------------------------ |
| `id`              | UUID        | Primary key                                |
| `organisation_id` | UUID        | FK                                         |
| `project_id`      | UUID        | Nullable for organisation-level membership |
| `principal_id`    | TEXT        | External identity identifier               |
| `role`            | TEXT        | Role                                       |
| `status`          | TEXT        | Membership state                           |
| `created_at`      | TIMESTAMPTZ | Required                                   |
| `updated_at`      | TIMESTAMPTZ | Required                                   |

---

# 6. Work Item Tables

## 6.1 `work_items`

Stores software-development change requests.

| Column          | Type        | Notes                      |
| --------------- | ----------- | -------------------------- |
| `id`            | UUID        | Primary key                |
| `project_id`    | UUID        | FK                         |
| `external_key`  | TEXT        | Optional source-system key |
| `title`         | TEXT        | Required                   |
| `description`   | TEXT        | Required                   |
| `type`          | TEXT        | Feature/bug/refactor/etc.  |
| `status`        | TEXT        | Work item state            |
| `priority`      | TEXT        | Priority                   |
| `source_system` | TEXT        | Optional                   |
| `source_url`    | TEXT        | Optional                   |
| `created_by`    | TEXT        | Principal                  |
| `created_at`    | TIMESTAMPTZ | Required                   |
| `updated_at`    | TIMESTAMPTZ | Required                   |

Recommended lookup:

```text
(project_id, external_key)
```

---

# 7. Workflow Definition Tables

## 7.1 `workflow_definitions`

Stores the logical workflow identity.

| Column        | Type        | Notes               |
| ------------- | ----------- | ------------------- |
| `id`          | UUID        | Primary key         |
| `project_id`  | UUID        | FK / scope          |
| `key`         | TEXT        | Stable workflow key |
| `name`        | TEXT        | Display name        |
| `description` | TEXT        | Optional            |
| `created_at`  | TIMESTAMPTZ | Required            |
| `updated_at`  | TIMESTAMPTZ | Required            |

Recommended constraint:

```text
UNIQUE (project_id, key)
```

---

## 7.2 `workflow_versions`

Stores immutable published workflow versions.

| Column                   | Type        | Notes                         |
| ------------------------ | ----------- | ----------------------------- |
| `id`                     | UUID        | Primary key                   |
| `workflow_definition_id` | UUID        | FK                            |
| `version`                | INTEGER     | Version number                |
| `status`                 | TEXT        | Draft/Published/Retired       |
| `definition`             | JSONB       | Versioned workflow definition |
| `published_at`           | TIMESTAMPTZ | Nullable                      |
| `created_by`             | TEXT        | Principal                     |
| `created_at`             | TIMESTAMPTZ | Required                      |

Recommended constraint:

```text
UNIQUE (workflow_definition_id, version)
```

Published versions must not be modified in place.

---

# 8. Workflow Execution Tables

## 8.1 `workflow_runs`

Stores an execution of a workflow.

| Column                | Type        | Notes         |
| --------------------- | ----------- | ------------- |
| `id`                  | UUID        | Primary key   |
| `project_id`          | UUID        | FK            |
| `workflow_version_id` | UUID        | FK            |
| `work_item_id`        | UUID        | FK            |
| `status`              | TEXT        | Runtime state |
| `input`               | JSONB       | Run input     |
| `started_at`          | TIMESTAMPTZ | Nullable      |
| `completed_at`        | TIMESTAMPTZ | Nullable      |
| `error_code`          | TEXT        | Nullable      |
| `error_message`       | TEXT        | Nullable      |
| `created_at`          | TIMESTAMPTZ | Required      |
| `updated_at`          | TIMESTAMPTZ | Required      |

---

## 8.2 `workflow_tasks`

Stores durable workflow task state.

| Column            | Type        | Notes             |
| ----------------- | ----------- | ----------------- |
| `id`              | UUID        | Primary key       |
| `workflow_run_id` | UUID        | FK                |
| `task_key`        | TEXT        | Workflow node key |
| `task_type`       | TEXT        | Task type         |
| `status`          | TEXT        | Task state        |
| `attempt`         | INTEGER     | Retry attempt     |
| `input`           | JSONB       | Task input        |
| `output`          | JSONB       | Task output       |
| `error_code`      | TEXT        | Nullable          |
| `error_message`   | TEXT        | Nullable          |
| `started_at`      | TIMESTAMPTZ | Nullable          |
| `completed_at`    | TIMESTAMPTZ | Nullable          |
| `created_at`      | TIMESTAMPTZ | Required          |
| `updated_at`      | TIMESTAMPTZ | Required          |

Recommended lookup:

```text
(workflow_run_id, task_key)
```

---

# 9. Agent Tables

## 9.1 `agents`

Stores logical agent identities.

| Column        | Type        | Notes            |
| ------------- | ----------- | ---------------- |
| `id`          | UUID        | Primary key      |
| `project_id`  | UUID        | Scope            |
| `key`         | TEXT        | Stable agent key |
| `name`        | TEXT        | Display name     |
| `description` | TEXT        | Optional         |
| `status`      | TEXT        | Agent state      |
| `created_at`  | TIMESTAMPTZ | Required         |
| `updated_at`  | TIMESTAMPTZ | Required         |

---

## 9.2 `agent_versions`

Stores versioned agent behaviour/configuration.

| Column             | Type        | Notes                      |
| ------------------ | ----------- | -------------------------- |
| `id`               | UUID        | Primary key                |
| `agent_id`         | UUID        | FK                         |
| `version`          | INTEGER     | Version number             |
| `status`           | TEXT        | Draft/Published/Retired    |
| `configuration`    | JSONB       | Agent configuration        |
| `prompt_reference` | TEXT        | Versioned prompt reference |
| `created_at`       | TIMESTAMPTZ | Required                   |
| `published_at`     | TIMESTAMPTZ | Nullable                   |

Published versions are immutable.

---

## 9.3 `agent_executions`

Stores an execution of an agent version.

| Column             | Type        | Notes                      |
| ------------------ | ----------- | -------------------------- |
| `id`               | UUID        | Primary key                |
| `workflow_task_id` | UUID        | FK                         |
| `agent_version_id` | UUID        | FK                         |
| `status`           | TEXT        | Execution state            |
| `input`            | JSONB       | Execution input metadata   |
| `output`           | JSONB       | Structured output metadata |
| `model_reference`  | TEXT        | Provider/model reference   |
| `started_at`       | TIMESTAMPTZ | Nullable                   |
| `completed_at`     | TIMESTAMPTZ | Nullable                   |
| `error_code`       | TEXT        | Nullable                   |
| `created_at`       | TIMESTAMPTZ | Required                   |

Sensitive prompt/context data should not be stored indiscriminately.

---

# 10. Artifact Tables

## 10.1 `artifacts`

Stores logical artifact identity and metadata.

| Column             | Type        | Notes                     |
| ------------------ | ----------- | ------------------------- |
| `id`               | UUID        | Primary key               |
| `project_id`       | UUID        | Scope                     |
| `artifact_type`    | TEXT        | PRD/design/plan/etc.      |
| `name`             | TEXT        | Display name              |
| `status`           | TEXT        | Draft/Approved/Final/etc. |
| `workflow_run_id`  | UUID        | Optional                  |
| `workflow_task_id` | UUID        | Optional                  |
| `created_by`       | TEXT        | Principal/agent           |
| `created_at`       | TIMESTAMPTZ | Required                  |
| `updated_at`       | TIMESTAMPTZ | Required                  |

---

## 10.2 `artifact_versions`

Stores immutable artifact versions.

| Column         | Type        | Notes                      |
| -------------- | ----------- | -------------------------- |
| `id`           | UUID        | Primary key                |
| `artifact_id`  | UUID        | FK                         |
| `version`      | INTEGER     | Version                    |
| `content_type` | TEXT        | MIME/content type          |
| `content_uri`  | TEXT        | External storage reference |
| `content_hash` | TEXT        | Integrity hash             |
| `metadata`     | JSONB       | Metadata/provenance        |
| `created_by`   | TEXT        | Principal/agent            |
| `created_at`   | TIMESTAMPTZ | Required                   |

Recommended constraint:

```text
UNIQUE (artifact_id, version)
```

Large artifact content should not normally be stored directly in PostgreSQL.

---

# 11. Approval Tables

## 11.1 `approvals`

Stores human or policy approvals.

| Column               | Type        | Notes                                |
| -------------------- | ----------- | ------------------------------------ |
| `id`                 | UUID        | Primary key                          |
| `project_id`         | UUID        | Scope                                |
| `workflow_run_id`    | UUID        | FK                                   |
| `approval_type`      | TEXT        | Planning/Release/etc.                |
| `status`             | TEXT        | Pending/Approved/Rejected            |
| `requested_by`       | TEXT        | Principal                            |
| `decided_by`         | TEXT        | Nullable                             |
| `decision_reason`    | TEXT        | Nullable                             |
| `evidence_reference` | JSONB       | Approved artifact/version references |
| `requested_at`       | TIMESTAMPTZ | Required                             |
| `decided_at`         | TIMESTAMPTZ | Nullable                             |

Approval must bind to the evidence/version being approved.

---

# 12. Policy Tables

## 12.1 `policies`

Stores project/organisation policy definitions.

| Column            | Type        | Notes                   |
| ----------------- | ----------- | ----------------------- |
| `id`              | UUID        | Primary key             |
| `organisation_id` | UUID        | FK                      |
| `project_id`      | UUID        | Nullable                |
| `key`             | TEXT        | Stable policy key       |
| `version`         | INTEGER     | Policy version          |
| `status`          | TEXT        | Draft/Published/Retired |
| `definition`      | JSONB       | Policy rules            |
| `created_by`      | TEXT        | Principal               |
| `created_at`      | TIMESTAMPTZ | Required                |
| `published_at`    | TIMESTAMPTZ | Nullable                |

Published policy versions must be immutable.

---

# 13. Integration Tables

## 13.1 `integrations`

Stores logical external-system integrations.

| Column          | Type        | Notes                    |
| --------------- | ----------- | ------------------------ |
| `id`            | UUID        | Primary key              |
| `project_id`    | UUID        | Scope                    |
| `type`          | TEXT        | Git/IssueTracker/CI/etc. |
| `provider`      | TEXT        | Provider identifier      |
| `name`          | TEXT        | Display name             |
| `status`        | TEXT        | Active/Disabled/etc.     |
| `configuration` | JSONB       | Non-secret configuration |
| `created_at`    | TIMESTAMPTZ | Required                 |
| `updated_at`    | TIMESTAMPTZ | Required                 |

Secrets are referenced through a secret-management mechanism and are not stored in this table as plaintext.

---

# 14. Tool Capability Tables

## 14.1 `tool_capabilities`

Stores logical tool capabilities.

| Column          | Type        | Notes                 |
| --------------- | ----------- | --------------------- |
| `id`            | UUID        | Primary key           |
| `project_id`    | UUID        | Scope                 |
| `key`           | TEXT        | Stable capability key |
| `name`          | TEXT        | Display name          |
| `risk_class`    | TEXT        | R0–R4                 |
| `input_schema`  | JSONB       | Validation schema     |
| `output_schema` | JSONB       | Validation schema     |
| `status`        | TEXT        | Active/Disabled       |
| `created_at`    | TIMESTAMPTZ | Required              |

---

## 14.2 `tool_invocations`

Stores material tool execution history.

| Column               | Type        | Notes                     |
| -------------------- | ----------- | ------------------------- |
| `id`                 | UUID        | Primary key               |
| `workflow_task_id`   | UUID        | FK                        |
| `tool_capability_id` | UUID        | FK                        |
| `status`             | TEXT        | Execution state           |
| `input_metadata`     | JSONB       | Sanitised metadata        |
| `output_metadata`    | JSONB       | Sanitised result metadata |
| `provider_reference` | TEXT        | Optional                  |
| `started_at`         | TIMESTAMPTZ | Nullable                  |
| `completed_at`       | TIMESTAMPTZ | Nullable                  |
| `error_code`         | TEXT        | Nullable                  |
| `created_at`         | TIMESTAMPTZ | Required                  |

Raw secrets and sensitive provider payloads must not be persisted by default.

---

# 15. Event and Outbox Tables

## 15.1 `outbox_events`

Stores events transactionally with state changes.

| Column            | Type        | Notes                |
| ----------------- | ----------- | -------------------- |
| `id`              | UUID        | Primary key          |
| `organisation_id` | UUID        | Scope                |
| `project_id`      | UUID        | Nullable             |
| `event_type`      | TEXT        | Event name           |
| `aggregate_type`  | TEXT        | Aggregate type       |
| `aggregate_id`    | UUID        | Aggregate identifier |
| `payload`         | JSONB       | Event payload        |
| `created_at`      | TIMESTAMPTZ | Required             |
| `published_at`    | TIMESTAMPTZ | Nullable             |
| `attempts`        | INTEGER     | Publish attempts     |
| `last_error`      | TEXT        | Nullable             |

Recommended indexes:

```text
(published_at, created_at)
(aggregate_type, aggregate_id)
```

---

## 15.2 `events`

Stores durable event history where the POC requires a persistent event record separate from the operational outbox.

| Column            | Type        | Notes                |
| ----------------- | ----------- | -------------------- |
| `id`              | UUID        | Primary key          |
| `organisation_id` | UUID        | Scope                |
| `project_id`      | UUID        | Nullable             |
| `event_type`      | TEXT        | Event name           |
| `aggregate_type`  | TEXT        | Aggregate type       |
| `aggregate_id`    | UUID        | Aggregate identifier |
| `payload`         | JSONB       | Event payload        |
| `created_at`      | TIMESTAMPTZ | Required             |

The exact relationship between `events` and `outbox_events` may be simplified if the implementation determines that a single durable event representation is sufficient.

---

# 16. Audit Tables

## 16.1 `audit_records`

Stores material security and workflow audit events.

| Column            | Type        | Notes              |
| ----------------- | ----------- | ------------------ |
| `id`              | UUID        | Primary key        |
| `organisation_id` | UUID        | Scope              |
| `project_id`      | UUID        | Nullable           |
| `actor_type`      | TEXT        | User/Agent/System  |
| `actor_id`        | TEXT        | Actor identifier   |
| `action`          | TEXT        | Action             |
| `target_type`     | TEXT        | Target type        |
| `target_id`       | UUID        | Target             |
| `outcome`         | TEXT        | Success/Failure    |
| `metadata`        | JSONB       | Sanitised metadata |
| `correlation_id`  | TEXT        | Correlation        |
| `created_at`      | TIMESTAMPTZ | Required           |

Audit data should be append-oriented.

---

# 17. Optional Context Manifest Persistence

The context model requires provenance and reproducibility.

Where persistence is needed, a POC implementation may store context manifests.

## 17.1 `context_manifests`

| Column             | Type        | Notes                        |
| ------------------ | ----------- | ---------------------------- |
| `id`               | UUID        | Primary key                  |
| `project_id`       | UUID        | Scope                        |
| `workflow_task_id` | UUID        | FK                           |
| `version`          | INTEGER     | Manifest version             |
| `manifest`         | JSONB       | Sources/versions/permissions |
| `created_at`       | TIMESTAMPTZ | Required                     |

The manifest should identify material sources without unnecessarily persisting sensitive content.

---

# 18. Referential Integrity

Foreign keys should enforce important relationships.

Examples:

```text
projects.organisation_id
    -> organisations.id

work_items.project_id
    -> projects.id

workflow_definitions.project_id
    -> projects.id

workflow_versions.workflow_definition_id
    -> workflow_definitions.id

workflow_runs.workflow_version_id
    -> workflow_versions.id

workflow_runs.work_item_id
    -> work_items.id

workflow_tasks.workflow_run_id
    -> workflow_runs.id

agent_versions.agent_id
    -> agents.id

agent_executions.agent_version_id
    -> agent_versions.id

artifacts.project_id
    -> projects.id

artifact_versions.artifact_id
    -> artifacts.id
```

---

# 19. Tenant and Project Isolation

Project-owned records must carry sufficient scope information to enforce access.

At minimum:

```text
organisation_id
project_id
```

where applicable.

Application queries must never retrieve project-owned records without applying the appropriate scope.

Database-level constraints should be used where practical to prevent cross-scope relationships.

---

# 20. Immutability Rules

The following are logically immutable after publication:

- workflow versions;
- agent versions;
- policy versions;
- artifact versions;
- approval decisions;
- audit records.

Corrections are represented through new versions or new records rather than destructive modification.

---

# 21. State Transition Integrity

State transitions should be performed through application/domain services.

The database should support concurrency protection through mechanisms such as:

- version columns;
- conditional updates;
- row locking where appropriate;
- transaction boundaries.

An application must not blindly overwrite a concurrently updated workflow/task state.

---

# 22. Transaction Boundaries

Examples requiring transactional consistency:

### Start workflow

```text
Create Workflow Run
+
Create Initial Tasks
+
Create Outbox Event
```

### Complete task

```text
Persist Task Result
+
Update Task State
+
Create Artifact Metadata
+
Create Outbox Event
```

### Approve planning

```text
Persist Approval
+
Transition Workflow
+
Create Outbox Event
```

The exact transaction boundary is implementation-specific, but durable state and corresponding events must remain consistent.

---

# 23. Idempotency

Operations that can be repeated must have an idempotency strategy.

Examples:

- workflow start;
- task execution;
- artifact publication;
- tool invocation;
- outbox publishing.

Possible mechanisms include:

- idempotency keys;
- unique business keys;
- execution identifiers;
- conditional updates.

---

# 24. Indexing Strategy

The initial database should index high-frequency operational queries.

Expected indexes include:

```text
projects:
    organisation_id

memberships:
    organisation_id
    project_id
    principal_id

work_items:
    project_id
    project_id + external_key

workflow_definitions:
    project_id + key

workflow_versions:
    workflow_definition_id + version

workflow_runs:
    project_id
    work_item_id
    status
    workflow_version_id

workflow_tasks:
    workflow_run_id
    status
    workflow_run_id + task_key

agent_executions:
    workflow_task_id
    status

artifacts:
    project_id
    workflow_run_id
    workflow_task_id

artifact_versions:
    artifact_id + version

approvals:
    workflow_run_id
    status

outbox_events:
    published_at + created_at

audit_records:
    organisation_id
    project_id
    actor_id
    created_at
    correlation_id
```

Indexes should be validated against actual query plans once implementation exists.

---

# 25. JSONB Usage

JSONB is appropriate for:

- workflow definitions;
- policy definitions;
- agent configuration;
- structured task inputs/outputs;
- event payloads;
- artifact metadata;
- tool schemas;
- context manifests.

JSONB should not be used as an excuse to avoid modelling stable relational relationships.

Core identifiers, scope, lifecycle, version and foreign-key relationships should remain explicit columns.

---

# 26. Migrations

Every schema change must be represented as a migration.

Migration requirements:

- deterministic;
- versioned;
- reversible where practical;
- tested;
- compatible with the application deployment strategy.

Never modify production schema manually as part of normal development.

---

# 27. Seed Data

The POC should provide deterministic seed data for:

- one organisation;
- one project;
- test membership;
- reference workflow;
- workflow version;
- deterministic agent/task configuration;
- test policy;
- test tool capabilities;
- reference work item.

Seed data must use synthetic values.

No real credentials may be included.

---

# 28. Database Package Boundary

The database implementation belongs under:

```text
packages/database/
```

Responsibilities:

- database connection;
- migration execution;
- repositories;
- queries;
- persistence mappings;
- transaction helpers.

The database package must not contain business rules that belong in the domain.

---

# 29. Repository Pattern

Conceptual interface:

```typescript
export interface WorkflowRunRepository {
  getById(id: WorkflowRunId): Promise<WorkflowRun | null>;
  save(run: WorkflowRun): Promise<void>;
  transition(
    id: WorkflowRunId,
    expectedVersion: number,
    nextState: WorkflowRunState,
  ): Promise<void>;
}
```

The PostgreSQL implementation belongs in the database package.

---

# 30. Persistence Mapping

Database records may differ from domain objects.

Example:

```text
PostgreSQL workflow_runs
        |
        v
Persistence Mapper
        |
        v
WorkflowRun domain object
```

Domain objects must not expose PostgreSQL-specific implementation details.

---

# 31. Deletion and Retention

The POC should avoid destructive deletion of material execution evidence.

For important records, prefer:

- status transitions;
- archival;
- retention policies.

Audit records should be append-oriented.

Published versions should remain available for historical execution traceability.

The exact retention period is a later operational policy decision.

---

# 32. Backup and Recovery

The POC should support database backup and restore testing appropriate to the development environment.

The technical implementation should verify that durable workflow state survives database restart.

Production backup retention and disaster-recovery targets are deferred.

---

# 33. Database Security

Required controls include:

- database credentials outside source control;
- least-privilege database users where practical;
- encrypted transport in environments that require it;
- no sensitive values in audit logs;
- no model/provider secrets in ordinary business tables;
- project/organisation scope enforcement at application boundaries.

---

# 34. Performance Expectations

The POC does not establish production-scale capacity targets.

However, schema design should avoid obvious operational bottlenecks.

Important paths include:

- active workflow lookup;
- task queue lookup;
- task state transitions;
- artifact retrieval;
- approval lookup;
- event/outbox publication;
- audit queries.

Performance should be measured once realistic test data exists.

---

# 35. POC Database Acceptance Scenario

Given a configured project and work item:

1. Create workflow run.
2. Persist workflow state.
3. Create workflow tasks.
4. Write corresponding outbox event transactionally.
5. Worker consumes the task.
6. Task result is persisted.
7. Artifact metadata is persisted.
8. Task completion event is persisted.
9. Workflow progresses.
10. Approval is persisted.
11. Workflow state changes.
12. Audit record is created.
13. Worker restart is performed.
14. Durable state is recovered without data loss.
15. Final workflow state remains traceable.

---

# 36. POC Database Definition of Done

The database foundation is complete when:

- PostgreSQL starts locally through Docker;
- migrations execute from a clean database;
- seed data loads;
- repositories work;
- project isolation is enforced;
- workflow state persists;
- task state persists;
- artifacts persist;
- approvals persist;
- events/outbox persist;
- audit records persist;
- worker restart does not lose durable state;
- integration/contract tests pass.

---

# 37. Relationship to the Domain Model

The schema implements persistence for the DevOS domain model.

The key relationships are:

```text
Organisation
   |
   +-- Projects
         |
         +-- Work Items
         |
         +-- Workflows
         |     |
         |     +-- Workflow Versions
         |     |
         |     +-- Workflow Runs
         |           |
         |           +-- Tasks
         |           |
         |           +-- Agent Executions
         |           |
         |           +-- Artifacts
         |           |
         |           +-- Approvals
         |
         +-- Agents
         |
         +-- Policies
         |
         +-- Integrations
         |
         +-- Tools
```

The database must preserve these relationships without becoming the owner of domain behaviour.

---

# 38. Relationship to the Software Change Workflow

The schema supports the workflow stages through durable workflow runs/tasks and their evidence.

For example:

```text
Discovery Task
    |
    v
Artifact
    |
    v
Requirements Task
    |
    v
PRD Artifact
    |
    v
Design Task
    |
    v
Technical Design Artifact
    |
    v
Planning Task
    |
    v
Implementation Plan
    |
    v
Approval
    |
    v
Development Task
```

This provides the durable control-plane foundation for the Software Change Workflow.

---

# 39. Relationship to the Technical Implementation

The schema implements the persistence boundary described by:

```text
specs/technical/poc-technical-implementation.md
```

PostgreSQL remains the system of record.

The queue is an execution mechanism.

The outbox provides durable event publication.

The artifact store may be external to PostgreSQL for large content.

---

# 40. Deferred Database Decisions

The following are intentionally deferred:

- production-scale partitioning;
- read replicas;
- sharding;
- multi-region database;
- advanced event sourcing;
- database-per-service;
- vector database;
- graph database;
- specialised search engine;
- production retention periods;
- production backup SLOs.

These should not be introduced into the POC without evidence.

---

# 41. Acceptance Criteria

- [ ] PostgreSQL is established as the POC system of record.
- [ ] Organisation/project tables are defined.
- [ ] Memberships are defined.
- [ ] Work items are defined.
- [ ] Workflow definitions and versions are defined.
- [ ] Workflow runs/tasks are defined.
- [ ] Agent and agent-version persistence is defined.
- [ ] Agent executions are defined.
- [ ] Artifacts and artifact versions are defined.
- [ ] Approvals are defined.
- [ ] Policies are defined.
- [ ] Integrations are defined.
- [ ] Tool capabilities/invocations are defined.
- [ ] Events/outbox are defined.
- [ ] Audit records are defined.
- [ ] Context-manifest persistence is addressed.
- [ ] Referential integrity is defined.
- [ ] Project isolation is addressed.
- [ ] Immutability/versioning is addressed.
- [ ] Transaction boundaries are defined.
- [ ] Idempotency is addressed.
- [ ] Indexing strategy is defined.
- [ ] JSONB usage is bounded.
- [ ] Migration strategy is defined.
- [ ] Seed data strategy is defined.
- [ ] Database package boundary is defined.
- [ ] Backup/recovery expectations are defined.
- [ ] Database security requirements are defined.
- [ ] POC acceptance scenario is defined.
- [ ] Deferred database decisions are explicit.

---

# 42. Result

The DevOS POC database establishes PostgreSQL as the durable control-plane system of record.

The schema preserves:

**Project and organisation scope.**

**Durable workflow definitions and execution state.**

**Versioned agents and artifacts.**

**Human approvals.**

**Policies and tool capabilities.**

**Events and transactional outbox records.**

**Audit evidence.**

**Context provenance where required.**

The database is intentionally designed to support the first DevOS vertical slice without prematurely introducing distributed persistence or specialised databases.

---

# 43. Source and Authority

This Markdown specification is the Git-ready database baseline derived from the authoritative DevOS POC Database Schema Specification.

It is intended to be implemented alongside:

```text
specs/architecture/domain-model.md
specs/architecture/repository-code-structure.md
specs/technical/poc-technical-implementation.md
specs/workflows/software-change-workflow.md
```

Where implementation details are not explicitly defined here, the DevOS constitution, domain model, technical implementation specification, API/data contracts, and approved architecture remain authoritative.
