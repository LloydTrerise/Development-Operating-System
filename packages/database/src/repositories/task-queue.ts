import { createHash, randomUUID } from 'node:crypto';
import { MAX_TASK_ATTEMPTS, type TaskFailure, type TaskQueue } from '@devos/domain';
import type { Kysely } from 'kysely';
import type { Database } from '../database.js';
import { PLANNING_APPROVAL_POLICY_KEY, RELEASE_APPROVAL_POLICY_KEY } from '../seed-constants.js';
import { writeAuditRecord } from './audit-helper.js';
import { withTransaction, type QueryExecutor } from './base.js';
import { createEventEnvelope } from './event-envelope.js';
import { createOutboxEventRepository, getOrganisationIdForProject } from './outbox-events.js';
import { toWorkflowTaskDomain } from './workflow-tasks.js';

const SYSTEM_ACTOR_ID = 'devos-worker';

/**
 * A scope hash over the exact evidence being approved (specs/api/poc-api-contracts.md
 * §29–§30). Independently duplicated in `packages/application/src/approval/request-approval.ts` —
 * see that copy's comment for why this isn't a shared `packages/domain` helper.
 */
function computeApprovalScopeHash(artifactVersionIds: string[]): string {
  const sorted = [...artifactVersionIds].sort();
  return createHash('sha256').update(JSON.stringify(sorted)).digest('hex');
}

/**
 * Gathers the latest version of every artifact this run has produced so
 * far — the evidence a planning approval is bound to (DEVOS-047), mirroring
 * `packages/knowledge`'s `retrieveArtifactsForRun` (DEVOS-040) but done as a
 * direct query since this runs inside the task-completion transaction, not
 * through the retrieval package's repository-port composition.
 */
async function collectRunArtifactVersionIds(
  trx: QueryExecutor,
  workflowRunId: string,
): Promise<string[]> {
  const artifacts = await trx
    .selectFrom('artifacts')
    .select('id')
    .where('workflow_run_id', '=', workflowRunId)
    .execute();

  const versionIds: string[] = [];
  for (const artifact of artifacts) {
    const latest = await trx
      .selectFrom('artifact_versions')
      .select('id')
      .where('artifact_id', '=', artifact.id)
      .orderBy('version', 'desc')
      .limit(1)
      .executeTakeFirst();
    if (latest) versionIds.push(latest.id);
  }
  return versionIds;
}

/**
 * Maps a `WorkflowDefinition.policies` gate marker to the `approval_type`
 * it requests. `planning-approval` -> `'PLANNING'` is DEVOS-047's original
 * gate (Stage 6, specs/workflows/software-change-workflow.md §16);
 * `release-approval` -> `'RELEASE'` is DEVOS-073's release-approval gate
 * (Stage 11, §22) — the same mechanism, a second marker. `approval_type` is
 * documented as free-form ("Planning/Release/etc.",
 * specs/database/poc-database-schema.md §11.1), so adding a second entry
 * here needs no schema change.
 */
const APPROVAL_GATE_POLICIES: Record<string, string> = {
  [PLANNING_APPROVAL_POLICY_KEY]: 'PLANNING',
  [RELEASE_APPROVAL_POLICY_KEY]: 'RELEASE',
};

/**
 * A human approval gate (Stage 6 — Human Planning Approval, §16; Stage 11 —
 * Release, §22's required approval): a run whose workflow version's
 * definition carries one of `APPROVAL_GATE_POLICIES`'s marker keys does not
 * complete automatically — it transitions to `AWAITING_APPROVAL` (the
 * existing workflow-level state, specs/workflows/software-change-workflow.md
 * §9) and an approval request of the corresponding type is created
 * automatically, bound to every artifact the run has produced. DEVOS-045's
 * approve/reject API is what resolves it (via
 * `transitionAfterApprovalDecision`, approval-run-transition.ts).
 */
