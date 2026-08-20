# DevOS POC API & Data Contract Specification

**Document:** POC API & Data Contract Specification  
**Product:** DevOS  
**Version:** 1.0  
**Status:** Implementation Baseline  
**Purpose:** Define the concrete API, persistence, and cross-module contracts required to implement the DevOS POC around the Software Change Workflow.  
**Repository:** `C:\Development\devos`

---

## 1. Purpose

This specification defines the contract-level baseline for the DevOS POC.

It establishes stable boundaries for:

- REST/JSON APIs;
- persisted domain data;
- workflow definitions and execution;
- agent input/output;
- context manifests;
- artifacts;
- approvals;
- policies;
- tools;
- integrations;
- events;
- audit.

The specification intentionally defines stable contracts while leaving framework-specific implementation choices to engineering.

---

## 2. Contract Philosophy

The POC follows these contract principles:

1. API contracts are explicit and versioned.
2. Domain state is persisted before external work is dispatched.
3. External side effects are idempotent where practical.
4. Long-running work is asynchronous.
5. Agents and tools communicate through typed contracts.
6. Artifacts are first-class and immutable by version.
7. Published workflow versions are immutable.
8. Security is enforced server-side, never by client behaviour or prompts.
9. Identifiers are opaque UUIDs.
10. Every response carries correlation information.
11. Missing information must be represented explicitly rather than invented.
12. Cross-module contracts must be validated at their boundaries.

---

## 3. System Boundary

```text
Web / API Clients
        |
        v
    REST API
        |
        v
+-----------------------------+
|        DevOS Core           |
|                             |
| Work | Workflow | Artifact  |
| Agent | Knowledge | Approval|
| Policy | Integration | Audit|
+-----------------------------+
        |
        v
 Job / Event Layer
        |
   +----+----+
   |         |
Workers    Events
   |
   +---------+---------+---------+
   |         |         |         |
  LLM       Git       CI/Test   Storage
 Adapter   Adapter    Adapter
```

The API is the control-plane boundary.

Asynchronous execution occurs through jobs/events and workers.

External providers are accessed through adapters.

---

## 4. API Standards

| Concern        | Contract                                          |
| -------------- | ------------------------------------------------- |
| Protocol       | HTTPS                                             |
| Format         | JSON                                              |
| Encoding       | UTF-8                                             |
| API prefix     | `/api/v1`                                         |
| IDs            | UUID                                              |
| Dates          | ISO-8601 UTC                                      |
| Pagination     | Cursor-based preferred                            |
| Errors         | Standard error envelope                           |
| Authentication | Bearer/OIDC session token                         |
| Correlation    | `X-Correlation-Id`                                |
| Idempotency    | `Idempotency-Key` for relevant mutation endpoints |
| Concurrency    | ETag/version checks for editable resources        |

---

## 5. Standard Response Envelope

### 5.1 Single Resource

```json
{
  "data": {},
  "meta": {
    "requestId": "uuid"
  }
}
```

### 5.2 List

```json
{
  "data": [],
  "meta": {
    "requestId": "uuid",
    "nextCursor": "..."
  }
}
```

### 5.3 Error

```json
{
  "error": {
    "code": "DEVOS_...",
    "message": "Human-readable message",
    "details": {}
  },
  "meta": {
    "requestId": "uuid"
  }
}
```

---

## 6. Error Contract

| HTTP          | Use                                    |
| ------------- | -------------------------------------- |
| `400`         | Malformed/invalid request              |
| `401`         | Unauthenticated                        |
| `403`         | Authenticated but unauthorised         |
| `404`         | Resource not found within caller scope |
| `409`         | Conflict/version/idempotency conflict  |
| `422`         | Semantically invalid request           |
| `429`         | Rate/usage limit                       |
| `500`         | Unexpected server failure              |
| `502` / `503` | External provider unavailable          |

Error messages must not expose:

- secrets;
- internal credentials;
- stack traces;
- hidden tenant information.

---

# 7. Domain Identifier Rules

| Entity           | Identifier          |
| ---------------- | ------------------- |
| Organisation     | `organisationId`    |
| Project          | `projectId`         |
| User             | `userId`            |
| Work item        | `workItemId`        |
| Workflow         | `workflowId`        |
| Workflow version | `workflowVersionId` |
| Run              | `runId`             |
| Task             | `taskId`            |
| Agent            | `agentId`           |
| Agent execution  | `agentExecutionId`  |
| Tool             | `toolId`            |
| Tool invocation  | `toolInvocationId`  |
| Artifact         | `artifactId`        |
| Artifact version | `artifactVersionId` |
| Approval         | `approvalId`        |
| Integration      | `integrationId`     |
| Event            | `eventId`           |
| Audit record     | `auditId`           |

