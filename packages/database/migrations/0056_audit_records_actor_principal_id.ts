// Migrations run against a schema mid-construction, before it matches the
// final Database type — Kysely's own migration examples use Kysely<any> here.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { sql, type Kysely } from 'kysely';

/**
 * DEVOS-309 (Sprint 51's own reconciliation): closes the narrow,
 * disclosed delta between `audit_records` and the source document's
 * `AUDIT_LOG.actor_principal_id` FK — `actor_id` stays a plain `text`
 * column (it also carries `SYSTEM` actor ids like `devos-worker`/
 * `devos-agent-runtime`, which are never `principals` rows by design and
 * can never satisfy a blanket FK), and a new, nullable `actor_principal_id`
 * is added alongside it: a real, database-enforced FK to `principals.id`,
 * populated only for `USER`/`AGENT` rows whose `actor_id` resolves to a
 * real principal.
 *
 * The backfill excludes `'devos-agent-runtime'` by its known literal value
 * (`SEED_AGENT_RUNTIME_PRINCIPAL_ID`, duplicated here per this migration
 * folder's own established self-contained-record convention — see `0045`,
 * which excludes the same id for the identical reason: it is a system
 * actor inconsistently stamped `actor_type: 'USER'` on some rows, not a
 * human, and was deliberately never given a `principals` row).
 */
const SEED_AGENT_RUNTIME_PRINCIPAL_ID = 'devos-agent-runtime';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('audit_records')
    .addColumn('actor_principal_id', 'text', (col: any) => col.references('principals.id'))
    .execute();

  await db.schema
    .createIndex('audit_records_actor_principal_id_idx')
    .on('audit_records')
    .column('actor_principal_id')
    .execute();

  await sql`
    update audit_records
    set actor_principal_id = actor_id
    where actor_type in ('USER', 'AGENT')
      and actor_id != ${SEED_AGENT_RUNTIME_PRINCIPAL_ID}
      and exists (select 1 from principals where principals.id = audit_records.actor_id)
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('audit_records').dropColumn('actor_principal_id').execute();
}