async function requestApproval(
  trx: QueryExecutor,
  workflowRunId: string,
  projectId: string,
  approvalType: string,
): Promise<void> {
  const artifactVersionIds = await collectRunArtifactVersionIds(trx, workflowRunId);

  const now = new Date().toISOString();
  const approvalId = randomUUID();
  await trx
    .insertInto('approvals')
    .values({
      id: approvalId,
      project_id: projectId,
      workflow_run_id: workflowRunId,
      approval_type: approvalType,
      status: 'PENDING',
      requested_by: SYSTEM_ACTOR_ID,
      decided_by: null,
      decision_reason: null,
      evidence_reference: JSON.stringify({
        artifactVersionIds,
        scopeHash: computeApprovalScopeHash(artifactVersionIds),
      }),
      requested_at: now,
      decided_at: null,
    })
    .execute();

  await trx
    .updateTable('workflow_runs')
    .set({ status: 'AWAITING_APPROVAL', updated_at: now })
    .where('id', '=', workflowRunId)
    .execute();

  const organisationId = await getOrganisationIdForProject(trx, projectId);
  const envelope = createEventEnvelope(
    'ApprovalRequested',
    'Approval',
    approvalId,
    { workflowRunId, approvalType },
    { projectId },
  );
  await createOutboxEventRepository(trx).create(organisationId, envelope);

  await writeAuditRecord(trx, {
    organisationId,
    projectId,
    actorType: 'SYSTEM',
    actorId: SYSTEM_ACTOR_ID,
    action: 'approval.requested',
    targetType: 'Approval',
    targetId: approvalId,
    outcome: 'SUCCESS',
    correlationId: envelope.correlationId,
  });
}

async function maybeCompleteRun(trx: QueryExecutor, workflowRunId: string): Promise<void> {
  const run = await trx
    .selectFrom('workflow_runs')
    .select(['id', 'project_id', 'status', 'workflow_version_id'])
    .where('id', '=', workflowRunId)
    .executeTakeFirst();
  if (!run || run.status !== 'PENDING') return;

  const tasks = await trx
    .selectFrom('workflow_tasks')
    .select(['status'])
    .where('workflow_run_id', '=', workflowRunId)
    .execute();
  if (tasks.length === 0 || !tasks.every((task) => task.status === 'SUCCEEDED')) return;

  const version = await trx
    .selectFrom('workflow_versions')
    .select('definition')
    .where('id', '=', run.workflow_version_id)
    .executeTakeFirst();
  const policies = (version?.definition as { policies?: string[] } | undefined)?.policies ?? [];
  const gateMarker = policies.find((key) => key in APPROVAL_GATE_POLICIES);
  if (gateMarker) {
    await requestApproval(trx, workflowRunId, run.project_id, APPROVAL_GATE_POLICIES[gateMarker]!);
    return;
  }

  const now = new Date().toISOString();
  await trx
    .updateTable('workflow_runs')
    .set({ status: 'COMPLETED', completed_at: now, updated_at: now })
    .where('id', '=', workflowRunId)
    .execute();

  const organisationId = await getOrganisationIdForProject(trx, run.project_id);
  const envelope = createEventEnvelope(
    'WorkflowRunCompleted',
    'WorkflowRun',
    workflowRunId,
    {},
    { projectId: run.project_id },
  );
  await createOutboxEventRepository(trx).create(organisationId, envelope);

  await writeAuditRecord(trx, {
    organisationId,
    projectId: run.project_id,
    actorType: 'SYSTEM',
    actorId: SYSTEM_ACTOR_ID,
    action: 'workflow_run.completed',
    targetType: 'WorkflowRun',
    targetId: workflowRunId,
    outcome: 'SUCCESS',
    correlationId: envelope.correlationId,
  });
}

