export { SOFTWARE_DEVELOPMENT_PROJECT_TYPE_ID as SEED_SOFTWARE_DEVELOPMENT_PROJECT_TYPE_ID } from '@devos/domain';

export const SEED_ORGANISATION_ID = '00000000-0000-4000-8000-000000000001';
export const SEED_PROJECT_ID = '00000000-0000-4000-8000-000000000002';
export const SEED_MEMBERSHIP_ID = '00000000-0000-4000-8000-000000000003';
export const SEED_PRINCIPAL_ID = 'seed-user';

export const SEED_WORKFLOW_DEFINITION_ID = '00000000-0000-4000-8000-000000000004';
export const SEED_WORKFLOW_VERSION_ID = '00000000-0000-4000-8000-000000000005';
export const SEED_WORKFLOW_KEY = 'intake-to-artifact';
export const SEED_WORKFLOW_DISCOVERY_NODE_ID = 'discovery';

export const SEED_WORKFLOW_GRAPH = {
  name: 'Intake to Artifact',
  description: 'Minimal Sprint 1 vertical slice: a single deterministic discovery task.',
  trigger: { type: 'WORK_ITEM_MANUAL' },
  inputs: [{ name: 'workItemId', type: 'WORK_ITEM', required: true }],
  nodes: [{ id: SEED_WORKFLOW_DISCOVERY_NODE_ID, type: 'TASK', name: 'Discovery' }],
  edges: [],
  policies: [],
  outputs: [],
};

export const SEED_DISCOVERY_AGENT_ID = '00000000-0000-4000-8000-000000000006';
export const SEED_DISCOVERY_AGENT_VERSION_ID = '00000000-0000-4000-8000-000000000007';
export const SEED_DISCOVERY_AGENT_KEY = 'discovery-agent';

/**
 * modelRef is the Gemini model confirmed working during DEVOS-027/028's live
 * verification. Google's free-tier models are occasionally deprecated
 * (DEVOS-027 hit exactly this with gemini-2.0-flash) — if discovery-agent
 * calls start failing with a 404, this is the first place to check.
 */
export const SEED_DISCOVERY_AGENT_CONFIGURATION = {
  role: 'DISCOVERY',
  provider: 'gemini',
  modelRef: 'gemini-3.6-flash',
  outputSchemaRef: 'discovery-report-v1',
  allowedCapabilities: [],
};
export const SEED_DISCOVERY_AGENT_PROMPT_REFERENCE = 'discovery/v1';

export const SEED_REQUIREMENTS_AGENT_ID = '00000000-0000-4000-8000-000000000008';
export const SEED_REQUIREMENTS_AGENT_VERSION_ID = '00000000-0000-4000-8000-000000000009';
export const SEED_REQUIREMENTS_AGENT_KEY = 'requirements-agent';
export const SEED_REQUIREMENTS_AGENT_CONFIGURATION = {
  role: 'REQUIREMENTS',
  provider: 'gemini',
  modelRef: 'gemini-3.6-flash',
  outputSchemaRef: 'prd-v1',
  allowedCapabilities: [],
};
export const SEED_REQUIREMENTS_AGENT_PROMPT_REFERENCE = 'requirements/v1';

export const SEED_TECHNICAL_DESIGN_AGENT_ID = '00000000-0000-4000-8000-00000000000a';
export const SEED_TECHNICAL_DESIGN_AGENT_VERSION_ID = '00000000-0000-4000-8000-00000000000b';
export const SEED_TECHNICAL_DESIGN_AGENT_KEY = 'technical-design-agent';
export const SEED_TECHNICAL_DESIGN_AGENT_CONFIGURATION = {
  role: 'TECHNICAL_DESIGN',
  provider: 'gemini',
  modelRef: 'gemini-3.6-flash',
  outputSchemaRef: 'technical-design-v1',
  allowedCapabilities: [],
};
export const SEED_TECHNICAL_DESIGN_AGENT_PROMPT_REFERENCE = 'technical-design/v1';

