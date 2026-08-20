# DevOS POC Repository & Code Structure Specification

**Document:** Repository & Code Structure Specification  
**Product:** DevOS  
**Version:** 1.0  
**Purpose:** Implementation Repository Baseline  
**Repository:** `C:\Development\devos`

---

## 1. Purpose

This specification defines the repository layout, package boundaries, naming conventions, dependency rules, interfaces, testing structure, security boundaries, and developer workflow for the DevOS POC.

Its purpose is to remove structural decisions from Sprint 1 implementation.

The specification is based on the authoritative DevOS POC Repository & Code Structure Specification v1.0.

The most important structural rule is:

> Applications orchestrate, packages encapsulate, domain defines business rules, adapters integrate with the outside world, and contracts define what crosses boundaries.

---

## 2. Repository Strategy

DevOS uses a TypeScript monorepo for the POC.

The monorepo contains:

- separately deployable applications;
- reusable domain/application packages;
- shared contracts;
- provider adapters;
- infrastructure;
- cross-cutting test suites.

The repository is intentionally modular but does not require microservices.

Principles:

1. One repository and one dependency graph.
2. Apps are deployable units.
3. Packages contain reusable capabilities and contracts.
4. Provider SDKs stay inside adapter packages.
5. Domain packages remain infrastructure-independent.
6. Shared contracts are versioned within the repository.
7. Tests are colocated with implementation where useful and also have cross-cutting suites.

---

## 3. Recommended Repository

```text
devos/
├── apps/
│   ├── api/
│   ├── web/
│   └── worker/
├── packages/
│   ├── domain/
│   ├── application/
│   ├── workflow/
│   ├── agents/
│   ├── knowledge/
│   ├── artifacts/
│   ├── tools/
│   ├── policy/
│   ├── identity/
│   ├── integrations/
│   ├── events/
│   ├── database/
│   ├── contracts/
│   ├── observability/
│   └── config/
├── tests/
│   ├── e2e/
│   ├── security/
│   ├── contract/
│   └── fixtures/
├── infrastructure/
│   ├── docker/
│   ├── deployment/
│   └── scripts/
├── docs/
├── migrations/
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json
└── README.md
```

---

## 4. Applications vs Packages

| Area                     | Rule                                                   |
| ------------------------ | ------------------------------------------------------ |
| `apps/api`               | HTTP/API only; calls application services              |
| `apps/web`               | UI only; consumes API                                  |
| `apps/worker`            | Queue/event execution only; calls application services |
| `packages/domain`        | Business entities/rules; no infrastructure             |
| `packages/application`   | Use cases/orchestration                                |
| `packages/workflow`      | Workflow definitions/runtime                           |
| `packages/agents`        | Agent runtime/contracts                                |
| `packages/knowledge`     | Context retrieval                                      |
| `packages/artifacts`     | Artifact management                                    |
| `packages/tools`         | Tool gateway/capabilities                              |
| `packages/policy`        | Policy/authority                                       |
| `packages/identity`      | Identity abstractions                                  |
| `packages/integrations`  | Provider adapters                                      |
| `packages/events`        | Event/outbox                                           |
| `packages/database`      | Persistence/migrations                                 |
| `packages/contracts`     | Shared schemas/DTOs                                    |
| `packages/observability` | Logging/metrics/tracing                                |
| `packages/config`        | Validated configuration                                |

---

## 5. Dependency Direction

The governing dependency direction is inward:

```text
apps/api ───────────────┐
apps/worker ────────────┼──> application ──> domain
apps/web ──> contracts ──┘          │
                                    ├──> workflow
                                    ├──> agents
                                    ├──> artifacts
                                    ├──> knowledge
                                    ├──> tools
                                    └──> policy

infrastructure adapters ───────────> application/domain ports
```

Contracts must not depend on infrastructure.

The exact dependency graph may be adjusted if implementation reveals natural boundaries, but inward dependency remains the governing rule.

---

## 6. Package Dependency Rules