---

# 8. Core Data Model

| Entity             | Core fields                                                      |
| ------------------ | ---------------------------------------------------------------- |
| Organisation       | id, name, status, createdAt                                      |
| User               | id, externalIdentity, status, createdAt                          |
| Project            | id, organisationId, name, key, status                            |
| Membership         | id, projectId, userId, role                                      |
| WorkItem           | id, projectId, externalRef, title, description, status           |
| WorkflowDefinition | id, projectId, name, description, status                         |
| WorkflowVersion    | id, workflowId, version, definition, hash, publishedAt           |
| WorkflowRun        | id, projectId, workflowVersionId, workItemId, status, timestamps |
| WorkflowTask       | id, runId, nodeId, type, status, attempts, timestamps            |
| AgentDefinition    | id, name, role, version, config, status                          |
| AgentExecution     | id, taskId, agentId, status, inputRef, outputRef                 |
| ToolDefinition     | id, name, capability, version, status                            |
| ToolInvocation     | id, taskId, toolId, capability, status, targetRef                |
| Artifact           | id, projectId, type, name, status                                |
| ArtifactVersion    | id, artifactId, version, contentRef, hash, provenance            |
| ContextManifest    | id, executionId, sources, policySnapshot                         |
| Approval           | id, runId, taskId, type, status, scopeHash                       |
| Policy             | id, projectId, type, definition, version                         |
| Integration        | id, projectId, provider, status, credentialRef                   |
| Event              | id, type, aggregateType, aggregateId, payload, status            |
| AuditRecord        | id, actorType, actorId, action, resource, result, timestamp      |

---

# 9. Organisation & Project API

| Method | Endpoint                                        | Purpose                  |
| ------ | ----------------------------------------------- | ------------------------ |
| GET    | `/api/v1/projects`                              | List authorised projects |
| POST   | `/api/v1/projects`                              | Create project           |
| GET    | `/api/v1/projects/{projectId}`                  | Get project              |
| PATCH  | `/api/v1/projects/{projectId}`                  | Update project           |
| GET    | `/api/v1/projects/{projectId}/members`          | List members             |
| POST   | `/api/v1/projects/{projectId}/members`          | Add member               |
| PATCH  | `/api/v1/projects/{projectId}/members/{userId}` | Change role              |
| DELETE | `/api/v1/projects/{projectId}/members/{userId}` | Remove member            |

All project responses and operations are scope-authorised server-side.

---

# 10. Work Item API

| Method | Endpoint                                        | Purpose                 |
| ------ | ----------------------------------------------- | ----------------------- |
| GET    | `/api/v1/projects/{projectId}/work-items`       | List work items         |
| POST   | `/api/v1/projects/{projectId}/work-items`       | Create/import work item |
| GET    | `/api/v1/work-items/{workItemId}`               | Get work item           |
| PATCH  | `/api/v1/work-items/{workItemId}`               | Update work item        |
| POST   | `/api/v1/work-items/{workItemId}/workflow-runs` | Start workflow          |
| GET    | `/api/v1/work-items/{workItemId}/artifacts`     | List related artifacts  |

---

# 11. Work Item Contract

```json
{
  "id": "uuid",
  "projectId": "uuid",
  "externalRef": "PROJ-123",
  "title": "Add customer status field",
  "description": "...",
  "status": "OPEN",
  "source": "jira",
  "metadata": {},
  "createdAt": "2026-08-18T07:00:00Z",
  "updatedAt": "2026-08-18T07:00:00Z"
}
```

The exact work-item status enumeration is defined by the implementation contract.

---

# 12. Workflow Definition API

| Method | Endpoint                                            | Purpose               |
| ------ | --------------------------------------------------- | --------------------- |
| GET    | `/api/v1/projects/{projectId}/workflows`            | List workflows        |
| POST   | `/api/v1/projects/{projectId}/workflows`            | Create draft          |
| GET    | `/api/v1/workflows/{workflowId}`                    | Get workflow          |
| PATCH  | `/api/v1/workflows/{workflowId}`                    | Update draft          |
| GET    | `/api/v1/workflows/{workflowId}/versions`           | List versions         |
| POST   | `/api/v1/workflows/{workflowId}/validate`           | Validate draft        |
| POST   | `/api/v1/workflows/{workflowId}/publish`            | Publish version       |
| GET    | `/api/v1/workflows/{workflowId}/versions/{version}` | Get immutable version |
| GET    | `/api/v1/workflows/{workflowId}/diff`               | Compare versions      |

