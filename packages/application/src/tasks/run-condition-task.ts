import type {
  ArtifactRepository,
  WorkflowRunRepository,
  WorkflowTask,
  WorkflowTaskRepository,
  WorkflowVersionRepository,
} from '@devos/domain';

export interface ConditionTaskHandlerDeps {
  workflowRuns: WorkflowRunRepository;
  workflowVersions: WorkflowVersionRepository;
  workflowTasks: WorkflowTaskRepository;
  artifacts: ArtifactRepository;
}

type ConditionOperator = 'equals' | 'notEquals' | 'exists';

interface TaskResultRule {
  source: 'task';
  taskKey: string;
  field: string;
  operator: ConditionOperator;
  value?: unknown;
}

interface VariableRule {
  source: 'variable';
  path: string;
  operator: ConditionOperator;
  value?: unknown;
}

interface ArtifactStatusRule {
  source: 'artifact';
  taskKey: string;
  operator: ConditionOperator;
  value?: unknown;
}

type ConditionRule = TaskResultRule | VariableRule | ArtifactStatusRule;

interface ConditionNodeConfig {
  rule: ConditionRule;
  whenTrue?: string;
  whenFalse?: string;
}

function getByPath(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (current === null || typeof current !== 'object') return undefined;
    return (current as Record<string, unknown>)[key];
  }, source);
}

function evaluateOperator(
  actual: unknown,
  operator: ConditionOperator,
  expected: unknown,
): boolean {
  switch (operator) {
    case 'exists':
      return actual !== undefined && actual !== null;
    case 'equals':
      return actual === expected;
    case 'notEquals':
      return actual !== expected;
  }
}

async function resolveUpstreamTask(
  deps: ConditionTaskHandlerDeps,
  workflowRunId: WorkflowTask['workflowRunId'],
  taskKey: string,
): Promise<WorkflowTask | undefined> {
  const tasks = await deps.workflowTasks.listForRun(workflowRunId);
  return tasks.find((candidate) => candidate.taskKey === taskKey);
}

async function evaluateRule(
  deps: ConditionTaskHandlerDeps,
  task: WorkflowTask,
  runInput: Record<string, unknown>,
  rule: ConditionRule,
): Promise<boolean> {
  if (rule.source === 'variable') {
    return evaluateOperator(getByPath(runInput, rule.path), rule.operator, rule.value);
  }

  const upstream = await resolveUpstreamTask(deps, task.workflowRunId, rule.taskKey);

  if (rule.source === 'task') {
    const actual = upstream?.output ? getByPath(upstream.output, rule.field) : undefined;
    return evaluateOperator(actual, rule.operator, rule.value);
  }

  // rule.source === 'artifact': the named upstream task's own output is
  // expected to carry `artifactId` (every existing artifact-producing task
  // handler in this codebase already returns one — run-discovery-task.ts,
  // run-*-agent-task.ts).
  const artifactId = upstream?.output?.artifactId;
  const artifact =
    typeof artifactId === 'string'
      ? await deps.artifacts.getById(artifactId as Parameters<ArtifactRepository['getById']>[0])
      : null;
  return evaluateOperator(artifact?.status, rule.operator, rule.value);
}

/**
 * DEVOS-119: a `CONDITION` node's real handler. Evaluates its own
 * `config.rule` (validated to exist by `validateWorkflowGraph`) against
 * prior task output, the run's own input ("workflow variable"), or a
 * produced artifact's status, then reports which one of its outgoing
 * edges — by `branch` — is taken. The untaken branch's immediate target
 * task(s) are reported via the reserved `skipTaskKeys` output key, which
 * `TaskQueue.complete()` interprets to mark them `SKIPPED` atomically
 * alongside this task's own completion (`packages/database/src/repositories/task-queue.ts`).
 */
export async function runConditionTask(
  deps: ConditionTaskHandlerDeps,
  task: WorkflowTask,
): Promise<Record<string, unknown>> {
  const run = await deps.workflowRuns.getById(task.workflowRunId);
  if (!run) throw new Error(`Workflow run ${task.workflowRunId} not found.`);

  const version = await deps.workflowVersions.getById(run.workflowVersionId);
  if (!version) throw new Error(`Workflow version ${run.workflowVersionId} not found.`);

  const node = version.definition.nodes.find((candidate) => candidate.id === task.taskKey);
  if (!node) throw new Error(`CONDITION node "${task.taskKey}" not found in workflow definition.`);

  const config = node.config as unknown as ConditionNodeConfig | undefined;
  if (!config?.rule) {
    throw new Error(`CONDITION node "${task.taskKey}" has no config.rule.`);
  }

  const result = await evaluateRule(deps, task, run.input, config.rule);
  const branch = result ? (config.whenTrue ?? 'true') : (config.whenFalse ?? 'false');

  const untakenTargets = version.definition.edges
    .filter(
      (edge) => edge.from === task.taskKey && edge.branch !== undefined && edge.branch !== branch,
    )
    .map((edge) => edge.to);

  return {
    status: 'SUCCEEDED',
    branch,
    ...(untakenTargets.length > 0 ? { skipTaskKeys: untakenTargets } : {}),
  };
}
