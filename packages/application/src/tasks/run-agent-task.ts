import { randomUUID } from 'node:crypto';
import { estimateCostUsd, validateAgentOutput } from '@devos/agents';
import type { AuditId, ProjectId } from '@devos/contracts';
import type {
  AgentExecution,
  ContextManifest,
  ContextManifestSource,
  WorkflowTask,
} from '@devos/domain';
import { authorityLevelFor } from '@devos/knowledge';
import type { AgentTaskHandlerDeps } from './deps.js';

// Matches every other task handler's own SYSTEM_ACTOR_ID constant
// (run-discovery-agent-task.ts and its siblings) — the agent runtime
// acting on its own behalf, not impersonating any real user.
const SYSTEM_ACTOR_ID = 'devos-agent-runtime';

/**
 * Which recorded source types represent retrieved/authoritative content
 * with a meaningful precedence ranking (DEVOS-042, extending DEVOS-041's
 * `authorityLevelFor`) versus execution configuration. `AGENT_VERSION`/
 * `PROMPT` describe how this execution was configured, not context content,
 * so they are deliberately left without an `authorityLevel` rather than
 * assigned an arbitrary one.
 */
const RANKED_SOURCE_TYPES = new Set([
  'WORK_ITEM',
  'ARTIFACT',
  'KNOWLEDGE_SOURCE',
  'PROJECT_CONTEXT',
]);

/**
 * What a caller (this function's own source construction, or a concrete
 * agent handler's `additionalContext`) supplies before provenance is
 * attached — just enough to identify the source; `retrievedAt`/
 * `authorityLevel` are filled in uniformly by `withProvenance` below, not
 * duplicated at every call site.
 */
type ContextManifestSourceInput = Pick<ContextManifestSource, 'type' | 'ref'>;

function withProvenance(
  source: ContextManifestSourceInput,
  retrievedAt: string,
): ContextManifestSource {
  return {
    ...source,
    retrievedAt,
    ...(RANKED_SOURCE_TYPES.has(source.type)
      ? { authorityLevel: authorityLevelFor(source.type) }
      : {}),
  };
}

/**
 * A prior-stage input a concrete agent handler has already resolved itself
 * (e.g. DEVOS-032's requirements agent reading DEVOS-031's discovery
 * report) — merged into the model's input and recorded as an extra context
 * manifest source, without runAgentTask needing to know what "discovery
 * report" or "PRD" mean. Keeps this function generic across all four
 * planning-path agents (DEVOS-031–034), each of which layers its own
 * artifact-lookup on top of this same runtime.
 */
export interface AgentTaskAdditionalContext {
  input?: Record<string, unknown>;
  sources?: ContextManifestSourceInput[];
}

/**
 * DEVOS-098: a real, checkable per-project budget threshold — not a payment
 * system, no automatic spend cutoff, just a real, visible audit record when
 * a project's real accumulated `estimatedCostUsd` first crosses its
 * configured `budgetUsd`. Optional (see `AgentTaskHandlerDeps`): a no-op
 * whenever `projects`/`auditRecords`/the repository's own optional
 * `sumEstimatedCostUsdForProject` aren't all supplied, or the project has
 * no configured budget, or this execution recorded no cost at all.
 *
 * Fires exactly once per crossing, not on every execution once already
 * over budget: `totalCostUsd` (post-completion) minus this execution's own
 * `estimatedCostUsd` gives the pre-completion total; the alert only fires
 * when that pre-completion total was still under budget.
 */