Published workflow versions are immutable.

---

# 13. Workflow Definition Contract

Example:

```json
{
  "name": "Software Change",
  "description": "...",
  "trigger": {
    "type": "WORK_ITEM_MANUAL"
  },
  "inputs": [
    {
      "name": "workItemId",
      "type": "WORK_ITEM",
      "required": true
    }
  ],
  "nodes": [
    {
      "id": "intake",
      "type": "AGENT_TASK",
      "agentRef": "triage-v1"
    },
    {
      "id": "requirements",
      "type": "AGENT_TASK",
      "agentRef": "requirements-v1"
    },
    {
      "id": "approval",
      "type": "APPROVAL",
      "approvalType": "PLANNING"
    }
  ],
  "edges": [
    {
      "from": "intake",
      "to": "requirements"
    },
    {
      "from": "requirements",
      "to": "approval"
    }
  ],
  "policies": ["project-default"],
  "outputs": []
}
```

---

# 14. Workflow Node Contract

| Field            | Requirement                    |
| ---------------- | ------------------------------ |
| `id`             | Unique within workflow version |
| `type`           | Known runtime primitive        |
| `name`           | Human-readable                 |
| `config`         | Type-specific configuration    |
| `inputs`         | Input bindings                 |
| `outputs`        | Output bindings                |
| `policyRefs`     | Applicable policies            |
| `retryPolicy`    | Optional bounded retry         |
| `timeoutSeconds` | Optional execution timeout     |

---

# 15. Supported POC Node Types

| Type         | Purpose             |
| ------------ | ------------------- |
| `TRIGGER`    | Start               |
| `TASK`       | Generic task        |
| `AGENT_TASK` | Agent execution     |
| `TOOL_TASK`  | Tool execution      |
| `APPROVAL`   | Human gate          |
| `CONDITION`  | Branch              |
| `PARALLEL`   | Concurrent branches |
| `JOIN`       | Synchronise         |
| `WAIT`       | Pause               |
| `END`        | Terminal state      |

---

# 16. Workflow Run API

| Method | Endpoint                                             | Purpose                       |
| ------ | ---------------------------------------------------- | ----------------------------- |
| POST   | `/api/v1/workflows/{workflowId}/runs`                | Start run from active version |
| POST   | `/api/v1/workflow-versions/{workflowVersionId}/runs` | Start exact version           |
| GET    | `/api/v1/runs/{runId}`                               | Get run                       |
| GET    | `/api/v1/runs/{runId}/tasks`                         | List tasks                    |
| POST   | `/api/v1/runs/{runId}/pause`                         | Pause                         |
| POST   | `/api/v1/runs/{runId}/resume`                        | Resume                        |
| POST   | `/api/v1/runs/{runId}/cancel`                        | Cancel                        |
| POST   | `/api/v1/runs/{runId}/retry`                         | Retry eligible failure        |
| GET    | `/api/v1/runs/{runId}/events`                        | Get run events                |
| GET    | `/api/v1/runs/{runId}/timeline`                      | Get execution timeline        |

---

# 17. Start Run Contract

```http
POST /api/v1/workflow-versions/{workflowVersionId}/runs
```

```json
{
  "workItemId": "uuid",
  "inputs": {},
  "idempotencyKey": "client-generated-key"
}
```

The server must verify that the caller can execute the workflow version against the specified project/work item.

---

# 18. Workflow Run State Contract

| State               | Meaning                           |
| ------------------- | --------------------------------- |
| `PENDING`           | Created but not dispatched        |
| `RUNNING`           | Execution active                  |
| `WAITING`           | Waiting for event/time/dependency |
| `AWAITING_APPROVAL` | Human decision required           |
| `PAUSED`            | Explicitly paused                 |
| `FAILED`            | Terminal unrecoverable failure    |
| `CANCELLED`         | Cancelled                         |
| `COMPLETED`         | Successful terminal state         |

---

# 19. Workflow Task Contract

Example:

```json
{
  "id": "uuid",
  "runId": "uuid",
  "nodeId": "requirements",
  "type": "AGENT_TASK",
  "status": "RUNNING",
  "attempt": 1,
  "inputRefs": [],
  "outputRefs": [],
  "error": null,
  "startedAt": "...",
  "completedAt": null
}
```

