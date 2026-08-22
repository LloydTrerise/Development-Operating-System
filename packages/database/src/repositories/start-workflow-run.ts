import type { WorkflowRun, WorkflowTask } from '@devos/domain';
import type { Kysely } from 'kysely';
import type { Database } from '../database.js';
import { writeAuditRecord } from './audit-helper.js';
import { withTransaction } from './base.js';
import { createEventEnvelope } from './event-envelope.js';
import { createOutboxEventRepository, getOrganisationIdForProject } from './outbox-events.js';
import { createWorkflowRunRepository } from './workflow-runs.js';
import { createWorkflowTaskRepository } from './workflow-tasks.js';

export type StartWorkflowRun = (
  run: WorkflowRun,
  tasks: WorkflowTask[],
  actorId: string,
) => Promise<void>;

export function createWorkflowRunStarter(db: Kysely<Database>): StartWorkflowRun {
  return async (run, tasks, actorId) => {
    await withTransaction(db, async (trx) => {
      await createWorkflowRunRepository(trx).create(run);

      const taskRepository = createWorkflowTaskRepository(trx);
      for (const task of tasks) {
        await taskRepository.create(task);
      }

      const organisationId = await getOrganisationIdForProject(trx, run.projectId);
      const envelope = createEventEnvelope(
        'WorkflowRunStarted',
        'WorkflowRun',
        run.id,
        {
          workflowVersionId: run.workflowVersionId,
          workItemId: run.workItemId,
          taskCount: tasks.length,
        },
        { projectId: run.projectId },
      );
      await createOutboxEventRepository(trx).create(organisationId, envelope);

      await writeAuditRecord(trx, {
        organisationId,
        projectId: run.projectId,
        actorType: 'USER',
        actorId,
        action: 'workflow_run.started',
        targetType: 'WorkflowRun',
        targetId: run.id,
        outcome: 'SUCCESS',
        correlationId: envelope.correlationId,
      });
    });
  };
}