async function failRun(trx: QueryExecutor, workflowRunId: string, message: string): Promise<void> {
  const run = await trx
    .selectFrom('workflow_runs')
    .select(['id', 'project_id', 'status'])
    .where('id', '=', workflowRunId)
    .executeTakeFirst();
  if (!run || run.status !== 'PENDING') return;

  const now = new Date().toISOString();
  await trx
    .updateTable('workflow_runs')
    .set({
      status: 'FAILED',
      error_code: 'DEVOS_TASK_FAILED',
      error_message: message,
      completed_at: now,
      updated_at: now,
    })
    .where('id', '=', workflowRunId)
    .execute();

  const organisationId = await getOrganisationIdForProject(trx, run.project_id);
  const envelope = createEventEnvelope(
    'WorkflowRunFailed',
    'WorkflowRun',
    workflowRunId,
    { message },
    { projectId: run.project_id },
  );
  await createOutboxEventRepository(trx).create(organisationId, envelope);

  await writeAuditRecord(trx, {
    organisationId,
    projectId: run.project_id,
    actorType: 'SYSTEM',
    actorId: SYSTEM_ACTOR_ID,
    action: 'workflow_run.failed',
    targetType: 'WorkflowRun',
    targetId: workflowRunId,
    outcome: 'FAILURE',
    metadata: { message },
    correlationId: envelope.correlationId,
  });
}

/**
 * Shared terminal-vs-retry accounting for a single task, used by both
 * fail() (a handler threw) and reclaimStale() (a worker died holding the
 * task). Identical MAX_TASK_ATTEMPTS logic and audit/event shape either
 * way — from the run's perspective a task that silently vanished and one
 * whose handler explicitly failed look the same.
 */
async function resolveTaskFailure(
  trx: QueryExecutor,
  taskId: string,
  currentAttempt: number,
  workflowRunId: string,
  failure: TaskFailure,
  retryable: boolean,
): Promise<void> {
  const now = new Date().toISOString();
  const shouldRetry = retryable && currentAttempt < MAX_TASK_ATTEMPTS;

  await trx
    .updateTable('workflow_tasks')
    .set({
      status: shouldRetry ? 'PENDING' : 'FAILED',
      error_code: failure.code ?? null,
      error_message: failure.message,
      ...(shouldRetry ? {} : { completed_at: now }),
      updated_at: now,
    })
    .where('id', '=', taskId)
    .execute();

  if (shouldRetry) return;

  const run = await trx
    .selectFrom('workflow_runs')
    .select('project_id')
    .where('id', '=', workflowRunId)
    .executeTakeFirst();
  if (run) {
    const organisationId = await getOrganisationIdForProject(trx, run.project_id);
    const envelope = createEventEnvelope(
      'WorkflowTaskFailed',
      'WorkflowTask',
      taskId,
      { message: failure.message },
      { projectId: run.project_id },
    );
    await createOutboxEventRepository(trx).create(organisationId, envelope);

    await writeAuditRecord(trx, {
      organisationId,
      projectId: run.project_id,
      actorType: 'SYSTEM',
      actorId: SYSTEM_ACTOR_ID,
      action: 'workflow_task.failed',
      targetType: 'WorkflowTask',
      targetId: taskId,
      outcome: 'FAILURE',
      metadata: { message: failure.message },
      correlationId: envelope.correlationId,
    });
  }

  await failRun(trx, workflowRunId, failure.message);
}

