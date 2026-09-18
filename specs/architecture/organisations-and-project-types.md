# Organisations & Project Types — Technical Specification

**Document:** Organisations & Project Types Technical Specification
**Product:** DevOS
**Status:** Draft for review — no implementation has started
**Repository:** `C:\Development\devos`
**Branch:** `poc`

---

## 1. Purpose

This specification defines the technical design for four related additions to DevOS:

1. **Organisation management** — Organisations become a manageable entity (create/list/update), not just an implicit foreign key.
2. **Project Types** — a Project has exactly one Project Type (initially only "Software Development"), and the platform supports adding new types later.
3. **Project Type → Workflow association** — each Project Type owns a template workflow (or set of named template workflows) that is cloned into every new Project of that type.
4. **Frontend CRUD** — web UI to manage Organisations, Projects, Project Types, the workflow(s) associated with a Project Type, and which agent handles each step of that workflow.

This document covers the technical design only. No code has been written against it. Section 12 lists open questions and assumptions that should be confirmed or corrected before implementation begins.

---

## 2. Current State (grounding — confirmed by reading the code, not assumed)

This section exists so the proposal below is legible against what's actually there today, not an imagined baseline.

| Concept                           | Current reality                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Organisation**                  | A real table (`organisations`, migration `0001`) and a real domain type (`packages/domain/src/organisations/organisation.ts`) exist. The repository implements only `getById`. There is **no** create/list/update, and **no API route** — `apps/api/src/routes/projects.ts` hardcodes every created project to the one seeded `SEED_ORGANISATION_ID`. There is no way to create or select an organisation today.                                                                                                                                                                                                                                                               |
| **Project**                       | `{ id, organisationId, name, slug, description?, status, budgetUsd?, createdAt, updatedAt }` — **no `type`/`kind` field exists**. Full CRUD exists (minus delete) at `POST/GET/PATCH /projects`, plus membership routes.                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **WorkflowDefinition**            | `{ id, projectId, key, name, description?, createdAt, updatedAt }` — **owned by exactly one project**; `key` is unique _per project_, not globally. There is no template or cross-project sharing mechanism today.                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **WorkflowVersion**               | `{ id, workflowDefinitionId, version, status, definition (the graph), publishedAt?, createdBy, createdAt }`. Full draft → validate → publish lifecycle exists via `apps/api/src/routes/workflows.ts`, but **the web app has zero client functions or UI for it** — `api-client.ts` has no `createWorkflow`/`validateDraftWorkflow`/`publishWorkflowVersion`.                                                                                                                                                                                                                                                                                                                   |
| **Agent / AgentVersion**          | Also **owned by exactly one project** (`Agent.projectId`, `key` unique per project). Real create/publish API exists (`apps/api/src/routes/agents.ts`), but **zero web UI or client functions exist for it either**.                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **`agentRef` runtime resolution** | This is the most important gap. A workflow node's `agentRef` is a bare string. Today, `apps/worker/src/agent-task-router.ts` does **not** look it up against the `agents`/`agent_versions` tables at all — it's a hardcoded `switch` over 6 literal seed-key constants (`SEED_DISCOVERY_AGENT_KEY`, etc.), each dispatching to its own bespoke handler function. Any `agentRef` outside those 6 exact strings throws at run time. **This means the moment a second project exists with its own cloned/created agents, none of their tasks would actually execute** — this has to be fixed as part of this work, not as a follow-up, or the rest of this feature is UI theatre. |
| **Membership / RBAC**             | `Membership.projectId` is already **nullable** — `resolveMembership()` already falls back to an organisation-level membership (`projectId: null`) when no project-level one exists. This is unused today (every membership created by the product is project-scoped) but is exactly the mechanism to reuse for organisation ownership — no new membership table needed. Only two roles exist anywhere (`OWNER`, `MEMBER`); every consequential-action gate collapses to `role === 'OWNER'`.                                                                                                                                                                                    |
| **Seed data**                     | One organisation, one project ("DevOS POC"), **4 separate workflow definitions** (`intake-to-artifact`, `planning-path`, `development-path`, `release-path` — chained by convention through a shared work item, each with its own human-approval gate or rework loop), and 6 agents (discovery/requirements/technical-design/planning/development/review), all hardcoded to the one seeded project.                                                                                                                                                                                                                                                                            |
| **Web app CRUD pattern**          | `ProjectsPage.tsx` is the established pattern to follow: MUI `List`/`ListItemButton` for selection + a local-state `<form>` calling an `api-client.ts` function, then `refresh()`. `ProjectProvider`/`useProjectContext` (`apps/web/src/project-context.tsx`) is the pattern for a "currently selected X" context.                                                                                                                                                                                                                                                                                                                                                             |

