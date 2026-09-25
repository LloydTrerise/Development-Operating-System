// Migrations run against a schema mid-construction, before it matches the
// final Database type — Kysely's own migration examples use Kysely<any> here.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Kysely } from 'kysely';

/**
 * DEVOS-311 (Sprint 52, `specs/DEVOS-LLM-CREDENTIAL-MANAGEMENT-BACKLOG.md`
 * §5.1, candidate epic E30): `organisation_llm_providers` — one entry in an
 * organisation's own ranked list of LLM provider credentials. Dormant on
 * creation: no route or use case reads/writes this table in this sprint, and
 * an organisation with zero rows keeps today's single boot-time
 * `GEMINI_API_KEY` platform-default behavior unchanged (Sprint 53 wires real
 * per-task resolution; Sprint 54 adds the fallback chain and settings UI).
 *
 * `priority` is unique per organisation (the real fallback-chain rank Sprint
 * 54's resolution logic will walk, lower first) — enforced with a composite
 * unique constraint rather than left to application-layer discipline, the
 * same "push the real invariant into the database, not just application
 * code" precedent migration `0052`'s composite FK already established for
 * this epic's own model.
 *
 * `onDelete('cascade')` on `organisation_id`: applied proactively rather than
 * found the hard way — migrations `0054`/`0058` already learned this lesson
 * for this codebase's e2e pilot tests, which routinely hard-delete their own
 * test organisations as cleanup, and a provider entry has no independent
 * meaning once its own organisation is gone.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('organisation_llm_providers')
    .addColumn('id', 'uuid', (col) => col.primaryKey())
    .addColumn('organisation_id', 'uuid', (col: any) =>
      col.notNull().references('organisations.id').onDelete('cascade'),
    )
    .addColumn('provider', 'text', (col) => col.notNull())
    .addColumn('credential_reference', 'text', (col) => col.notNull())
    .addColumn('priority', 'integer', (col) => col.notNull())
    .addColumn('status', 'text', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) => col.notNull())
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull())
    .addUniqueConstraint('organisation_llm_providers_org_priority_key', [
      'organisation_id',
      'priority',
    ])
    .execute();

  await db.schema
    .createIndex('organisation_llm_providers_organisation_id_idx')
    .on('organisation_llm_providers')
    .column('organisation_id')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('organisation_llm_providers').execute();
}