export const SEED_PLANNING_AGENT_ID = '00000000-0000-4000-8000-00000000000c';
export const SEED_PLANNING_AGENT_VERSION_ID = '00000000-0000-4000-8000-00000000000d';
export const SEED_PLANNING_AGENT_KEY = 'planning-agent';
export const SEED_PLANNING_AGENT_CONFIGURATION = {
  role: 'PLANNING',
  provider: 'gemini',
  modelRef: 'gemini-3.6-flash',
  outputSchemaRef: 'implementation-plan-v1',
  allowedCapabilities: [],
};
export const SEED_PLANNING_AGENT_PROMPT_REFERENCE = 'planning/v1';

export const SEED_DEVELOPMENT_AGENT_ID = '00000000-0000-4000-8000-000000000014';
export const SEED_DEVELOPMENT_AGENT_VERSION_ID = '00000000-0000-4000-8000-000000000015';
export const SEED_DEVELOPMENT_AGENT_KEY = 'development-agent';
export const SEED_DEVELOPMENT_AGENT_CONFIGURATION = {
  role: 'DEVELOPMENT',
  provider: 'gemini',
  modelRef: 'gemini-3.6-flash',
  outputSchemaRef: 'proposed-change-v1',
  // DEVOS-085: the only three capabilities `runDevelopmentAgentTask` ever
  // invokes on this agent version's behalf (repo-write, git-commit,
  // pull-request-create) — now enforced by the Tool Gateway, so this list
  // must actually match reality rather than being vestigial.
  allowedCapabilities: ['repo-write', 'git-commit', 'pull-request-create'],
};
export const SEED_DEVELOPMENT_AGENT_PROMPT_REFERENCE = 'developer/v1';

export const SEED_REVIEW_AGENT_ID = '00000000-0000-4000-8000-00000000001b';
export const SEED_REVIEW_AGENT_VERSION_ID = '00000000-0000-4000-8000-00000000001c';
export const SEED_REVIEW_AGENT_KEY = 'review-agent';
export const SEED_REVIEW_AGENT_CONFIGURATION = {
  role: 'REVIEW',
  provider: 'gemini',
  modelRef: 'gemini-3.6-flash',
  outputSchemaRef: 'review-evidence-v1',
  allowedCapabilities: [],
};
export const SEED_REVIEW_AGENT_PROMPT_REFERENCE = 'review/v1';

/**
 * DEVOS-052's Tool Gateway is the first machinery in this codebase to
 * require a real project membership for "Project Scope" authorization —
 * every earlier system-actor write (publish-artifact.ts,
 * record-context-manifest.ts) only ever used `devos-agent-runtime` for
 * audit actor-type classification, never an authorization check. A
 * system-executed development task genuinely needs a real membership
 * grant to invoke tools on the project's behalf (Constitution Principle 6:
 * authority comes from an explicit grant, not an implicit bypass), so this
 * seeds one rather than special-casing the Tool Gateway around this
 * specific string constant.
 */
export const SEED_AGENT_RUNTIME_MEMBERSHIP_ID = '00000000-0000-4000-8000-000000000016';
export const SEED_AGENT_RUNTIME_PRINCIPAL_ID = 'devos-agent-runtime';

export const SEED_PLANNING_PATH_WORKFLOW_DEFINITION_ID = '00000000-0000-4000-8000-00000000000e';
export const SEED_PLANNING_PATH_WORKFLOW_VERSION_ID = '00000000-0000-4000-8000-00000000000f';
export const SEED_PLANNING_PATH_WORKFLOW_KEY = 'planning-path';

/**
 * Sprint 2's vertical slice (DEVOS-035): four real, LLM-backed agent tasks
 * in sequence, each reading the previous stage's published artifact. Edges
 * document the intended order for a human/future graph-aware executor to
 * read — the current task queue (Sprint 1, unchanged) doesn't enforce them
 * itself; ordering is achieved by run-creation.ts's per-node createdAt
 * offset (DEVOS-035) matching this nodes array's declaration order.
 */