Task state is durable and must survive process restart.

---

# 20. Agent API

| Method | Endpoint                                 | Purpose                   |
| ------ | ---------------------------------------- | ------------------------- |
| GET    | `/api/v1/projects/{projectId}/agents`    | List available agents     |
| POST   | `/api/v1/projects/{projectId}/agents`    | Register agent definition |
| GET    | `/api/v1/agents/{agentId}`               | Get agent                 |
| GET    | `/api/v1/agents/{agentId}/executions`    | List executions           |
| GET    | `/api/v1/agent-executions/{executionId}` | Get execution             |

---

# 21. Agent Definition Contract

```json
{
  "name": "Requirements Analyst",
  "role": "REQUIREMENTS",
  "version": "1.0.0",
  "provider": "llm-provider-ref",
  "modelRef": "model-ref",
  "inputSchemaRef": "requirements-input-v1",
  "outputSchemaRef": "prd-v1",
  "allowedCapabilities": ["knowledge.read", "artifact.write"],
  "status": "PUBLISHED"
}
```

Published agent versions are immutable.

---

# 22. Agent Execution Contract

| Field                 | Purpose                   |
| --------------------- | ------------------------- |
| `taskId`              | Workflow task             |
| `agentVersion`        | Immutable agent reference |
| `objective`           | Specific task goal        |
| `contextManifestId`   | Authorised context        |
| `inputRefs`           | Inputs/artifacts          |
| `allowedCapabilities` | Tool authority            |
| `outputSchema`        | Required output           |
| `policySnapshot`      | Policy used               |
| `result`              | Structured result         |
| `uncertainty`         | Explicit uncertainty      |
| `attempt`             | Execution attempt         |

The execution contract must preserve the distinction between:

- agent objective;
- authorised context;
- permitted capabilities;
- model output;
- validated result.

---

# 23. Agent Result Contract

```json
{
  "status": "SUCCEEDED",
  "result": {
    "artifactId": "uuid"
  },
  "uncertainty": [
    {
      "statement": "Target API contract is not documented",
      "severity": "MEDIUM"
    }
  ],
  "evidence": [
    {
      "sourceRef": "artifact:uuid:v2"
    }
  ]
}
```

The contract explicitly supports the DevOS rule that the system must not invent missing information.

---

# 24. Artifact API

| Method | Endpoint                                            | Purpose         |
| ------ | --------------------------------------------------- | --------------- |
| GET    | `/api/v1/projects/{projectId}/artifacts`            | List artifacts  |
| POST   | `/api/v1/projects/{projectId}/artifacts`            | Create artifact |
| GET    | `/api/v1/artifacts/{artifactId}`                    | Get artifact    |
| GET    | `/api/v1/artifacts/{artifactId}/versions`           | List versions   |
| GET    | `/api/v1/artifacts/{artifactId}/versions/{version}` | Get version     |
| POST   | `/api/v1/artifacts/{artifactId}/versions`           | Create version  |
| GET    | `/api/v1/artifacts/{artifactId}/provenance`         | Get provenance  |

---

# 25. Artifact Contract

```json
{
  "id": "uuid",
  "projectId": "uuid",
  "type": "PRD",
  "name": "PRD - PROJ-123",
  "status": "VALIDATED",
  "currentVersion": 2,
  "provenance": {
    "workflowRunId": "uuid",
    "taskId": "uuid",
    "agentExecutionId": "uuid"
  }
}
```

Artifact versions are immutable.

---

# 26. Artifact Types

| Type                   | Reference workflow use |
| ---------------------- | ---------------------- |
| `TRIAGE_REPORT`        | Intake                 |
| `DISCOVERY_REPORT`     | Discovery              |
| `PRD`                  | Requirements           |
| `TECHNICAL_DESIGN`     | Architecture           |
| `IMPLEMENTATION_PLAN`  | Planning               |
| `CODE_CHANGE_EVIDENCE` | Development            |
| `TEST_EVIDENCE`        | Validation             |
| `REVIEW_EVIDENCE`      | Review                 |
| `RELEASE_EVIDENCE`     | Release                |

---

# 27. Knowledge & Context API Boundary

The POC requires a controlled contract for resolving task-specific knowledge/context.

The context contract should provide:

- task/work-item inputs;
- project context;
- approved artifacts;
- repository or integration references where authorised;
- applicable policies;
- source provenance;
- policy snapshot;
- context version.

A context manifest is the explicit record of the material context assembled for an execution.

