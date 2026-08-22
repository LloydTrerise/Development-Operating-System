// Migrations run against a schema mid-construction, before it matches the
// final Database type — Kysely's own migration examples use Kysely<any> here.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('approvals')
    .addColumn('id', 'uuid', (col) => col.primaryKey())
    .addColumn('project_id', 'uuid', (col) => col.notNull().references('projects.id'))
    .addColumn('workflow_run_id', 'uuid', (col) => col.notNull().references('workflow_runs.id'))
    .addColumn('approval_type', 'text', (col) => col.notNull())
    .addColumn('status', 'text', (col) => col.notNull())
    .addColumn('requested_by', 'text', (col) => col.notNull())
    .addColumn('decided_by', 'text')
    .addColumn('decision_reason', 'text')
    .addColumn('evidence_reference', 'jsonb', (col) => col.notNull())
    .addColumn('requested_at', 'timestamptz', (col) => col.notNull())
    .addColumn('decided_at', 'timestamptz')
    .execute();

  await db.schema
    .createIndex('approvals_workflow_run_id_idx')
    .on('approvals')
    .column('workflow_run_id')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('approvals').execute();
}