async function maybeAlertOnBudgetExceeded(
  deps: AgentTaskHandlerDeps,
  projectId: ProjectId,
  estimatedCostUsd: number | undefined,
): Promise<void> {
  if (
    !deps.projects ||
    !deps.auditRecords ||
    !deps.agentExecutions.sumEstimatedCostUsdForProject ||
    estimatedCostUsd === undefined
  ) {
    return;
  }

  const project = await deps.projects.getById(projectId);
  if (!project || project.budgetUsd === undefined) return;

  const totalCostUsd = await deps.agentExecutions.sumEstimatedCostUsdForProject(projectId);
  const previousTotalCostUsd = totalCostUsd - estimatedCostUsd;
  if (previousTotalCostUsd > project.budgetUsd || totalCostUsd <= project.budgetUsd) return;

  const now = new Date().toISOString();
  await deps.auditRecords.create({
    id: randomUUID() as AuditId,
    organisationId: project.organisationId,
    projectId,
    actorType: 'SYSTEM',
    actorId: SYSTEM_ACTOR_ID,
    action: 'project.budget_exceeded',
    targetType: 'Project',
    targetId: projectId,
    outcome: 'FAILURE',
    metadata: { budgetUsd: project.budgetUsd, accumulatedCostUsd: totalCostUsd },
    createdAt: now,
  });
}

/**
 * The generic agent runtime (DEVOS-026): given a WorkflowTask whose node
 * carries an `agentRef` (threaded into `task.input` by run-creation.ts),
 * resolves the referenced agent's active published version, records an
 * AgentExecution, invokes the injected AgentModelAdapter, and reports the
 * result back through the same return-value/throw contract every other
 * TaskHandler uses (task-dispatcher.ts treats a normal return as success
 * and a thrown error as failure/retry — there is no other signalling path,
 * so a FAILED AgentInvocationResult is recorded and then thrown, not
 * returned).
 *
 * This is infrastructure, not a concrete agent — DEVOS-031–034 define what
 * the four planning-path agents actually do; DEVOS-035 is what registers
 * this handler for the 'AGENT_TASK' node type in apps/worker. Verified here
 * against real Postgres with a deterministic fake AgentModelAdapter (no
 * real provider exists yet — that's DEVOS-027).
 *
 * When the resolved agent version has a promptReference, its text is
 * resolved via the injected PromptRepository (DEVOS-028) and passed to the
 * adapter as systemInstructions — a missing/invalid reference fails the
 * task rather than silently running without it.
 *
 * When the resolved agent version has an outputSchemaRef, a SUCCEEDED
 * invocation's result is validated against it (DEVOS-029) before being
 * accepted — a schema-violating output is a failure, not a silently
 * accepted result, exactly like a provider-reported failure.
 *
 * Before invoking the model adapter, a context manifest (DEVOS-030) is
 * assembled and recorded — the explicit record of exactly what material
 * context (work item, agent version, prompt version) was supplied for this
 * execution, per AGENTS.md's "Context ≠ Authority" principle: this is
 * recorded as context, not treated as an authoritative instruction.
 *
 * `additionalContext` (DEVOS-032) lets a caller that has already resolved a
 * prior-stage artifact (e.g. the requirements agent reading the discovery
 * report it was derived from) fold that content into the model's input and
 * the recorded manifest, without this function needing any artifact-type-
 * specific knowledge.
 */