export const SEED_PLANNING_PATH_WORKFLOW_GRAPH = {
  name: 'Planning Path',
  description:
    'Discovery -> requirements -> technical design -> planning, each a real Gemini-backed agent (Sprint 2).',
  trigger: { type: 'WORK_ITEM_MANUAL' },
  inputs: [{ name: 'workItemId', type: 'WORK_ITEM', required: true }],
  nodes: [
    { id: 'discovery', type: 'AGENT_TASK', name: 'Discovery', agentRef: SEED_DISCOVERY_AGENT_KEY },
    {
      id: 'requirements',
      type: 'AGENT_TASK',
      name: 'Requirements',
      agentRef: SEED_REQUIREMENTS_AGENT_KEY,
    },
    {
      id: 'technical-design',
      type: 'AGENT_TASK',
      name: 'Technical Design',
      agentRef: SEED_TECHNICAL_DESIGN_AGENT_KEY,
    },
    { id: 'planning', type: 'AGENT_TASK', name: 'Planning', agentRef: SEED_PLANNING_AGENT_KEY },
  ],
  edges: [
    { from: 'discovery', to: 'requirements' },
    { from: 'requirements', to: 'technical-design' },
    { from: 'technical-design', to: 'planning' },
  ],
  // DEVOS-047: reuses the existing (previously unpopulated anywhere)
  // WorkflowDefinition.policies field as a simple marker list, rather than
  // adding a new boolean field or fully wiring DEVOS-044's policy evaluator
  // into workflow completion — the presence of this key is what tells
  // maybeCompleteRun (packages/database/src/repositories/task-queue.ts) to
  // gate this workflow's completion behind a human planning approval
  // (specs/workflows/software-change-workflow.md §16) instead of completing
  // it automatically.
  policies: ['planning-approval'],
  outputs: [],
};

/** The marker `WorkflowDefinition.policies` entry that gates run completion
 * behind a human planning approval (DEVOS-047). */
export const PLANNING_APPROVAL_POLICY_KEY = 'planning-approval';

export const SEED_DEVELOPMENT_PATH_WORKFLOW_DEFINITION_ID = '00000000-0000-4000-8000-000000000017';
export const SEED_DEVELOPMENT_PATH_WORKFLOW_VERSION_ID = '00000000-0000-4000-8000-000000000018';
export const SEED_DEVELOPMENT_PATH_WORKFLOW_KEY = 'development-path';

/**
 * DEVOS-061: a separate one-node workflow rather than a fifth node on
 * SEED_PLANNING_PATH_WORKFLOW_GRAPH — the task queue's maybeCompleteRun
 * (packages/database/src/repositories/task-queue.ts) only advances a run's
 * approval gate once *every* task in that run has succeeded, so a
 * development node co-located with the planning nodes would block the
 * planning-approval gate on development also completing, inverting the
 * intended "approve the plan, then develop" order. This workflow instead
 * runs as its own separate run, consuming an earlier planning-path run's
 * approved plan via a project-scoped artifact lookup (see
 * run-development-agent-task.ts) — so it carries no `policies` marker of
 * its own; there is nothing to gate.
 */
export const SEED_DEVELOPMENT_PATH_WORKFLOW_GRAPH = {
  name: 'Development Path',
  description:
    'Implements an approved plan through controlled repository actions and opens a pull request (Sprint 4).',
  trigger: { type: 'WORK_ITEM_MANUAL' },
  inputs: [{ name: 'workItemId', type: 'WORK_ITEM', required: true }],
  nodes: [
    {
      id: 'development',
      type: 'AGENT_TASK',
      name: 'Development',
      agentRef: SEED_DEVELOPMENT_AGENT_KEY,
    },
  ],
  edges: [],
  outputs: [],
};

export const SEED_DEVELOPMENT_PATH_WORKFLOW_V2_VERSION_ID = '00000000-0000-4000-8000-00000000001d';

/**
 * DEVOS-067: version 2 of the same `development-path` definition — not an
 * edit to `SEED_DEVELOPMENT_PATH_WORKFLOW_GRAPH` above, since "published
 * workflow versions are immutable" (Workflow Principle 8,
 * specs/workflows/software-change-workflow.md §8) and DEVOS-061's own E2E
 * test targets that exact version by id. Extends development with the two
 * stages Sprint 5 adds — validation (build+test, a `TOOL_TASK`, no agent)
 * and review (`AGENT_TASK`, `review-agent`) — as two more nodes in the
 * *same* run, not a further split into separate workflows: unlike
 * planning -> development (which crosses a human approval gate),
 * development -> validation -> review has no gate between them anywhere
 * in the spec's own flow diagram (§7), so the existing "materialize every
 * node up front, complete once all succeed" engine model already fits
 * without further changes. A `CHANGES_REQUIRED` review outcome doesn't
 * loop *within* this run — `runReviewAgentTask` starts an entirely new run
 * of this same version instead (see its own doc comment), since the
 * engine has no "insert a task into an already-running run" mechanism.
 */
