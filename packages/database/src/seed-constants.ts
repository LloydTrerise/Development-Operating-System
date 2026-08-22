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
