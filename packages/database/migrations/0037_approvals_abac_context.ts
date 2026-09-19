// Migrations run against a schema mid-construction, before it matches the
// final Database type — Kysely's own migration examples use Kysely<any> here.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Kysely } from 'kysely';

/**
 * Gap revisit (post-Sprint-16): `decide-approval.ts`'s own policy check had
 * no capability/agent-version/workflow-version/risk-class context available
 * — an `Approval` carried no such reference. All five columns are nullable:
 * every pre-existing approval (the two hardcoded whole-run gates, the
 * `APPROVAL` graph node) leaves them unset and is completely unaffected;
 * only the new tool-invocation-triggered approval path (this same gap
 * revisit) ever populates them.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('approvals')
    .addColumn('risk_class', 'text')
    .addColumn('agent_id', 'text')
    .addColumn('agent_version', 'integer')
    .addColumn('workflow_id', 'text')
    .addColumn('workflow_version', 'integer')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('approvals')
    .dropColumn('risk_class')
    .dropColumn('agent_id')
    .dropColumn('agent_version')
    .dropColumn('workflow_id')
    .dropColumn('workflow_version')
    .execute();
}
