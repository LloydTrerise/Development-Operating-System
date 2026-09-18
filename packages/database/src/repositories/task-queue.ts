import { createHash, randomUUID } from 'node:crypto';
import { MAX_TASK_ATTEMPTS, type TaskFailure, type TaskQueue } from '@devos/domain';
import { sql, type Kysely } from 'kysely';
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
  // DEVOS-119: a task on a CONDITION node's untaken branch is marked
  // SKIPPED (below, in complete()) rather than SUCCEEDED — a run made up of
  // only SUCCEEDED/SKIPPED tasks (no PENDING/RUNNING/FAILED left) has still
  // genuinely finished and must complete, not wait forever on a task that
  // was deliberately never going to run.
  //
  // DEVOS-120: FAILED is also acceptable here — but only ever reachable at
  // all when this task's failure was *tolerated* by a downstream JOIN
  // (resolveTaskFailure, below), because a *non*-tolerated permanent
  // failure already calls failRun() and flips run.status away from
  // 'PENDING', which this function's own guard above already returns on
  // before reaching this check. A FAILED task seen here is therefore
  // always a deliberately-tolerated one, never a run that should have died.
  if (
    tasks.length === 0 ||
    !tasks.every(
      (task) =>
        task.status === 'SUCCEEDED' || task.status === 'SKIPPED' || task.status === 'FAILED',
    )
  )
    return;

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
 * DEVOS-120: a permanently-failed task's failure is "tolerated" — the run
 * survives it — only when *every* outgoing edge from its own node leads
 * directly to a JOIN node whose config declares `branchFailurePolicy:
 * 'tolerant'`, and it has at least one outgoing edge (a leaf task with none
 * is never tolerated — otherwise "every edge" would be vacuously true for
 * an empty set). Deliberately not a general graph-reachability engine: a
 * task blocked behind this one through any *other* path is out of scope
 * (DEVOS-123) — none exists in this sprint's own PARALLEL/JOIN graph shapes.
 * Every graph without a tolerant JOIN (every workflow through Sprint 10)
 * is completely unaffected — `outgoingEdges.length > 0` alone already fails
 * for a graph with no edges naming this node, i.e. the pre-Sprint-11 norm.
 */
async function isFailureToleratedByDownstreamJoin(
  trx: QueryExecutor,
  workflowVersionId: string,
  taskKey: string,
): Promise<boolean> {
  const version = await trx
    .selectFrom('workflow_versions')
    .select('definition')
    .where('id', '=', workflowVersionId)
    .executeTakeFirst();
  const definition = version?.definition as
    | {
        nodes?: { id: string; type: string; config?: { branchFailurePolicy?: string } }[];
        edges?: { from: string; to: string }[];
      }
    | undefined;
  const nodes = definition?.nodes ?? [];
  const edges = definition?.edges ?? [];

  const outgoingEdges = edges.filter((edge) => edge.from === taskKey);
  if (outgoingEdges.length === 0) return false;

  return outgoingEdges.every((edge) => {
    const target = nodes.find((node) => node.id === edge.to);
    return target?.type === 'JOIN' && target.config?.branchFailurePolicy === 'tolerant';
  });
}

/**
 * DEVOS-123: generalizes DEVOS-119's one-hop-only `skipTaskKeys` mechanism
 * (above, in `complete()`) into a real transitive closure — a task any
 * number of hops downstream of a `CONDITION`'s untaken branch, through any
 * chain of plain (non-`dependsOnTerminalOnly`) tasks, is now also marked
 * `SKIPPED` instead of waiting on a `SUCCEEDED` its own upstream can never
 * reach. Each pass marks `SKIPPED` any still-`PENDING`,
 * non-`dependsOnTerminalOnly` task whose own `input.dependsOn` names a task
 * that has already reached a terminal-but-not-`SUCCEEDED` status (`SKIPPED`,
 * or a DEVOS-120-tolerated `FAILED` — included for the same general
 * principle even though that specific case cannot currently arise, since
 * DEVOS-120 only tolerates a failure whose own outgoing edges lead directly
 * to a tolerant `JOIN`, which already reads any terminal status via its own
 * `dependsOnTerminalOnly` barrier without needing this cascade). Looping
 * until a pass finds nothing new computes the real closure rather than a
 * single hop; this always terminates, since each pass only ever moves a
 * task out of the finite `PENDING` pool for this run, never back into it.
 * Deliberately still not a general graph-reachability engine (no
 * `WITH RECURSIVE`, no edge/config lookups) — it reads only what
 * `run-creation.ts` already wrote into each task's own `input`, the same
 * minimal, additive style `claimNext()`'s own barrier already established.
 */