export async function runAgentTask(
  deps: AgentTaskHandlerDeps,
  task: WorkflowTask,
  additionalContext?: AgentTaskAdditionalContext,
): Promise<Record<string, unknown>> {
  const agentRef = task.input.agentRef;
  if (typeof agentRef !== 'string' || agentRef.trim().length === 0) {
    throw new Error(`Task ${task.id} has no agentRef configured.`);
  }

  const run = await deps.workflowRuns.getById(task.workflowRunId);
  if (!run) throw new Error(`Workflow run ${task.workflowRunId} not found.`);

  const workItem = await deps.workItems.getById(run.workItemId);
  if (!workItem) throw new Error(`Work item ${run.workItemId} not found.`);

  const agent = await deps.agents.getByProjectAndKey(run.projectId, agentRef);
  if (!agent) throw new Error(`Agent "${agentRef}" not found in project ${run.projectId}.`);

  const versions = await deps.agentVersions.listForAgent(agent.id);
  const version = versions
    .filter((candidate) => candidate.status === 'PUBLISHED')
    .sort((a, b) => b.version - a.version)[0];
  if (!version) throw new Error(`Agent "${agentRef}" has no published version to run.`);

  const now = new Date().toISOString();
  const executionInput = {
    workItemId: workItem.id,
    workItemTitle: workItem.title,
    workItemDescription: workItem.description ?? null,
    runInput: run.input,
    ...additionalContext?.input,
  };

  const execution: AgentExecution = {
    id: randomUUID() as AgentExecution['id'],
    workflowTaskId: task.id,
    agentVersionId: version.id,
    status: 'RUNNING',
    input: executionInput,
    startedAt: now,
    createdAt: now,
  };
  await deps.agentExecutions.create(execution);

  const manifest: ContextManifest = {
    id: randomUUID() as ContextManifest['id'],
    projectId: run.projectId,
    workflowTaskId: task.id,
    agentExecutionId: execution.id,
    version: 1,
    sources: [
      { type: 'WORK_ITEM', ref: `work-item:${workItem.id}` },
      { type: 'AGENT_VERSION', ref: `agent-version:${version.id}` },
      ...(version.promptReference !== undefined
        ? [{ type: 'PROMPT', ref: `prompt:${version.promptReference}` }]
        : []),
      ...(additionalContext?.sources ?? []),
    ].map((source) => withProvenance(source, now)),
    // No policy engine exists yet (specs/sprints/sprint-02/README.md scopes
    // that to a future sprint) — recorded explicitly as "none" rather than
    // omitted, so the manifest's shape is stable ahead of DEVOS-039+.
    policySnapshot: { policyVersion: 'none' },
    createdAt: now,
  };
  await deps.recordContextManifest(manifest);

  const objective = `Perform the "${version.configuration.role}" role for work item "${workItem.title}".`;

  const systemInstructions =
    version.promptReference !== undefined
      ? await deps.prompts.resolve(version.promptReference)
      : undefined;

  const invocation = await deps.modelAdapter.invoke({
    configuration: version.configuration,
    ...(version.promptReference !== undefined ? { promptReference: version.promptReference } : {}),
    ...(systemInstructions !== undefined ? { systemInstructions } : {}),
    objective,
    input: executionInput,
  });

  if (invocation.status === 'FAILED') {
    const failedAt = new Date().toISOString();
    await deps.agentExecutions.fail(
      execution.id,
      undefined,
      invocation.errorMessage ?? 'Agent invocation failed.',
      failedAt,
    );
    throw new Error(invocation.errorMessage ?? `Agent "${agentRef}" invocation failed.`);
  }

  // DEVOS-029: a schema-conforming output is a precondition for success,
  // distinct from a provider/network failure — the model responded, but
  // its response doesn't satisfy the agent's declared output contract.
  if (version.configuration.outputSchemaRef !== undefined) {
    const schema = await deps.schemas.resolve(version.configuration.outputSchemaRef);
    const issues = validateAgentOutput(invocation.result ?? {}, schema);
    if (issues.length > 0) {
      const message = `Agent "${agentRef}" output failed schema "${version.configuration.outputSchemaRef}" validation: ${issues.map((issue) => `${issue.field} ${issue.message}`).join('; ')}`;
      const failedAt = new Date().toISOString();
      await deps.agentExecutions.fail(
        execution.id,
        'DEVOS_SCHEMA_VALIDATION_FAILED',
        message,
        failedAt,
      );
      throw new Error(message);
    }
  }

  const completedAt = new Date().toISOString();
  const estimatedCostUsd =
    invocation.usage !== undefined ? estimateCostUsd(invocation.usage) : undefined;

  await deps.agentExecutions.complete(
    execution.id,
    invocation.result ?? {},
    invocation.uncertainty,
    completedAt,
    invocation.usage,
    estimatedCostUsd,
  );

  await maybeAlertOnBudgetExceeded(deps, run.projectId, estimatedCostUsd);

  return {
    status: 'SUCCEEDED',
    agentExecutionId: execution.id,
    agentVersionId: version.id,
    ...invocation.result,
  };
}