Context retrieval must apply the same permission checks as direct resource access.

---

# 28. Context Manifest Contract

Conceptually:

```json
{
  "id": "uuid",
  "executionId": "uuid",
  "sources": [
    {
      "type": "ARTIFACT",
      "ref": "artifact:uuid:v2"
    },
    {
      "type": "WORK_ITEM",
      "ref": "work-item:uuid"
    }
  ],
  "policySnapshot": {
    "policyVersion": "project-default:v3"
  }
}
```

The manifest should identify material sources without unnecessarily persisting sensitive content.

---

# 29. Approval API

The POC approval boundary must support:

- retrieving an approval;
- requesting an approval;
- approving;
- rejecting;
- auditing the decision.

Representative endpoints:

| Method | Endpoint                                 | Purpose      |
| ------ | ---------------------------------------- | ------------ |
| GET    | `/api/v1/approvals/{approvalId}`         | Get approval |
| POST   | `/api/v1/approvals/{approvalId}/approve` | Approve      |
| POST   | `/api/v1/approvals/{approvalId}/reject`  | Reject       |

Approval decisions must be bound to the exact evidence being approved.

---

# 30. Example Approval Decision

```http
POST /api/v1/approvals/{approvalId}/approve
```

```json
{
  "comment": "Planning package approved",
  "scopeHash": "expected-hash"
}
```

The server verifies:

- approval scope hash;
- reviewer role;
- current workflow state;
- applicable policy.

The client cannot grant itself authority through the request payload.

---

# 31. Policy API Boundary

Policies determine what users, agents and tools are permitted to do.

Policy contracts should support:

- policy identity;
- version;
- project scope;
- policy type;
- definition;
- publication state.

Published policy versions are immutable.

Policy evaluation occurs server-side.

---

# 32. Tool Gateway API Boundary

Tools expose controlled capabilities to workflows and agents.

A tool contract contains:

- capability;
- version;
- target;
- parameters;
- idempotency key;
- authorisation context;
- result;
- error.

Example:

```json
{
  "capability": "git.pull_request.create",
  "target": {
    "repositoryId": "uuid",
    "baseBranch": "main",
    "headBranch": "feature/PROJ-123"
  },
  "parameters": {
    "title": "PROJ-123 Add customer status",
    "bodyRef": "artifact:uuid:v1"
  },
  "idempotencyKey": "uuid"
}
```

Tool authority is evaluated independently of model output.

---

# 33. Integration Contract

Integrations represent external systems such as:

- Git;
- issue tracking;
- CI/test;
- LLM providers;
- storage;
- notifications.

An integration contract should identify:

- project;
- provider;
- status;
- credential reference;
- provider-specific configuration;
- supported capabilities.

Credentials are references only.

---

# 34. Event Contract

Events represent material state changes and execution events.

An event envelope should contain at least:

```json
{
  "id": "uuid",
  "type": "ArtifactPublished",
  "schemaVersion": 1,
  "aggregateType": "Artifact",
  "aggregateId": "uuid",
  "projectId": "uuid",
  "occurredAt": "2026-08-18T07:00:00Z",
  "correlationId": "uuid",
  "payload": {}
}
```

Event payloads must carry schema versions.

Consumers must tolerate duplicate delivery.

---

# 35. Core POC Events

At minimum, the POC should support events equivalent to:

- `WorkflowRunStarted`;
- `WorkflowTaskStarted`;
- `WorkflowTaskCompleted`;
- `ArtifactPublished`;
- `WorkflowRunCompleted`.

Additional events may be added as required by the reference workflow.

---

# 36. Audit Contract

Audit records capture material actions.

An audit record should identify:

- actor type;
- actor ID;
- action;
- resource;
- result;
- project/organisation scope;
- timestamp;
- correlation ID.

Audit data should be append-only/immutable where practical.

---

# 37. Data Access Rules

1. Every project-scoped query includes project scope.
2. Organisation administrators do not automatically access unrelated organisations.
3. Object-storage keys include tenant/project scoping.
4. Artifact references are authorised before retrieval.
5. Context retrieval applies the same permission checks as direct access.
6. Audit data is protected from ordinary project users where required.

---

# 38. API Versioning

The POC uses URL versioning:

```text
/api/v1
```

Breaking changes require a new API version.

Preferred evolution rules:

| Change                        | Rule                                   |
| ----------------------------- | -------------------------------------- |
| Add optional field            | Allowed in v1                          |
| Add enum value                | Clients should tolerate unknown values |
| Rename/remove field           | Breaking; new version                  |
| Change semantics              | Breaking; new version                  |
| Reject previously valid input | Breaking; new version                  |
| Internal DB change            | No API impact if contract preserved    |