export function createPostgresTaskQueue(db: Kysely<Database>): TaskQueue {
  return {
    async claimNext() {
      return withTransaction(db, async (trx) => {
        const candidate = await trx
          .selectFrom('workflow_tasks')
          .select('id')
          .where('status', '=', 'PENDING')
          .orderBy('created_at', 'asc')
          .limit(1)
          .forUpdate()
          .skipLocked()
          .executeTakeFirst();

        if (!candidate) return null;

        const now = new Date().toISOString();
        const row = await trx
          .updateTable('workflow_tasks')
          .set((eb) => ({
            status: 'RUNNING',
            attempt: eb('attempt', '+', 1),
            started_at: now,
            updated_at: now,
          }))
          .where('id', '=', candidate.id)
          .returningAll()
          .executeTakeFirstOrThrow();

        const task = toWorkflowTaskDomain(row);

        const run = await trx
          .selectFrom('workflow_runs')
          .select('project_id')
          .where('id', '=', task.workflowRunId)
          .executeTakeFirst();
        if (run) {
          const organisationId = await getOrganisationIdForProject(trx, run.project_id);
          const envelope = createEventEnvelope(
            'WorkflowTaskStarted',
            'WorkflowTask',
            task.id,
            { taskKey: task.taskKey, taskType: task.taskType, attempt: task.attempt },
            { projectId: run.project_id },
          );
          await createOutboxEventRepository(trx).create(organisationId, envelope);
        }

        return task;
      });
    },

    async complete(taskId, attempt, output) {
      await withTransaction(db, async (trx) => {
        const now = new Date().toISOString();
        // DEVOS-094: fenced by attempt — only applies if this row is still
        // RUNNING under the exact attempt the caller believes it holds. A
        // row already reclaimed and resolved under a later attempt (or
        // already terminal) matches neither condition, so this late/stale
        // completion is a safe no-op rather than overwriting that outcome.
        const row = await trx
          .updateTable('workflow_tasks')
          .set({
            status: 'SUCCEEDED',
            output: JSON.stringify(output),
            completed_at: now,
            updated_at: now,
          })
          .where('id', '=', taskId)
          .where('status', '=', 'RUNNING')
          .where('attempt', '=', attempt)
          .returningAll()
          .executeTakeFirst();
        if (!row) return;
        const task = toWorkflowTaskDomain(row);

        const run = await trx
          .selectFrom('workflow_runs')
          .select('project_id')
          .where('id', '=', task.workflowRunId)
          .executeTakeFirst();
        if (run) {
          const organisationId = await getOrganisationIdForProject(trx, run.project_id);
          const envelope = createEventEnvelope(
            'WorkflowTaskCompleted',
            'WorkflowTask',
            task.id,
            { output },
            { projectId: run.project_id },
          );
          await createOutboxEventRepository(trx).create(organisationId, envelope);

          await writeAuditRecord(trx, {
            organisationId,
            projectId: run.project_id,
            actorType: 'SYSTEM',
            actorId: SYSTEM_ACTOR_ID,
            action: 'workflow_task.completed',
            targetType: 'WorkflowTask',
            targetId: task.id,
            outcome: 'SUCCESS',
            correlationId: envelope.correlationId,
          });
        }

        await maybeCompleteRun(trx, task.workflowRunId);
      });
    },

    async fail(taskId, attempt, failure, retryable) {
      await withTransaction(db, async (trx) => {
        // DEVOS-094: same fencing-token contract as complete() — a stale
        // worker's late fail() for a task already reclaimed/resolved under
        // a later attempt must not corrupt that later outcome.
        const current = await trx
          .selectFrom('workflow_tasks')
          .select(['attempt', 'workflow_run_id', 'status'])
          .where('id', '=', taskId)
          .executeTakeFirst();
        if (!current || current.status !== 'RUNNING' || current.attempt !== attempt) return;

        await resolveTaskFailure(
          trx,
          taskId,
          current.attempt,
          current.workflow_run_id,
          failure,
          retryable,
        );
      });
    },

    async reclaimStale(staleThresholdMs) {
      const cutoff = new Date(Date.now() - staleThresholdMs).toISOString();

      const stale = await db
        .selectFrom('workflow_tasks')
        .select(['id', 'attempt', 'workflow_run_id', 'started_at'])
        .where('status', '=', 'RUNNING')
        .where('started_at', 'is not', null)
        .where('started_at', '<', cutoff)
        .execute();

      for (const task of stale) {
        await withTransaction(db, async (trx) => {
          // Re-check inside the transaction: another worker (or a
          // concurrent reclaim pass) may have already claimed/resolved
          // this task between the SELECT above and now.
          const current = await trx
            .selectFrom('workflow_tasks')
            .select(['id', 'attempt', 'status', 'workflow_run_id'])
            .where('id', '=', task.id)
            .where('status', '=', 'RUNNING')
            .forUpdate()
            .executeTakeFirst();
          if (!current) return;

          await resolveTaskFailure(
            trx,
            current.id,
            current.attempt,
            current.workflow_run_id,
            {
              code: 'DEVOS_TASK_STALE',
              message:
                'Task exceeded its stale-running threshold; reclaimed by a restarted worker.',
            },
            true,
          );
        });
      }

      return stale.length;
    },
  };
}