| Package        | May import                             | Must not import                  |
| -------------- | -------------------------------------- | -------------------------------- |
| `domain`       | Standard libraries, shared primitives  | DB, HTTP, provider SDKs, React   |
| `contracts`    | Schema libraries, primitives           | Domain implementation, providers |
| `application`  | Domain, contracts, ports               | HTTP framework internals         |
| `workflow`     | Domain, application ports, contracts   | React, provider SDKs             |
| `agents`       | Domain, contracts, provider interfaces | HTTP controllers                 |
| `tools`        | Domain, contracts, policy ports        | React                            |
| `integrations` | Contracts + adapter interfaces         | Domain business rules            |
| `database`     | Domain persistence ports, DB client    | HTTP/UI                          |
| `api`          | Application, contracts, auth           | Provider SDKs directly           |
| `worker`       | Application, events, queue adapters    | UI                               |
| `web`          | Contracts, API client, UI libraries    | Database/domain internals        |

---

## 7. Root Files

| File                  | Purpose                           |
| --------------------- | --------------------------------- |
| `README.md`           | Project overview/setup            |
| `CONTRIBUTING.md`     | Developer workflow                |
| `SECURITY.md`         | Security reporting/handling       |
| `LICENSE`             | Project licensing                 |
| `package.json`        | Workspace scripts/metadata        |
| `pnpm-workspace.yaml` | Workspace definition              |
| `turbo.json`          | Task orchestration                |
| `tsconfig.base.json`  | Shared TypeScript configuration   |
| `eslint.config.*`     | Lint rules                        |
| `prettier.config.*`   | Formatting                        |
| `vitest.config.*`     | Unit test configuration           |
| `playwright.config.*` | E2E configuration                 |
| `.env.example`        | Non-secret configuration template |
| `.gitignore`          | Ignore rules                      |

---

## 8. `apps/api`

```text
apps/api/
├── src/
│   ├── main.ts
│   ├── app.ts
│   ├── routes/
│   ├── controllers/
│   ├── middleware/
│   ├── presenters/
│   └── composition/
├── tests/
└── package.json
```

Responsibilities:

- HTTP/API handling;
- routing;
- request translation;
- response presentation;
- middleware;
- dependency composition.

`main.ts` owns process bootstrap.

`app.ts` configures the HTTP application.

Routes map HTTP paths.

Controllers translate HTTP requests into application commands.

Presenters map application results to API DTOs.

Middleware handles correlation, authentication, authorisation, and error concerns.

Composition wires concrete dependencies.

Controllers must not contain workflow logic, database queries, or provider calls.

---

## 9. `apps/worker`

```text
apps/worker/
├── src/
│   ├── main.ts
│   ├── worker.ts
│   ├── handlers/
│   ├── consumers/
│   ├── schedulers/
│   └── composition/
├── tests/
└── package.json
```

The worker handles queue/event execution.

Worker handlers must remain thin.

Business behaviour belongs in application services.

A handler acknowledges jobs only after durable state handling.

---

## 10. `apps/web`

```text
apps/web/
├── src/
│   ├── app/
│   ├── pages/
│   ├── features/
│   │   ├── projects/
│   │   ├── work-items/
│   │   ├── workflows/
│   │   ├── runs/
│   │   ├── artifacts/
│   │   ├── approvals/
│   │   └── agents/
│   ├── components/
│   ├── api/
│   ├── auth/
│   └── styles/
├── tests/
└── package.json
```

The web application is UI-only and consumes the API.

Feature folders own feature-specific UI, API hooks, and state.

Shared components should remain generic.

---

## 11. `packages/domain`

```text
packages/domain/
├── src/
│   ├── organisation/
│   ├── project/
│   ├── membership/
│   ├── work-item/
│   ├── workflow/
│   ├── agent/
│   ├── artifact/
│   ├── approval/
│   ├── policy/
│   ├── tool/
│   ├── common/
│   └── index.ts
└── package.json
```

The domain package contains:

- entities;
- value objects;
- domain errors;
- state transition rules;
- domain services;
- repository interfaces where appropriate.

The domain must remain infrastructure-independent.

---

## 12. Domain Module Structure

Example:

```text
workflow/
├── WorkflowDefinition.ts
├── WorkflowVersion.ts
├── WorkflowRun.ts
├── WorkflowTask.ts
├── WorkflowState.ts
├── WorkflowErrors.ts
├── WorkflowRules.ts
└── index.ts
```

The same conceptual structure should be applied consistently across domains.

File naming may use the team's preferred convention, but the domain concepts must remain recognisable.

---

## 13. Agent Package Structure

```text
agents/
├── requirements/
│   ├── definition.ts
│   ├── input.schema.ts
│   ├── output.schema.ts
│   └── prompt.md
├── architect/
├── planner/
├── developer/
└── reviewer/
```

Agent prompts are implementation assets.

They must be reviewed and versioned like code.

---

## 14. `packages/knowledge`

```text
packages/knowledge/
├── src/
│   ├── sources/
│   ├── retrieval/
│   ├── context/
│   ├── permissions/
│   ├── manifests/
│   └── index.ts
```

Responsibilities include:

- source adapters;
- repository retrieval;
- artifact retrieval;
- project guidance;
- permission filtering;
- context manifest generation.

---

## 15. `packages/artifacts`

```text
packages/artifacts/
├── src/
│   ├── service/
│   ├── schemas/
│   ├── storage/
│   ├── provenance/
│   ├── links/
│   └── index.ts
```

Artifact schemas must be explicit and versioned.

---

## 16. `packages/tools`

```text
packages/tools/
├── src/
│   ├── gateway/
│   ├── capabilities/
│   ├── validation/
│   ├── invocation/
│   ├── registry/
│   └── index.ts
```

The tool gateway is a security boundary.

Arbitrary provider calls must not be placed outside it.

---

## 17. `packages/policy`

```text
packages/policy/
├── src/
│   ├── rules/
│   ├── evaluator/
│   ├── authority/
│   ├── approvals/
│   └── index.ts
```

Policy evaluation must be deterministic and independent of model output.

---

## 18. `packages/integrations`

```text
packages/integrations/
├── src/
│   ├── github/
│   ├── jira/
│   ├── ci/
│   ├── deployment/
│   ├── llm/
│   └── notifications/
└── package.json
```

Only the providers required by the POC need implementations.

Interfaces should support future providers.

Provider SDKs must remain inside integration/adapter packages.

---

## 19. `packages/database`

```text
packages/database/
├── src/
│   ├── client.ts
│   ├── repositories/
│   ├── queries/
│   ├── mappers/
│   └── index.ts
├── migrations/
├── seeds/
└── package.json
```

Repositories map persistence models to domain/application objects.

The database schema remains aligned with the database specification.

Generated database types must not leak into domain modules.

---

## 20. `packages/contracts`

```text
packages/contracts/
├── src/
│   ├── api/
│   ├── agents/
│   ├── artifacts/
│   ├── tools/
│   ├── events/
│   └── common/
└── package.json
```

This package contains transport and cross-boundary schemas, not domain behaviour.

---

## 21. Schema Definition Rule

Use a schema library such as Zod, JSON Schema, or an equivalent.

Where practical, one authoritative schema should drive validation.

Schemas cover:

- API request schemas;
- API response schemas;
- agent input/output schemas;
- tool input/output schemas;
- event payload schemas;
- artifact metadata schemas.

---

## 22. `packages/events`

```text
packages/events/
├── src/
│   ├── types/
│   ├── publisher/
│   ├── outbox/
│   ├── consumers/
│   └── index.ts
```

Events are integration contracts.

Consumers must be idempotent.

---

## 23. `packages/identity`

```text
packages/identity/
├── src/
│   ├── authentication/
│   ├── authorisation/
│   ├── principals/
│   └── index.ts
```

The identity package abstracts OIDC/provider details from the application layer.

---

## 24. `packages/observability`

```text
packages/observability/
├── src/
│   ├── logging/
│   ├── metrics/
│   ├── tracing/
│   └── correlation/
└── package.json
```

Observability utilities must provide structured correlation without leaking sensitive data.

---

## 25. `packages/config`