---

# 39. Schema Evolution

The POC requires:

- `createdAt` / `updatedAt` where relevant;
- immutable published workflow definitions;
- immutable artifact versions;
- immutable published agent versions;
- versioned tool contracts;
- schema versions on event payloads;
- forward-controlled and tested database migrations;
- backwards-compatible reads where practical during deployment transitions.

---

# 40. Security-Sensitive Data Contract

| Data               | Rule                                                |
| ------------------ | --------------------------------------------------- |
| Credentials        | Reference only; never ordinary JSON response        |
| Access tokens      | Never logged                                        |
| Secrets            | Never placed in agent context                       |
| Prompt/context     | Minimise retention                                  |
| Repository content | Project-scoped                                      |
| Audit              | Protected and immutable/append-only where practical |
| PII                | Minimise and redact where unnecessary               |

---

# 41. API Security Requirements

The API must:

- validate authentication on every protected endpoint;
- authorise resource scope server-side;
- validate request schemas;
- rate-limit expensive endpoints;
- protect mutation endpoints against replay where applicable;
- redact sensitive fields from logs;
- never trust agent-supplied project/user identity;
- re-evaluate tool authority on every invocation.

---

# 42. Workflow-to-API Mapping

| Workflow stage    | Primary API/contracts                |
| ----------------- | ------------------------------------ |
| Intake            | Work Item + Run                      |
| Discovery         | Knowledge + Agent + Artifact         |
| Requirements      | Agent + PRD Artifact                 |
| Technical Design  | Agent + Technical Design Artifact    |
| Planning          | Agent + Implementation Plan Artifact |
| Planning Approval | Approval + Policy                    |
| Development       | Agent + Tool Gateway + Git           |
| Validation        | Tool Gateway + Test Evidence         |
| Review            | Agent + Review Evidence              |
| Release Readiness | Policy + Artifact                    |
| Release Approval  | Approval + Tool Gateway              |
| Closure           | Work Item + Audit + Release Evidence |

---

# 43. Reference Run Sequence

1. POST start run.
2. Create `WorkflowRun` + first `WorkflowTask`.
3. Worker claims task.
4. Resolve context.
5. Execute agent.
6. Validate output.
7. Persist artifact version.
8. Emit `ArtifactPublished`.
9. Advance workflow.
10. Create approval.
11. Pause in `AWAITING_APPROVAL`.
12. Human approves.
13. Resume development task.
14. Tool gateway creates branch/commit/PR.
15. Run build/tests.
16. Review agent evaluates evidence.
17. Route to rework if necessary.
18. Pass release readiness.
19. Request release approval.
20. Execute permitted release tool.
21. Persist release evidence.
22. Close run.

---

# 44. Example Task Execution Payload

```json
{
  "taskId": "uuid",
  "runId": "uuid",
  "nodeId": "requirements",
  "objective": "Produce an implementation-ready PRD",
  "inputRefs": ["work-item:uuid"],
  "contextManifestId": "uuid",
  "agentRef": "requirements-agent:1.0.0",
  "allowedCapabilities": ["knowledge.read", "artifact.write"],
  "outputSchemaRef": "prd:1.0"
}
```

This contract makes the execution boundary explicit.

The agent receives a task objective, authorised context, allowed capabilities, and required output schema.

---

# 45. OpenAPI Expectations

The implementation must either:

- generate OpenAPI from the implementation; or
- maintain an authoritative OpenAPI specification.

The API documentation must cover:

- every request/response schema;
- authentication requirements;
- error codes;
- idempotency behaviour;
- pagination;
- enum values;
- endpoint semantics.

API documentation must be published for internal developers.

---

# 46. Contract Testing

The POC must include contract tests for:

| Contract Test       | Focus                              |
| ------------------- | ---------------------------------- |
| REST API            | Schema, status, authorisation      |
| Workflow transition | Legal state changes                |
| Agent input/output  | Schema validation                  |
| Artifact            | Version/provenance                 |
| Tool capability     | Permission/result                  |
| Event               | Envelope/schema/duplicate handling |
| Approval            | Scope/role/state                   |
| Integration         | Provider adapter contract          |

Contract tests are part of the CI quality gates.

---

# 47. POC API Acceptance Criteria

The POC API/data contract baseline is accepted when:

- [ ] All P0 endpoints are documented.
- [ ] Project scope is enforced.
- [ ] Workflow versions are immutable.
- [ ] Runs survive process restart.
- [ ] Agent outputs validate against schemas.
- [ ] Artifacts are versioned and retrievable.
- [ ] Tool calls are authorised centrally.
- [ ] Approval decisions are bound to exact scope.
- [ ] Events are durable and duplicate-safe.
- [ ] Audit records exist for material actions.
- [ ] The end-to-end Software Change Workflow can be executed through these contracts.

---

# 48. Implementation Order

The source specification defines this contract implementation order:

1. Define database schema and migrations.
2. Define OpenAPI base/error/auth conventions.
3. Implement project/work-item APIs.
4. Implement workflow definition/version APIs.
5. Implement workflow run/task APIs.
6. Implement artifact APIs.
7. Implement agent contracts/runtime APIs.
8. Implement knowledge/context APIs.
9. Implement approval/policy APIs.
10. Implement tool gateway/integration APIs.
11. Implement event/outbox contracts.
12. Implement audit APIs.
13. Generate contract tests.
14. Run the full end-to-end workflow.

---

# 49. Contract Ownership

| Contract area     | Primary owner             |
| ----------------- | ------------------------- |
| Workflow/state    | Platform/Backend          |
| REST API          | Backend                   |
| Data model        | Backend/Tech Lead         |
| Agent             | AI/Agent Engineering      |
| Artifact          | Platform/Backend          |
| Knowledge/context | AI/Agent + Platform       |
| Tool gateway      | Platform/Security         |
| Approval/policy   | Platform/Security/Product |
| Events            | Platform                  |
| Integrations      | Integration/Backend       |
| OpenAPI           | Backend + QA              |

---

# 50. Architectural Decisions

### ADR-API-001 — REST for POC

REST/JSON is sufficient for control-plane APIs. Internal asynchronous execution uses jobs/events.

### ADR-API-002 — PostgreSQL as Source of Truth

Durable workflow state, approvals, metadata and audit references remain in a relational system.

### ADR-API-003 — Object Storage for Large Artifacts

Large documents/logs are kept outside transactional tables.

### ADR-API-004 — Typed Agent/Tool Contracts

AI-generated content cannot directly mutate platform state without passing through typed validation and policy.

### ADR-API-005 — Immutable Versions

Workflow, agent and artifact versions provide reproducibility.

### ADR-API-006 — Tool Gateway as Security Boundary

External mutations are authorised independently of model output.

### ADR-API-007 — Event Outbox

Domain events are persisted transactionally before asynchronous publication.

---

# 51. Deferred Contracts

The following are explicitly deferred:

- full workflow designer schema extensions;
- multi-agent negotiation protocol;
- enterprise policy-as-code language;
- advanced cost/budget contracts;
- multi-provider deployment abstraction;
- marketplace/package contracts;
- advanced streaming UI protocol;
- cross-organisation workflow sharing;
- advanced event streaming infrastructure.

These are not POC requirements.

---

# 52. Relationship to the Database Specification

The API/data contracts map to the PostgreSQL system of record defined in:

```text
specs/database/poc-database-schema.md
```

The API contract uses domain-oriented identifiers and response models.

The database schema remains an implementation persistence model rather than an API contract.

---

# 53. Relationship to the Domain Model

The API contracts preserve the domain concepts established by:

```text
specs/architecture/domain-model.md
```

In particular:

- workflow and workflow version remain distinct;
- workflow run and task remain distinct;
- agent version and agent execution remain distinct;
- artifact and artifact version remain distinct;
- approval is first-class;
- context is explicit;
- tools are controlled capabilities;
- events and audit are traceable.

---

# 54. Relationship to the Technical Implementation

The API contracts implement the control-plane boundary described by:

```text
specs/technical/poc-technical-implementation.md
```

The API remains asynchronous for long-running work.

The worker executes durable tasks.

PostgreSQL remains the source of truth.

External systems remain behind adapters and the Tool Gateway.

---

# 55. Relationship to the Software Change Workflow

The contract set is intentionally designed to execute the Software Change Workflow end to end.

The principal chain is:

```text
Work Item
   |
   v
Workflow Run
   |
   v
Workflow Task
   |
   v
Context Manifest
   |
   v
Agent Execution
   |
   v
Artifact Version
   |
   v
Approval
   |
   v
Tool Invocation
   |
   v
Validation Evidence
   |
   v
Review Evidence
   |
   v
Release Evidence
   |
   v
Audit / Events
```