---

## 3. Scope Decision — Workflow Ownership Model

Confirmed with the user before drafting this document: **template & clone**, not a live shared workflow.

- Each Project Type owns one or more **workflow templates** (a serialized graph, not a live `WorkflowDefinition` row).
- Creating a Project of that type **clones** each template into a real, independent `WorkflowDefinition` + initial `WorkflowVersion` owned by that new project.
- After creation, a project's cloned workflow is its own — editable independently through the existing draft/validate/publish flow, with zero further coupling to the template it was cloned from.
- Editing a Project Type's template later does **not** retroactively change any already-created project's workflow.

This was chosen specifically because it requires no change to `WorkflowDefinition.projectId`'s current required, single-owner semantics — the entire existing draft/validate/publish/run pipeline is reused completely unchanged for every project, template or not.

### 3.1 Single workflow vs. the existing 4-workflow chain — flagged, not silently resolved

The request describes "a specific workflow" (singular) and "a Workflow has one or more runs" (also singular). Read literally, this could mean the Software Development lifecycle should be consolidated into one `WorkflowDefinition`. The current implementation instead splits it into 4 separate definitions (`intake-to-artifact`, `planning-path`, `development-path`, `release-path`), chained by convention via a shared work item — deliberately, so that:

- planning has its own human approval gate before development begins (ADR-SCW-002),
- development has its own independent rework loop,
- release has its own independent approval gate.

Collapsing these into one `WorkflowDefinition` would fight that existing gate/rework design (a single long-running workflow run spanning a human approval that might take days doesn't fit this engine's run-to-completion model as cleanly as separate runs chained by work item).

**This spec therefore models a Project Type as owning a _set_ of named workflow templates** (§5.3), defaulting to the same 4 for "Software Development," rather than forcing a single template. If a literal single consolidated workflow is what was actually intended, that is a separate, larger piece of work (redesigning the gate/rework mechanics around one long-running run) — flag it in review and it will be scoped on its own, not folded into this change silently.

---

## 4. Proposed Domain Model

```text
Organisation 1───* Project
Organisation 1───* Membership (org-level, projectId = null — already supported)

ProjectType 1───* ProjectTypeWorkflow   (named workflow templates, e.g. "planning-path")
ProjectType 1───* ProjectTypeAgent      (named agent templates, e.g. "discovery-agent")
ProjectType 1───* Project               (every project of this type)

Project *───1 ProjectType

# On project creation, cloned 1:1 from the type's templates:
ProjectTypeWorkflow ──clone──> WorkflowDefinition (owned by the new Project)
ProjectTypeAgent    ──clone──> Agent               (owned by the new Project)

# Unchanged from today:
WorkflowDefinition 1───* WorkflowVersion
WorkflowVersion 1───* WorkflowRun
WorkflowNode.agentRef (string) ──resolves by key──> Agent (within the same project)
```

### 4.1 New domain types

```ts
// packages/domain/src/project-types/project-type.ts
export interface ProjectType {
  id: ProjectTypeId;
  key: string; // e.g. 'software-development' — globally unique
  name: string; // e.g. 'Software Development'
  description?: string;
  status: 'ACTIVE' | 'DISABLED';
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectTypeInput {
  key: string;
  name: string;
  description?: string;
}
export interface UpdateProjectTypeInput {
  name?: string;
  description?: string;
  status?: 'ACTIVE' | 'DISABLED';
}

export interface ProjectTypeRepository {
  getById: (id: ProjectTypeId) => Promise<ProjectType | null>;
  getByKey: (key: string) => Promise<ProjectType | null>;
  list: () => Promise<ProjectType[]>;
  create: (projectType: ProjectType) => Promise<void>;
  update: (id: ProjectTypeId, changes: UpdateProjectTypeInput, updatedAt: string) => Promise<void>;
}
```