export const SEED_DEVELOPMENT_PATH_WORKFLOW_V2_GRAPH = {
  name: 'Development Path',
  description:
    'Implements an approved plan, validates it (build + test), and reviews it — with automatic rework on CHANGES_REQUIRED (Sprint 5).',
  trigger: { type: 'WORK_ITEM_MANUAL' },
  inputs: [{ name: 'workItemId', type: 'WORK_ITEM', required: true }],
  nodes: [
    {
      id: 'development',
      type: 'AGENT_TASK',
      name: 'Development',
      agentRef: SEED_DEVELOPMENT_AGENT_KEY,
    },
    {
      id: 'validation',
      type: 'TOOL_TASK',
      name: 'Automated Validation',
    },
    {
      id: 'review',
      type: 'AGENT_TASK',
      name: 'Engineering Review',
      agentRef: SEED_REVIEW_AGENT_KEY,
    },
  ],
  edges: [
    { from: 'development', to: 'validation' },
    { from: 'validation', to: 'review' },
  ],
  outputs: [],
};

export const SEED_RELEASE_PATH_WORKFLOW_DEFINITION_ID = '00000000-0000-4000-8000-00000000001e';
export const SEED_RELEASE_PATH_WORKFLOW_VERSION_ID = '00000000-0000-4000-8000-00000000001f';
export const SEED_RELEASE_PATH_WORKFLOW_KEY = 'release-path';

/** The marker `WorkflowDefinition.policies` entry that gates run completion
 * behind a human release approval (DEVOS-073) — the release-shaped analogue
 * of `PLANNING_APPROVAL_POLICY_KEY` above, both now read by the same
 * generalized `APPROVAL_GATE_POLICIES` map in
 * `packages/database/src/repositories/task-queue.ts`. */
export const RELEASE_APPROVAL_POLICY_KEY = 'release-approval';

/**
 * DEVOS-073: a third, separate one-node workflow — the same reasoning
 * DEVOS-061 already applied to `SEED_DEVELOPMENT_PATH_WORKFLOW_GRAPH`
 * governs here too: a gate (this one, release approval) still needs a run
 * of its own, since `maybeCompleteRun` only advances a gate once every task
 * in *that* run has succeeded, and the engine has no mechanism to insert a
 * task into an already-running run. The single node re-checks release
 * readiness (`runReleaseReadinessCheckTask`, reusing DEVOS-069's evaluator)
 * against whatever `TEST_EVIDENCE`/`REVIEW_EVIDENCE` the project's most
 * recent development-path run produced; only once that task succeeds does
 * `maybeCompleteRun` see this version's `release-approval` marker and
 * request a human release approval instead of completing outright.
 */
export const SEED_RELEASE_PATH_WORKFLOW_GRAPH = {
  name: 'Release Path',
  description:
    'Re-checks release readiness and gates release behind a human release approval (Sprint 6).',
  trigger: { type: 'WORK_ITEM_MANUAL' },
  inputs: [{ name: 'workItemId', type: 'WORK_ITEM', required: true }],
  nodes: [
    {
      id: 'release-readiness-check',
      type: 'TOOL_TASK',
      name: 'Release Readiness Check',
    },
  ],
  edges: [],
  policies: [RELEASE_APPROVAL_POLICY_KEY],
  outputs: [],
};

export const SEED_RELEASE_PATH_WORKFLOW_V2_VERSION_ID = '00000000-0000-4000-8000-000000000022';