async function cascadeSkippedTasks(trx: QueryExecutor, workflowRunId: string): Promise<void> {
  const now = new Date().toISOString();
  for (;;) {
    const result = await sql<{ id: string }>`
      UPDATE workflow_tasks wt
      SET status = 'SKIPPED', completed_at = ${now}, updated_at = ${now}
      WHERE wt.workflow_run_id = ${workflowRunId}
        AND wt.status = 'PENDING'
        AND wt.input->>'dependsOnTerminalOnly' IS DISTINCT FROM 'true'
        AND EXISTS (
          SELECT 1
          FROM jsonb_array_elements_text(COALESCE(wt.input->'dependsOn', '[]'::jsonb)) AS dep(task_key)
          JOIN workflow_tasks up
            ON up.workflow_run_id = wt.workflow_run_id
           AND up.task_key = dep.task_key
          WHERE up.status IN ('SKIPPED', 'FAILED')
        )
      RETURNING wt.id
    `.execute(trx);
    if (result.rows.length === 0) return;
  }
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

  const updatedTask = await trx
    .updateTable('workflow_tasks')
    .set({
      status: shouldRetry ? 'PENDING' : 'FAILED',
      error_code: failure.code ?? null,
      error_message: failure.message,
      ...(shouldRetry ? {} : { completed_at: now }),
      updated_at: now,
    })
    .where('id', '=', taskId)
    .returning(['task_key'])
    .executeTakeFirstOrThrow();

  if (shouldRetry) return;

  const run = await trx
    .selectFrom('workflow_runs')
    .select(['project_id', 'workflow_version_id'])
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

  // DEVOS-120: skip the "whole run dies" path entirely when every one of
  // this task's own outgoing edges leads straight to a tolerant JOIN — the
  // task itself is already marked FAILED above; claimNext()'s
  // dependsOnTerminalOnly barrier (for that JOIN's own task) is what lets
  // the run keep making real progress past it, and maybeCompleteRun's own
  // FAILED-is-acceptable check (above) is what lets the run still reach
  // COMPLETED once everything else finishes.
  if (
    run &&
    (await isFailureToleratedByDownstreamJoin(trx, run.workflow_version_id, updatedTask.task_key))
  ) {
    return;
  }

  await failRun(trx, workflowRunId, failure.message);

  // DEVOS-108-followup: once a run has permanently failed, any sibling task
  // still `PENDING` can now only ever be a real downstream dependent
  // (`claimNext()`'s own `dependsOn` barrier — see run-creation.ts/
  // task-queue.ts's `claimNext()`) that will never become claimable, since
  // its upstream dependency just failed instead of reaching `SUCCEEDED`.
  // Before that barrier existed, such a task would eventually get claimed
  // anyway, immediately fail on its own missing-upstream-artifact check, and
  // reach `FAILED` through its own retry-then-fail cycle — wasteful, but it
  // did leave every task in a failed run with a terminal status. Marking
  // them `FAILED` directly here preserves that same "a failed run's tasks
  // are all terminal" invariant without the wasted claim/attempt cycles.
  await trx
    .updateTable('workflow_tasks')
    .set({
      status: 'FAILED',
      error_code: 'DEVOS_UPSTREAM_TASK_FAILED',
      error_message: 'Not attempted: a task this run depended on failed.',
      completed_at: now,
      updated_at: now,
    })
    .where('workflow_run_id', '=', workflowRunId)
    .where('status', '=', 'PENDING')
    .execute();
}