```text
packages/config/
├── src/
│   ├── schema.ts
│   ├── load.ts
│   └── index.ts
└── package.json
```

Configuration is validated at startup.

Missing required configuration should fail fast.

Each application declares its required configuration.

Shared configuration schemas live in `packages/config`.

Production secrets come from secret management.

`.env.example` documents configuration names, not secrets.

---

## 26. Test Repository Structure

```text
tests/
├── contract/
│   ├── api/
│   ├── agents/
│   ├── tools/
│   └── events/
├── e2e/
│   ├── software-change/
│   └── fixtures/
├── security/
│   ├── tenant-isolation/
│   ├── agent-authority/
│   ├── prompt-injection/
│   └── secrets/
└── fixtures/
```

Unit tests should normally live close to their package implementation.

---

## 27. Test Naming

| Test        | Convention              |
| ----------- | ----------------------- |
| Unit        | `*.test.ts`             |
| Integration | `*.integration.test.ts` |
| Contract    | `*.contract.test.ts`    |
| Security    | `*.security.test.ts`    |
| E2E         | `*.e2e.ts`              |
| UI          | `*.spec.tsx`            |

---

## 28. Test Fixtures

Fixtures include:

- reference project;
- reference work item;
- reference repository;
- reference workflow;
- agent definitions;
- tool definitions;
- policies;
- sample artifacts;
- approval scenarios;
- failure scenarios.

Fixtures must contain synthetic/test data.

They must never contain real credentials.

---

## 29. Infrastructure Structure

```text
infrastructure/
├── docker/
│   ├── api.Dockerfile
│   ├── worker.Dockerfile
│   └── web.Dockerfile
├── deployment/
│   ├── dev/
│   ├── staging/
│   └── pilot/
└── scripts/
    ├── bootstrap.sh
    ├── migrate.sh
    └── smoke-test.sh
```

---

## 30. Naming Conventions

| Item                  | Convention                                |
| --------------------- | ----------------------------------------- |
| Packages              | `kebab-case`                              |
| Directories           | `kebab-case`                              |
| TypeScript files      | `kebab-case` or team standard; consistent |
| Classes               | `PascalCase`                              |
| Interfaces            | `PascalCase`                              |
| Functions             | `camelCase`                               |
| Constants             | `UPPER_SNAKE_CASE` where appropriate      |
| Database tables       | plural `snake_case`                       |
| Database columns      | `snake_case`                              |
| API JSON              | `camelCase`                               |
| Environment variables | `UPPER_SNAKE_CASE`                        |

---

## 31. Import Rules

1. Use package aliases rather than deep relative imports across packages.
2. Do not import another package's internal file path.
3. Expose public APIs through `index.ts`.
4. Do not bypass package boundaries for convenience.
5. Application packages may not import app-specific code.

---

## 32. Public Package API

Example:

```text
packages/workflow/src/index.ts
```

```typescript
export * from './definition/index.js';
export * from './runtime/index.js';
export * from './validation/index.js';
```

Internal implementation files remain private to the package.

---

## 33. API Route Structure

```text
routes/
├── projects.routes.ts
├── work-items.routes.ts
├── workflows.routes.ts
├── runs.routes.ts
├── artifacts.routes.ts
├── agents.routes.ts
├── approvals.routes.ts
├── tools.routes.ts
├── integrations.routes.ts
└── audit.routes.ts
```

---

## 34. Controller Pattern

Conceptual controller pattern:

```typescript
export async function startWorkflow(req, res) {
  const command = StartWorkflowSchema.parse(req.body);
  const result = await startWorkflow.execute(command);
  return res.status(202).json(toWorkflowRunResponse(result));
}
```

Controllers must not contain:

- workflow logic;
- database queries;
- provider calls.

Controllers translate transport-level requests into application-level operations.

---

## 35. Worker Handler Pattern

Conceptual handler:

```typescript
export async function handleWorkflowTask(job) {
  const command = WorkflowTaskCommandSchema.parse(job.data);
  await workflowRuntime.execute(command);
}
```