---

# 56. Security and Authority Boundary

The central security rule is:

> The existence of an API contract, workflow task, or agent instruction does not itself grant permission to perform an external action.

Authority is evaluated at the server boundary.

For tool actions:

```text
Agent Request
     |
     v
Typed Validation
     |
     v
Project Scope
     |
     v
Policy
     |
     v
Capability Permission
     |
     v
Credential Resolution
     |
     v
Provider Adapter
```

---

# 57. Missing Information and Uncertainty

The contract model explicitly supports uncertainty.

An agent result can state that required information is unavailable rather than inventing a value.

Example:

```json
{
  "status": "SUCCEEDED",
  "uncertainty": [
    {
      "statement": "Target API contract is not documented",
      "severity": "MEDIUM"
    }
  ]
}
```

Where required information prevents safe completion, the workflow must surface the insufficiency rather than fabricate a result.

---

# 58. POC Boundary

The API POC should first support the Software Change Workflow completely and cleanly.

The POC should not add API surfaces merely because a future DevOS capability could use them.

The most important contracts are the boundaries between:

```text
Workflow
    ↕
Agent
    ↕
Context
    ↕
Artifact
```

and:

```text
Workflow
    ↕
Tool
    ↕
Policy
    ↕
Approval
```

Correct implementation of these boundaries allows DevOS to add new workflows and agents without rewriting the platform.

---

# 59. Final Recommendation

This specification should become the contract baseline for implementation.

Engineering should resist introducing new API surfaces without a demonstrated POC requirement.

Every contract should have:

- an explicit owner;
- a version;
- a validation schema;
- defined security requirements;
- defined error behaviour;
- contract tests where appropriate.

The Software Change Workflow should remain the reference consumer of the contract set until the control plane is proven.

---

# 60. Acceptance Criteria for This Specification

- [ ] API standards are defined.
- [ ] Response envelopes are defined.
- [ ] Error contracts are defined.
- [ ] Identifier rules are defined.
- [ ] Core data contracts are identified.
- [ ] Organisation/project APIs are defined.
- [ ] Work-item APIs are defined.
- [ ] Workflow definition/version APIs are defined.
- [ ] Workflow run/task APIs are defined.
- [ ] Agent APIs and execution contracts are defined.
- [ ] Artifact APIs and version contracts are defined.
- [ ] Knowledge/context contract boundary is defined.
- [ ] Approval contracts are defined.
- [ ] Policy boundary is defined.
- [ ] Tool gateway contracts are defined.
- [ ] Integration contracts are defined.
- [ ] Event contracts are defined.
- [ ] Audit contract is defined.
- [ ] Security-sensitive data rules are defined.
- [ ] API versioning rules are defined.
- [ ] Schema evolution rules are defined.
- [ ] Workflow-to-API mapping is defined.
- [ ] Reference execution sequence is defined.
- [ ] OpenAPI expectations are defined.
- [ ] Contract testing is defined.
- [ ] Acceptance criteria are defined.
- [ ] Implementation order is defined.
- [ ] Contract ownership is defined.
- [ ] Architectural decisions are recorded.
- [ ] Deferred contracts are explicit.

---

# 61. Source and Authority

This Markdown specification is the Git-ready representation of:

**DevOS POC API & Data Contract Specification v1.0 — Contract-Level Specification for the POC.**

The source establishes REST/JSON with `/api/v1`, PostgreSQL as the primary persistence system, object storage for large content, explicit typed contracts, immutable versions, server-side security, asynchronous execution, idempotency, correlation, OpenAPI expectations, contract testing, workflow-to-API mapping, implementation order, ownership, architectural decisions and deferred contracts.

The specification has been converted without intentionally adding future capabilities as POC requirements.

Where this document is silent, the DevOS constitution, domain model, repository/code structure, technical implementation specification, database schema and Software Change Workflow remain authoritative.

---

# 62. Result

The DevOS POC API & Data Contract establishes the external and cross-module boundaries required for the first vertical slice.

**REST/JSON provides the control-plane API.**

**PostgreSQL provides durable state.**

**Workflow execution is asynchronous.**

**Agents and tools use typed contracts.**

**Artifacts are immutable by version.**

**Context is explicit and permission-aware.**

**Approvals are bound to exact evidence.**

**Tool actions are independently authorised.**

**Events are durable and duplicate-safe.**

**Audit records preserve material action history.**

**The API contract supports the complete Software Change Workflow without requiring the future platform surface to be built prematurely.**