```ts
// packages/domain/src/project-types/project-type-workflow.ts
// The template — same shape as WorkflowVersion.definition (WorkflowGraph),
// reusing packages/domain/src/workflows/validation.ts's validateWorkflowGraph
// unchanged for save-time validation.
export interface ProjectTypeWorkflow {
  id: ProjectTypeWorkflowId;
  projectTypeId: ProjectTypeId;
  key: string; // unique per project type, e.g. 'planning-path'
  name: string;
  definition: WorkflowGraph; // the exact same shape cloned onto WorkflowVersion.definition
  createdAt: string;
  updatedAt: string;
}

export interface ProjectTypeWorkflowRepository {
  getById;
  listForProjectType(projectTypeId);
  create;
  update;
}
```

```ts
// packages/domain/src/project-types/project-type-agent.ts
// One template per agent "role" the type's workflows reference by key.
export interface ProjectTypeAgent {
  id: ProjectTypeAgentId;
  projectTypeId: ProjectTypeId;
  key: string; // unique per project type, e.g. 'discovery-agent'
  name: string;
  configuration: AgentConfiguration; // reuses the existing AgentVersion.configuration shape
  promptReference?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectTypeAgentRepository {
  getById;
  listForProjectType(projectTypeId);
  create;
  update;
}
```

### 4.2 Changed domain types

```ts
// packages/domain/src/projects/project.ts
export interface Project {
  id: ProjectId;
  organisationId: OrganisationId;
  projectTypeId: ProjectTypeId; // NEW — required going forward
  name: string;
  slug: string;
  description?: string;
  status: string;
  budgetUsd?: number;
  createdAt: string;
  updatedAt: string;
}
export interface CreateProjectInput {
  organisationId: OrganisationId;
  projectTypeId: ProjectTypeId; // NEW — required
  name: string;
  slug: string;
  description?: string;
}
```

```ts
// packages/domain/src/organisations/organisation.ts — repository extended, type unchanged
export interface OrganisationRepository {
  getById: (id: OrganisationId) => Promise<Organisation | null>;
  list: () => Promise<Organisation[]>; // NEW
  create: (organisation: Organisation) => Promise<void>; // NEW
  update: (
    id: OrganisationId,
    changes: UpdateOrganisationInput,
    updatedAt: string,
  ) => Promise<void>; // NEW
}
export interface CreateOrganisationInput {
  name: string;
  slug: string;
} // NEW
export interface UpdateOrganisationInput {
  name?: string;
  status?: string;
} // NEW
```

---

## 5. Database Schema Changes

New migrations, following the exact style already established (`Kysely<any>`, explicit unique constraints + indexes, a doc comment citing this spec where a field isn't in `specs/database/poc-database-schema.md`'s documented schema — every table in this section is new, so all of it is a flagged addition against that spec).

### 5.1 `project_types`

```sql
CREATE TABLE project_types (
  id uuid PRIMARY KEY,
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);
```

### 5.2 `project_type_workflows`

```sql
CREATE TABLE project_type_workflows (
  id uuid PRIMARY KEY,
  project_type_id uuid NOT NULL REFERENCES project_types(id),
  key text NOT NULL,
  name text NOT NULL,
  definition jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  UNIQUE (project_type_id, key)
);
CREATE INDEX ON project_type_workflows (project_type_id);
```

### 5.3 `project_type_agents`

```sql
CREATE TABLE project_type_agents (
  id uuid PRIMARY KEY,
  project_type_id uuid NOT NULL REFERENCES project_types(id),
  key text NOT NULL,
  name text NOT NULL,
  configuration jsonb NOT NULL,
  prompt_reference text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  UNIQUE (project_type_id, key)
);
CREATE INDEX ON project_type_agents (project_type_id);
```

### 5.4 `projects.project_type_id` — added in two steps against real existing data