Handlers delegate to application/runtime services.

Jobs are acknowledged only after durable state handling.

---

## 36. Adapter Structure

Example:

```text
packages/integrations/src/github/
├── github.adapter.ts
├── github.client.ts
├── github.mapper.ts
├── github.schemas.ts
└── index.ts
```

Responsibilities:

- client: provider SDK/API mechanics;
- adapter: implements internal port;
- mapper: converts provider models;
- schemas: validates provider responses.

---

## 37. Database Repository Pattern

Conceptual repository:

```typescript
export interface WorkflowRunRepository {
  getById(id: WorkflowRunId): Promise<WorkflowRun | null>;
  save(run: WorkflowRun): Promise<void>;
  transition(...): Promise<void>;
}
```

Concrete PostgreSQL implementations belong under `packages/database`.

---

## 38. Git Workflow

| Branch              | Purpose                 |
| ------------------- | ----------------------- |
| `main`              | Stable integration      |
| `feature/DEVOS-xxx` | Feature work            |
| `fix/DEVOS-xxx`     | Bug fix                 |
| `chore/DEVOS-xxx`   | Engineering maintenance |

Every change should reference a backlog item where practical.

Pull requests require automated checks.

Database changes include migrations.

API changes update contracts and tests.

Workflow/agent changes update relevant fixtures and tests.

---

## 39. Pull Request Checklist

A pull request should address:

- problem and scope stated;
- tests included;
- API/database contracts updated if relevant;
- security impact considered;
- observability added;
- migration reviewed;
- documentation updated;
- backward compatibility considered;
- acceptance criteria demonstrated.

---

## 40. Commit Convention

Use conventional commits or the team's established equivalent.

Examples:

```text
feat(workflow): add durable task transitions
fix(tools): prevent duplicate PR creation
chore(db): add workflow task index
test(policy): cover release authority
```

---

## 41. Code Review Rules

Review:

- behaviour, not just formatting;
- package boundaries;
- security boundaries;
- transaction/idempotency behaviour;
- failure paths;
- tests;
- observability;
- whether new abstractions are actually needed.

---

## 42. Agent Prompt Repository

```text
packages/agents/src/prompts/
├── requirements/
│   ├── system.md
│   └── task.md
├── architect/
├── planner/
├── developer/
└── reviewer/
```

Prompt changes must be versioned and tested.

The runtime should reference a specific prompt/agent version for reproducibility.

---

## 43. Workflow Definition Repository

```text
packages/workflow/src/definitions/
├── software-change/
│   ├── v1.json
│   ├── schema.json
│   └── README.md
```

Repository definitions are seed/configuration assets.

The database remains the runtime source of truth after publication.

---

## 44. Artifact Schemas

```text
packages/artifacts/src/schemas/
├── triage-report.schema.ts
├── discovery-report.schema.ts
├── prd.schema.ts
├── technical-design.schema.ts
├── implementation-plan.schema.ts
├── test-evidence.schema.ts
├── review-evidence.schema.ts
└── release-evidence.schema.ts
```

---

## 45. Tool Capability Registry

```text
packages/tools/src/capabilities/
├── issue-read.ts
├── issue-update.ts
├── repo-read.ts
├── repo-write.ts
├── git-commit.ts
├── pull-request-create.ts
├── build-run.ts
├── test-run.ts
└── deploy.ts
```

Each capability should define:

- input schema;
- output schema;
- risk class;
- required policy.

---

## 46. Environment Separation

Local development may use containers for:

- database;
- queue;
- storage.

Development uses shared non-production providers.

Staging uses isolated test repositories.

Pilot uses dedicated project/provider credentials.

Production access is not required for the initial POC.

---

## 47. Secret Handling

The following rules apply:

1. Never commit secrets.
2. Never place secrets in workflow JSON.
3. Never place credentials in agent definitions.
4. Provider adapters receive credentials through injected interfaces.
5. Development agent workspaces must not contain unrelated credentials.

---

## 48. Dependency Management

Use:

- one package manager/workspace;
- pinned major versions;
- a lockfile;
- automated dependency vulnerability scanning.