export function createPostgresTaskQueue(db: Kysely<Database>): TaskQueue {
  return {
    async claimNext() {
      return withTransaction(db, async (trx) => {
        // DEVOS-108-followup: a task whose `input.dependsOn` (set at
        // creation, run-creation.ts) names another task in the same run
        // that hasn't yet reached `SUCCEEDED` is not a real candidate,
        // however old its `created_at` — the `NOT EXISTS` over
        // `jsonb_array_elements_text` checks every declared dependency is
        // satisfied before this row is even eligible to be
        // `FOR UPDATE SKIP LOCKED`-claimed, so this is a real barrier
        // (any number of concurrent claimers, not just an ordering hint for
        // a single sequential one) enforced atomically in the same query
        // that does the claiming, not a separate check with its own race
        // window.
        //
        // DEVOS-120: a task created with `input.dependsOnTerminalOnly: true`
        // (a JOIN node with a 'tolerant' branchFailurePolicy, run-creation.ts)
        // opts into a relaxed check — its named upstreams need only reach
        // *any* terminal status (SUCCEEDED/FAILED/SKIPPED), not specifically
        // SUCCEEDED, so a genuinely failed branch doesn't block it forever.
        // Every other task (the default, and every pre-Sprint-11 workflow)
        // keeps the original SUCCEEDED-only check unchanged.
        const result = await sql<{ id: string }>`
          SELECT wt.id
          FROM workflow_tasks wt
          WHERE wt.status = 'PENDING'
            AND NOT EXISTS (
              SELECT 1
              FROM jsonb_array_elements_text(COALESCE(wt.input->'dependsOn', '[]'::jsonb)) AS dep(task_key)
              WHERE NOT EXISTS (
                SELECT 1 FROM workflow_tasks up
                WHERE up.workflow_run_id = wt.workflow_run_id
                  AND up.task_key = dep.task_key
                  AND (
                    CASE WHEN wt.input->>'dependsOnTerminalOnly' = 'true'
                      THEN up.status IN ('SUCCEEDED', 'FAILED', 'SKIPPED')
                      ELSE up.status = 'SUCCEEDED'
                    END
                  )
              )
            )
          ORDER BY wt.created_at ASC
          LIMIT 1
          FOR UPDATE OF wt SKIP LOCKED
        `.execute(trx);
        const candidate = result.rows[0];

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

        // DEVOS-119: a real CONDITION node's handler (run-condition-task.ts)
        // reports the untaken branch's immediate target task(s) via this
        // reserved output key. Marking them SKIPPED here, in the same
        // transaction as this task's own SUCCEEDED commit, is what makes it
        // race-free: claimNext()'s dependsOn barrier already prevents any
        // other worker from claiming a task that depends on this one until
        // this transaction commits, so there is no window where a
        // to-be-skipped task could be claimed and run first.
        const skipTaskKeys = Array.isArray(output.skipTaskKeys)
          ? output.skipTaskKeys.filter((key): key is string => typeof key === 'string')
          : [];
        if (skipTaskKeys.length > 0) {
          await trx
            .updateTable('workflow_tasks')
            .set({ status: 'SKIPPED', completed_at: now, updated_at: now })
            .where('workflow_run_id', '=', task.workflowRunId)
            .where('task_key', 'in', skipTaskKeys)
            .where('status', '=', 'PENDING')
            .execute();

          // DEVOS-123: the skip must propagate past this one direct hop —
          // same transaction, so no other worker can observe (or claim past)
          // an intermediate state where a multi-hop-downstream task is still
          // PENDING against an upstream that will never reach SUCCEEDED.
          await cascadeSkippedTasks(trx, task.workflowRunId);
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

    async markWaiting(taskId, attempt, readyAt) {
      await withTransaction(db, async (trx) => {
        // DEVOS-121: same attempt-fencing contract as complete()/fail() — a
        // stale worker's late markWaiting() for a task already reclaimed/
        // resolved under a later attempt is a safe no-op.
        await trx
          .updateTable('workflow_tasks')
          .set({
            status: 'WAITING',
            output: JSON.stringify({ waitUntil: readyAt }),
            updated_at: new Date().toISOString(),
          })
          .where('id', '=', taskId)
          .where('status', '=', 'RUNNING')
          .where('attempt', '=', attempt)
          .execute();
      });
    },

    async resumeReadyWaits() {
      // DEVOS-121: the WAIT-node counterpart to reclaimStale() — a WAITING
      // task whose own recorded `output.waitUntil` has passed goes back to
      // PENDING so claimNext() can pick it up for real re-evaluation
      // (runWaitTask itself decides whether the wait is genuinely over).
      // ISO 8601 UTC timestamps (the only kind `new Date().toISOString()`
      // ever produces) sort correctly under plain text comparison, so this
      // needs no timestamp casting.
      const now = new Date().toISOString();
      const result = await sql<{ id: string }>`
        UPDATE workflow_tasks
        SET status = 'PENDING', updated_at = ${now}
        WHERE status = 'WAITING'
          AND output ->> 'waitUntil' <= ${now}
        RETURNING id
      `.execute(db);
      return result.rows.length;
    },
  };
}
