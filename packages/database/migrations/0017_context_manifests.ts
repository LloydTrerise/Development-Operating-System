// Migrations run against a schema mid-construction, before it matches the
// final Database type — Kysely's own migration examples use Kysely<any> here.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('context_manifests')
    .addColumn('id', 'uuid', (col) => col.primaryKey())
    .addColumn('project_id', 'uuid', (col) => col.notNull().references('projects.id'))
    .addColumn('workflow_task_id', 'uuid', (col) => col.notNull().references('workflow_tasks.id'))
    // Not in specs/database/poc-database-schema.md §17.1's documented column
    // list (only workflow_task_id is listed there) — added because a task
    // can produce multiple AgentExecution rows across retries
    // (agent_executions has no uniqueness on workflow_task_id), and the API
    // contract's Context Manifest Contract (§28) and Agent Execution
    // Contract (§22) both key a manifest by executionId, one per execution.
    .addColumn('agent_execution_id', 'uuid', (col) =>
      col.notNull().unique().references('agent_executions.id'),
    )
    .addColumn('version', 'integer', (col) => col.notNull())
    .addColumn('manifest', 'jsonb', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) => col.notNull())
    .execute();

  await db.schema
    .createIndex('context_manifests_workflow_task_id_idx')
    .on('context_manifests')
    .column('workflow_task_id')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('context_manifests').execute();
}