Remove unused dependencies.

Provider SDKs remain isolated to integration packages.

---

## 49. Build Commands

The baseline commands are:

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

Exact command names may be adapted to selected tooling, but CI and local development must use the same underlying scripts.

---

## 50. Local Development

The expected local workflow is:

1. Clone repository.
2. Install dependencies.
3. Copy `.env.example` to local configuration.
4. Start local infrastructure.
5. Run database migrations.
6. Seed development data.
7. Start API/worker/web.
8. Run smoke test.
9. Create a test work item.
10. Execute the reference workflow.

---

## 51. Developer Tooling

The repository should support:

- TypeScript language server;
- ESLint;
- Prettier;
- unit test runner;
- E2E test runner;
- Git hooks where useful;
- container tooling;
- database migration tooling;
- OpenAPI/schema tooling.

---

## 52. CI Quality Gates

| Gate                     | Required                  |
| ------------------------ | ------------------------- |
| Install                  | Pass                      |
| Typecheck                | Pass                      |
| Lint                     | Pass                      |
| Unit tests               | Pass                      |
| Contract tests           | Pass                      |
| Build                    | Pass                      |
| Dependency/security scan | Pass                      |
| Integration tests        | Pass for relevant changes |
| E2E                      | Pass for workflow changes |

---

## 53. Architecture Fitness Checks

The architecture must prevent:

1. Domain package importing infrastructure.
2. API importing provider SDKs.
3. Worker bypassing application services.
4. Tools bypassing policy.
5. Agents bypassing the tool gateway.
6. Project-owned data access without project scope.
7. Mutation of published definitions.
8. Large artifacts being stored directly in database rows.

---

## 54. Developer Definition of Ready

A backlog item is ready when:

- acceptance criteria exist;
- required contract changes are identified;
- the relevant architecture boundary is known;
- dependencies are identified;
- the test approach is identified;
- security implications are considered.

---

## 55. Developer Definition of Done

A task is done when:

- code follows repository structure;
- tests pass;
- contracts are updated where required;
- migrations are included where necessary;
- observability is included;
- security checks pass;
- documentation is updated;
- the PR is reviewed and accepted;
- the feature is deployed to the target environment where deployment is applicable.

---

## 56. Sprint 1 Repository Tasks

The repository specification identifies these foundational tasks:

| Task                       | Outcome                   |
| -------------------------- | ------------------------- |
| Bootstrap monorepo         | Apps/packages build       |
| Configure workspace        | Dependency graph enforced |
| Create API app             | REST server               |
| Create worker app          | Worker process            |
| Create web app             | React shell               |
| Create config package      | Validated config          |
| Create contracts package   | Shared schemas            |
| Create database package    | DB connectivity           |
| Create domain package      | Core entities             |
| Create application package | Use-case boundary         |
| Create CI pipeline         | Automated quality gates   |

---

## 57. First Architecture Fitness Test

The team should deliberately attempt to violate the architecture in CI.

For example, CI should reject an API package importing a Git provider SDK directly.

This establishes architecture enforcement early and helps prevent architectural drift.

---

## 58. POC Repository Acceptance Criteria

The repository is acceptable when:

- it builds from a clean checkout;
- all applications start independently;
- package boundaries are explicit;
- the domain has no infrastructure dependency;
- provider SDKs are isolated;
- database migrations are version-controlled;
- contracts are shared and tested;
- the reference workflow definition is versioned;
- agent prompts are versioned;
- CI enforces typecheck/lint/test/build;
- security-sensitive files are excluded from source control.

---

## 59. What Not to Add Yet

The POC should not introduce:

- microservice directories;
- Kafka-specific infrastructure;
- multiple databases;
- vector database;
- agent marketplace;
- plugin marketplace;
- complex event-sourcing framework;
- generated code everywhere;
- premature generic abstractions;
- a large shared utility package.

---

## 60. Future Repository Evolution

Future evolution may introduce service extraction when justified:

```text
devos/
├── apps/
│   ├── api/
│   ├── web/
│   └── worker/
├── services/
│   ├── workflow/
│   ├── agents/
│   └── tools/
├── packages/
│   ├── contracts/
│   ├── domain/
│   └── sdk/
├── infrastructure/
└── docs/
```

Service extraction is a later optimisation, not a POC requirement.

---

## 61. Technical Ownership

| Area                    | Owner                |
| ----------------------- | -------------------- |
| Repository architecture | Tech Lead            |
| Domain                  | Backend              |
| Workflow runtime        | Backend/Platform     |
| Agent runtime           | AI/Agent             |
| Tools/integrations      | Backend/Platform     |
| UI                      | Frontend             |
| Security                | Tech Lead + Security |
| CI/CD                   | Platform/DevOps      |
| Tests                   | QA + Engineering     |

---

## 62. Final Recommendation

The repository structure should be established before feature implementation begins.

The objective is not to create a perfect enterprise monorepo.

The objective is to establish boundaries that make the DevOS POC easy to extend without creating architectural debt in the first few sprints.

The most important structural rule remains:

> Applications orchestrate, packages encapsulate, domain defines business rules, adapters integrate with the outside world, and contracts define what crosses boundaries.

With this structure established, the next step is to turn Sprint 1 into concrete developer tasks with implementation instructions, dependencies, acceptance criteria, and test cases.

---

## 63. Relationship to the DevOS Conceptual Architecture

This repository specification operationalises the boundaries established by the conceptual architecture.

The conceptual architecture defines logical responsibilities such as:

- workflow and orchestration;
- agent runtime;
- context and knowledge;
- tool/integration gateway;
- artifact management;
- persistence;
- validation;
- governance;
- observability.

The repository structure provides implementation boundaries for those responsibilities.

---

## 64. Relationship to the DevOS Domain Model

The repository structure must preserve the domain model.

Domain entities and rules remain infrastructure-independent.

Persistence, provider integrations, HTTP, UI, and external systems must not become embedded in domain logic.

The repository therefore supports the principle that domain rules remain inside the domain boundary.

---

## 65. Relationship to Sprint 1

Sprint 1 is the first implementation target.

The repository structure is deliberately designed to support the Sprint 1 vertical slice while leaving seams for later capabilities.

The Sprint 1 architecture uses:

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

The architecture must already contain the boundaries required to replace the deterministic task with a real agent in a later sprint.

---

## 66. Architectural Constraints for Implementation

Implementation must not:

- introduce microservices prematurely;
- bypass package boundaries;
- place provider SDKs in domain/application code;
- allow agents to bypass the tool gateway;
- allow tools to bypass policy;
- allow API controllers to contain business logic;
- allow worker handlers to contain business logic;
- allow database types to leak into domain modules;
- store secrets in source-controlled configuration;
- mutate published workflow definitions.

---

## 67. Step 4 Acceptance Criteria

This Step 4 repository specification work is complete for this document when:

- [ ] Repository structure is explicitly defined.
- [ ] Applications and packages are separated.
- [ ] Dependency direction is defined.
- [ ] Package boundaries are defined.
- [ ] Naming conventions are defined.
- [ ] Test structure is defined.
- [ ] Infrastructure structure is defined.
- [ ] API/controller boundaries are defined.
- [ ] Worker boundaries are defined.
- [ ] Integration adapter boundaries are defined.
- [ ] Configuration and secret handling are defined.
- [ ] CI quality gates are defined.
- [ ] Architecture fitness checks are defined.
- [ ] Developer Ready/Done rules are defined.
- [ ] Sprint 1 repository tasks are identified.
- [ ] POC acceptance criteria are defined.
- [ ] Premature repository complexity is explicitly excluded.
- [ ] Future evolution is addressed.
- [ ] The specification remains aligned with the conceptual architecture and domain model.

---

## 68. Source and Authority

This Markdown specification is the Git-ready representation of:

**DevOS POC Repository & Code Structure Specification v1.0 — Implementation Repository Baseline.**

It has been converted for use by the DevOS development agent and repository workflow.

It does not intentionally introduce architectural decisions beyond the authoritative source specification.