/**
 * DEVOS-079: version 2 of the same `release-path` definition — not an edit
 * to `SEED_RELEASE_PATH_WORKFLOW_GRAPH` above (Workflow Principle 8,
 * "published workflow versions are immutable," and DEVOS-073's own live
 * verification already targets v1 by exact version id). This version has
 * no `policies` marker of its own — it carries no gate, because it exists
 * to run *after* a v1 run's release approval was already granted: the same
 * "a gate needs a run of its own, but what happens after isn't itself
 * re-gated" pattern DEVOS-061 established for planning -> development.
 * `release` (deploy + post-release validation + evidence, DEVOS-076) and
 * `closure` (DEVOS-078) are two nodes in the same run rather than two more
 * separate runs, since no gate sits between them either — the same
 * reasoning DEVOS-067 applied to development -> validation -> review.
 */
export const SEED_RELEASE_PATH_WORKFLOW_V2_GRAPH = {
  name: 'Release Path',
  description:
    'Deploys the approved release, validates it, and closes the work item with its full linked evidence (Sprint 6).',
  trigger: { type: 'WORK_ITEM_MANUAL' },
  inputs: [{ name: 'workItemId', type: 'WORK_ITEM', required: true }],
  nodes: [
    {
      id: 'release',
      type: 'TOOL_TASK',
      name: 'Release',
    },
    {
      id: 'closure',
      type: 'TOOL_TASK',
      name: 'Closure',
    },
  ],
  edges: [{ from: 'release', to: 'closure' }],
  outputs: [],
};

export const SEED_RELEASE_PATH_WORKFLOW_V3_VERSION_ID = '00000000-0000-4000-8000-00000000002f';

/**
 * DEVOS-113: version 3 of the same `release-path` definition — same
 * immutability reasoning as v2 above (a new version, not an edit to v1's
 * graph). Adds a real security-scan stage ahead of the pre-existing
 * readiness re-check, `security-scan -> release-readiness-check`, using
 * the real dependency-ordering barrier DEVOS-108-followup added to
 * `claimNext()` (`packages/database/src/repositories/task-queue.ts`) so the
 * readiness check genuinely waits for the scan's own real result rather
 * than racing it. Additive, not a replacement for v1 — v1 stays exactly as
 * every existing test/seed consumer already depends on; v3 is what a
 * project wanting the real scan stage runs instead.
 */
export const SEED_RELEASE_PATH_WORKFLOW_V3_GRAPH = {
  name: 'Release Path',
  description:
    'Runs a real security scan, then re-checks release readiness against it alongside the existing test/review evidence (Sprint 10).',
  trigger: { type: 'WORK_ITEM_MANUAL' },
  inputs: [{ name: 'workItemId', type: 'WORK_ITEM', required: true }],
  nodes: [
    {
      id: 'security-scan',
      type: 'TOOL_TASK',
      name: 'Security Scan',
    },
    {
      id: 'release-readiness-check',
      type: 'TOOL_TASK',
      name: 'Release Readiness Check',
    },
  ],
  edges: [{ from: 'security-scan', to: 'release-readiness-check' }],
  policies: [RELEASE_APPROVAL_POLICY_KEY],
  outputs: [],
};

export const SEED_RELEASE_ROLLBACK_WORKFLOW_DEFINITION_ID = '00000000-0000-4000-8000-000000000030';
export const SEED_RELEASE_ROLLBACK_WORKFLOW_VERSION_ID = '00000000-0000-4000-8000-000000000031';
export const SEED_RELEASE_ROLLBACK_WORKFLOW_KEY = 'release-rollback';

/**
 * DEVOS-114: a real trigger for `runReleaseRollbackTask` (DEVOS-077) — a
 * separate, single-node, on-demand workflow rather than a new node on
 * `release-path`, since a rollback isn't a stage in the standard pipeline
 * (it never runs as part of a normal release) and needs its own real,
 * caller-supplied `rollbackToRevision` — which the generic run-start API
 * (`POST .../runs`, `StartRunInput.inputs`) already accepted but, until
 * DEVOS-114's fix to `run-creation.ts`, never actually threaded through to
 * a task's own `input` (only `run.input` got it). `apps/web`'s existing
 * generic "start a run" UI (`RunsPage.tsx`) is the real trigger the task's
 * own acceptance criterion asks for — an authorized user picks this
 * workflow and supplies the revision to roll back to.
 */