Real rows already exist (the seeded project, plus every project created during this whole session's own testing — the shared dev database currently holds 250+ real project rows). Adding a `NOT NULL` foreign key in one step would break on the very first migration run. Two sequential migrations, matching this repo's own established `onConflict`/backfill discipline:

```sql
-- Migration A: add nullable, backfill, do not constrain yet
ALTER TABLE projects ADD COLUMN project_type_id uuid REFERENCES project_types(id);
-- backfill: every existing project → the seeded 'software-development' project type (see §7)
UPDATE projects SET project_type_id = '<seeded software-development project_type id>' WHERE project_type_id IS NULL;

-- Migration B (separate, run only once the backfill above is confirmed complete): tighten
ALTER TABLE projects ALTER COLUMN project_type_id SET NOT NULL;
```

---

## 6. Backend Prerequisite — Generalizing `agentRef` Resolution

This is not optional polish; it's load-bearing. Today's hardcoded 6-way `switch` in `apps/worker/src/agent-task-router.ts` only ever matches the one seeded project's literal agent keys. The moment a new project exists with its own cloned agents (different generated/templated keys), every one of its `AGENT_TASK` nodes would fail with `No planning-path agent handler registered for agentRef "..."`.

**Fix**: resolve by the agent's **role** (`AgentVersion.configuration.role` — already present on every agent today: `DISCOVERY`/`REQUIREMENTS`/`TECHNICAL_DESIGN`/`PLANNING`/`DEVELOPMENT`/`REVIEW`), not by literal key string:

1. `agentRef` still names an `Agent.key` within the project (unchanged — this is how a workflow node picks _which_ agent instance handles it, and stays fully backward compatible with every existing seeded workflow).
2. The router resolves `agents.getByProjectAndKey(projectId, agentRef)` → its published `AgentVersion` → reads `configuration.role` → dispatches to the one of the 6 existing role-specific handler functions (`runDiscoveryAgentTask`, `runRequirementsAgentTask`, etc. — these stay exactly as they are; only the dispatch key changes from a literal string match to a role lookup).
3. An `agentRef` that resolves to an agent whose role isn't one of the 6 known roles fails clearly (same as today's "no handler" error, just for a different reason) — this codebase's agent behaviors are role-specific (each role publishes a specific artifact type and reads specific prior-stage context), so "any agent for any step" was never a coherent goal; "any _role-matching_ agent for that step" is.

This is real, scoped, testable work: a project created from a Project Type template, with its own cloned agents, must be proven — via a real end-to-end run, not just a unit test — to actually execute through this generalized router. This closes gap **G1** already flagged in `DEVOS-PRODUCTION-READINESS-ROADMAP.md`.

---

## 7. Migration & Backfill Plan (existing data)

1. Run migrations for `project_types`, `project_type_workflows`, `project_type_agents`, and `projects.project_type_id` (nullable step).
2. Seed exactly one `ProjectType` row: `key: 'software-development'`, `name: 'Software Development'`.
3. Seed 4 `ProjectTypeWorkflow` rows under it, **populated from the current 4 seeded workflow definitions' own graphs verbatim** (`intake-to-artifact`, `planning-path`, `development-path` v2, `release-path` v2) — this "promotes" today's ad-hoc seed data into the new template system rather than inventing new content.
4. Seed 6 `ProjectTypeAgent` rows under it, populated from the current 6 seeded agents' own configurations verbatim.
5. Backfill: set `projects.project_type_id` to this new type's id for every existing project row (the seeded project and every real leftover test project in the shared dev database).
6. Run the second migration to tighten `project_type_id` to `NOT NULL`.
7. **No change to the seeded project's own existing `WorkflowDefinition`/`Agent` rows** — they already exist and keep running exactly as they do today. Only _new_ projects go through the clone pipeline (§8). This is why the real `tests/e2e` suite (`full-workflow.test.ts` et al., which all target `SEED_PROJECT_ID`'s existing workflows/agents directly) needs zero changes.

---

## 8. Project Creation — Clone Pipeline

Extends `packages/application/src/projects/create-project.ts`:

1. Validate `projectTypeId` refers to an `ACTIVE` `ProjectType` (new check — a `DISABLED` type cannot be used for new projects).
2. Create the `Project` row (now carrying `projectTypeId`) — unchanged otherwise.
3. Create the OWNER membership for the creating principal — unchanged.
4. **New**: for every `ProjectTypeWorkflow` under the type, create a `WorkflowDefinition` (same `key`/`name`, `projectId` = the new project) + an initial `WorkflowVersion` (`version: 1`), its `definition` cloned verbatim from the template. Published immediately (`status: 'PUBLISHED'`, `publishedAt: now`) — matching how every seeded workflow today is already usable immediately, and consistent with a new project needing to actually run something right away, not sit in an empty draft state.
5. **New**: for every `ProjectTypeAgent` under the type, create an `Agent` (same `key`/`name`, `projectId` = the new project) + an initial, immediately-`PUBLISHED` `AgentVersion` (`configuration`/`promptReference` cloned verbatim).
6. Because step 4 clones the graph verbatim (including its `agentRef` strings) and step 5 creates agents under the _same_ keys those `agentRef` strings already name, no rewriting is needed — the cloned workflow's `agentRef`s resolve correctly against the cloned agents purely because the keys already match, exactly like the existing single-project seed data does today.

