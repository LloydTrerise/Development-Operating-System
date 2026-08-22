import type { Kysely, Transaction } from 'kysely';
import type { Database } from '../database.js';

/**
 * Foundation for concrete repositories added once DEVOS-009 introduces the
 * schema. A repository method accepts a QueryExecutor so callers can run it
 * either directly against the pool or inside an existing transaction.
 */
export type QueryExecutor = Kysely<Database> | Transaction<Database>;

export async function withTransaction<T>(
  db: Kysely<Database>,
  fn: (trx: Transaction<Database>) => Promise<T>,
): Promise<T> {
  return db.transaction().execute(fn);
}