export const SEED_RELEASE_ROLLBACK_WORKFLOW_GRAPH = {
  name: 'Release Rollback',
  description:
    'Rolls back a real deployment to a specific, explicitly authorized revision (Sprint 10).',
  trigger: { type: 'WORK_ITEM_MANUAL' },
  inputs: [
    { name: 'workItemId', type: 'WORK_ITEM', required: true },
    { name: 'rollbackToRevision', type: 'STRING', required: true },
  ],
  nodes: [
    {
      id: 'rollback',
      type: 'TOOL_TASK',
      name: 'Rollback',
    },
  ],
  edges: [],
  policies: [],
  outputs: [],
};

/**
 * Seed rows for `tool_capabilities` (DEVOS-051). `packages/database` cannot
 * depend on `packages/tools` (package-boundary direction: tools sits
 * downstream of domain/application, database is a peer leaf — see
 * DEVOS-SPRINT4-DECISIONS.md), so these literal definitions are duplicated
 * here rather than imported, the same way the agent seed configurations
 * above are inlined rather than imported from wherever agent role logic
 * lives. `packages/tools/src/capabilities/*.ts` remains the canonical,
 * in-code source DEVOS-052's Tool Gateway actually consults.
 */
export const SEED_REPO_READ_CAPABILITY_ID = '00000000-0000-4000-8000-000000000010';
export const SEED_REPO_WRITE_CAPABILITY_ID = '00000000-0000-4000-8000-000000000011';
export const SEED_GIT_COMMIT_CAPABILITY_ID = '00000000-0000-4000-8000-000000000012';
export const SEED_PULL_REQUEST_CREATE_CAPABILITY_ID = '00000000-0000-4000-8000-000000000013';
export const SEED_BUILD_RUN_CAPABILITY_ID = '00000000-0000-4000-8000-000000000019';
export const SEED_TEST_RUN_CAPABILITY_ID = '00000000-0000-4000-8000-00000000001a';
export const SEED_DEPLOY_CAPABILITY_ID = '00000000-0000-4000-8000-000000000020';
export const SEED_HEALTH_CHECK_CAPABILITY_ID = '00000000-0000-4000-8000-000000000021';
export const SEED_SECURITY_SCAN_CAPABILITY_ID = '00000000-0000-4000-8000-00000000002e';

/**
 * DEVOS spec `specs/architecture/organisations-and-project-types.md` §7:
 * "promotes" the 4 workflow graphs and 6 agent configurations already
 * seeded above into `ProjectTypeWorkflow`/`ProjectTypeAgent` template rows
 * under the one seeded 'software-development' Project Type, verbatim —
 * these are the fixed ids for those template rows.
 */
export const SEED_PT_WORKFLOW_INTAKE_ID = '00000000-0000-4000-8000-000000000024';
export const SEED_PT_WORKFLOW_PLANNING_PATH_ID = '00000000-0000-4000-8000-000000000025';
export const SEED_PT_WORKFLOW_DEVELOPMENT_PATH_ID = '00000000-0000-4000-8000-000000000026';
export const SEED_PT_WORKFLOW_RELEASE_PATH_ID = '00000000-0000-4000-8000-000000000027';

export const SEED_PT_AGENT_DISCOVERY_ID = '00000000-0000-4000-8000-000000000028';
export const SEED_PT_AGENT_REQUIREMENTS_ID = '00000000-0000-4000-8000-000000000029';
export const SEED_PT_AGENT_TECHNICAL_DESIGN_ID = '00000000-0000-4000-8000-00000000002a';
export const SEED_PT_AGENT_PLANNING_ID = '00000000-0000-4000-8000-00000000002b';
export const SEED_PT_AGENT_DEVELOPMENT_ID = '00000000-0000-4000-8000-00000000002c';
export const SEED_PT_AGENT_REVIEW_ID = '00000000-0000-4000-8000-00000000002d';