All of steps 4–6 happen inside the same transaction as project creation (matching this codebase's existing transactional-creation discipline, e.g. `createWorkflowDraftCreator`) — a project is never left half-cloned.

---

## 9. API Changes

New route files, following the existing `createXRoutes(prefix, deps)` pattern:

**`apps/api/src/routes/organisations.ts`** (new)

- `GET {prefix}/organisations` — list (every organisation the principal has any membership in, direct or via a project)
- `POST {prefix}/organisations` — create; creator becomes OWNER via a `projectId: null` membership (§2)
- `GET {prefix}/organisations/:organisationId`
- `PATCH {prefix}/organisations/:organisationId`

**`apps/api/src/routes/project-types.ts`** (new)

- `GET {prefix}/project-types` — list all (global, not organisation-scoped — see §12.1)
- `POST {prefix}/project-types`
- `GET {prefix}/project-types/:projectTypeId`
- `PATCH {prefix}/project-types/:projectTypeId`
- `GET {prefix}/project-types/:projectTypeId/workflows` — list its workflow templates
- `POST {prefix}/project-types/:projectTypeId/workflows` — create a template (body validated via the existing `validateWorkflowGraph`)
- `PATCH {prefix}/project-types/:projectTypeId/workflows/:workflowKey` — edit a template's graph
- `GET {prefix}/project-types/:projectTypeId/agents` — list its agent templates
- `POST {prefix}/project-types/:projectTypeId/agents` — create a template
- `PATCH {prefix}/project-types/:projectTypeId/agents/:agentKey` — edit a template

**`apps/api/src/routes/projects.ts`** (extended)

- `POST {prefix}/projects` — body gains required `projectTypeId`
- `toProjectDto` — response gains `projectTypeId`

---

## 10. Web UI Changes

### 10.1 New pages (`apps/web/src/pages/`)

- **`OrganisationsPage.tsx`** — mirrors `ProjectsPage.tsx` exactly: `List`/`ListItemButton` selection + create form (name, slug).
- **`ProjectTypesPage.tsx`** — list/create Project Types (key, name, description). Selecting one opens its two editors below.
- **`ProjectTypeWorkflowsEditor`** (component, embedded in `ProjectTypesPage`) — for the selected type: a list of its named workflow templates; selecting one shows a **structured form editor**, not a visual graph canvas (see §12.2 for why): a `Table` of nodes (id, type, name, agentRef — the last as a `Select` populated from that same type's `ProjectTypeAgent` list, §10.2) and a `Table` of edges (from/to), with an explicit "Validate" action that calls the same `validateWorkflowGraph` logic server-side before save.
- **`ProjectTypeAgentsEditor`** (component, embedded in `ProjectTypesPage`) — CRUD table for the type's agent templates (key, name, role, provider, model reference, prompt reference).

### 10.2 Changed pages

- **`ProjectsPage.tsx`** — create form gains a required Project Type `Select` (populated from `listProjectTypes()`).
- **`App.tsx`** — gains an `OrganisationProvider`/`useOrganisationContext` (new context file, mirrors `project-context.tsx` exactly) and an organisation `Select` in the `AppBar`, above/alongside the existing project selector; `ProjectProvider`'s `listProjects()` call becomes organisation-scoped.

### 10.3 `api-client.ts` additions

```ts
listOrganisations(): Promise<ApiResult<Organisation[]>>
createOrganisation(input: {name, slug}): Promise<ApiResult<Organisation>>
getOrganisation(id): Promise<ApiResult<Organisation>>
updateOrganisation(id, changes): Promise<ApiResult<Organisation>>

listProjectTypes(): Promise<ApiResult<ProjectType[]>>
createProjectType(input: {key, name, description?}): Promise<ApiResult<ProjectType>>
updateProjectType(id, changes): Promise<ApiResult<ProjectType>>

listProjectTypeWorkflows(projectTypeId): Promise<ApiResult<ProjectTypeWorkflow[]>>
createProjectTypeWorkflow(projectTypeId, input): Promise<ApiResult<ProjectTypeWorkflow>>
updateProjectTypeWorkflow(projectTypeId, key, input): Promise<ApiResult<ProjectTypeWorkflow>>

listProjectTypeAgents(projectTypeId): Promise<ApiResult<ProjectTypeAgent[]>>
createProjectTypeAgent(projectTypeId, input): Promise<ApiResult<ProjectTypeAgent>>
updateProjectTypeAgent(projectTypeId, key, input): Promise<ApiResult<ProjectTypeAgent>>

// createProject(...) gains a required projectTypeId parameter
```

---

## 11. Authorization

| Action                                                                    | Proposed gate                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create an Organisation                                                    | Any authenticated principal (matches today's ungated project creation) — becomes OWNER via a new `projectId: null` membership.                                                                                                  |
| Update an Organisation                                                    | OWNER of that organisation (an org-level membership, or — for backward compatibility with today's single-org reality — an OWNER of any project within it, since no organisation currently has an explicit org-level OWNER yet). |
| Create/update a Project Type, its workflow templates, its agent templates | Any authenticated principal — see §12.1, this is flagged as accepted risk consistent with this POC's existing security posture, not a new gap.                                                                                  |
| Create a Project                                                          | Unchanged (any authenticated principal, organisation membership implied), plus: the target `ProjectType` must be `ACTIVE`.                                                                                                      |

---

## 12. Open Questions & Flagged Assumptions

These are genuine calls made to produce a concrete, buildable spec rather than leaving gaps — correct any of them in review and the affected sections above get revised before implementation starts.

1. **Project Types are modeled as global (system-wide), not organisation-scoped.** The request didn't say whether each organisation should define its own types or share one platform-wide list. Global was chosen because the request framed this as general extensibility ("the ability to add different project types"), not per-organisation customization, and because it's the simpler model to start from — adding an `organisationId` scope later is a small, additive change (one nullable column + a query filter) if it turns out to be wanted.
2. **The Project Type workflow/agent editors are form-based, not a visual graph canvas.** Building a drag-and-drop node/edge canvas is a substantial, separate UI effort (this app currently has _zero_ workflow-authoring UI of any kind to build on) — a structured table-based form editor (nodes table + edges table) is proposed as the real, shippable MVP; a visual canvas is a natural, larger follow-up if the form editor proves too limiting in practice.
3. **§3.1** — modeling a Project Type as owning a _set_ of named workflow templates (defaulting to today's existing 4), rather than literally one workflow, because collapsing the existing 4-workflow chain into one would fight the deliberate human-approval-gate and rework-loop design already in place. Flag in review if a literal single consolidated workflow was actually intended — that's separable, larger work.
4. **Cloned workflows/agents publish immediately** on project creation rather than starting as an editable draft, matching how every seeded workflow/agent is already immediately usable today. If new projects should instead start with an editable draft requiring an explicit first publish, §8 step 4/5 change from `PUBLISHED` to `DRAFT`.
5. **No delete** is proposed for Organisation, Project Type, or their templates in this pass — matches the existing product's own pattern (Projects also have no delete route today). Disabling (`status: 'DISABLED'`) is the only lifecycle-ending action modeled, consistent with `ToolCapabilityStatus`/`IntegrationStatus`'s existing two-state precedent elsewhere in this codebase.

---

## 13. Suggested Phasing

Mirrors this repo's own established sequential-sprint delivery model (not a commitment to call this "Sprint 9" — that's the user's call, per `AGENTS.md` §20's roadmap-change-control):

1. **Organisation CRUD** — repository, use-cases, RBAC, routes, `OrganisationsPage.tsx` + `OrganisationProvider`. Fully shippable and useful on its own.
2. **Project Type data model** — new tables/domain/repos/routes for `ProjectType`/`ProjectTypeWorkflow`/`ProjectTypeAgent`; `projects.project_type_id` migration + backfill (§5.4, §7). No editing UI yet — seed-only.
3. **Clone pipeline** (§8) — extend `create-project.ts`; live-verified by actually creating a second project and confirming its cloned workflow/agents exist and are correctly keyed.
4. **Router generalization** (§6) — the G1 fix; live-verified by running a real workflow to completion on the _new_ project created in phase 3, proving its cloned agents actually execute, not just exist.
5. **Frontend CRUD** (§10) — `ProjectTypesPage.tsx` and its two embedded editors, `ProjectsPage.tsx`'s new type selector, the organisation selector in `App.tsx`.

Phases 1–4 are independently testable backend milestones; phase 5 is the frontend layer the user asked for, sequenced last because it depends on every API surface below it existing and working for real.