export const SEED_TOOL_CAPABILITIES = [
  {
    id: SEED_REPO_READ_CAPABILITY_ID,
    key: 'repo-read',
    name: 'Read Repository File',
    riskClass: 'R0',
    inputSchema: {
      type: 'object',
      properties: { path: { type: 'string' }, ref: { type: 'string' } },
      required: ['path'],
    },
    outputSchema: {
      type: 'object',
      properties: { path: { type: 'string' }, content: { type: 'string' } },
      required: ['path', 'content'],
    },
  },
  {
    id: SEED_REPO_WRITE_CAPABILITY_ID,
    key: 'repo-write',
    name: 'Write Repository File',
    riskClass: 'R2',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        content: { type: 'string' },
        branch: { type: 'string' },
      },
      required: ['path', 'content', 'branch'],
    },
    outputSchema: {
      type: 'object',
      properties: { path: { type: 'string' } },
      required: ['path'],
    },
  },
  {
    id: SEED_GIT_COMMIT_CAPABILITY_ID,
    key: 'git-commit',
    name: 'Create Git Commit',
    riskClass: 'R2',
    inputSchema: {
      type: 'object',
      properties: { branch: { type: 'string' }, message: { type: 'string' } },
      required: ['branch', 'message'],
    },
    outputSchema: {
      type: 'object',
      properties: { commitSha: { type: 'string' }, branch: { type: 'string' } },
      required: ['commitSha', 'branch'],
    },
  },
  {
    id: SEED_PULL_REQUEST_CREATE_CAPABILITY_ID,
    key: 'pull-request-create',
    name: 'Create Pull Request',
    riskClass: 'R3',
    inputSchema: {
      type: 'object',
      properties: {
        sourceBranch: { type: 'string' },
        targetBranch: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
      },
      required: ['sourceBranch', 'targetBranch', 'title'],
    },
    outputSchema: {
      type: 'object',
      properties: { pullRequestReference: { type: 'string' }, url: { type: 'string' } },
      required: ['pullRequestReference'],
    },
  },
  {
    id: SEED_BUILD_RUN_CAPABILITY_ID,
    key: 'build-run',
    name: 'Run Build',
    riskClass: 'R2',
    inputSchema: {
      type: 'object',
      properties: { command: { type: 'string' } },
      required: ['command'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        exitCode: { type: 'number' },
        stdout: { type: 'string' },
        stderr: { type: 'string' },
      },
      required: ['exitCode', 'stdout', 'stderr'],
    },
  },
  {
    id: SEED_TEST_RUN_CAPABILITY_ID,
    key: 'test-run',
    name: 'Run Tests',
    riskClass: 'R2',
    inputSchema: {
      type: 'object',
      properties: { command: { type: 'string' } },
      required: ['command'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        exitCode: { type: 'number' },
        stdout: { type: 'string' },
        stderr: { type: 'string' },
      },
      required: ['exitCode', 'stdout', 'stderr'],
    },
  },
  {
    id: SEED_SECURITY_SCAN_CAPABILITY_ID,
    key: 'security-scan',
    name: 'Run Security Scan',
    riskClass: 'R2',
    inputSchema: {
      type: 'object',
      properties: { command: { type: 'string' } },
      required: ['command'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        exitCode: { type: 'number' },
        stdout: { type: 'string' },
        stderr: { type: 'string' },
      },
      required: ['exitCode', 'stdout', 'stderr'],
    },
  },
  {
    id: SEED_DEPLOY_CAPABILITY_ID,
    key: 'deploy',
    name: 'Deploy to Environment',
    riskClass: 'R3',
    inputSchema: {
      type: 'object',
      properties: { revision: { type: 'string' } },
      required: ['revision'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        deploymentId: { type: 'string' },
        deployedPath: { type: 'string' },
        revision: { type: 'string' },
      },
      required: ['deploymentId', 'deployedPath', 'revision'],
    },
  },
  {
    id: SEED_HEALTH_CHECK_CAPABILITY_ID,
    key: 'health-check',
    name: 'Run Post-Release Health Check',
    riskClass: 'R2',
    inputSchema: {
      type: 'object',
      properties: { command: { type: 'string' } },
      required: ['command'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        exitCode: { type: 'number' },
        stdout: { type: 'string' },
        stderr: { type: 'string' },
      },
      required: ['exitCode', 'stdout', 'stderr'],
    },
  },
] as const;
