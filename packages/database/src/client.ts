import { Kysely, PostgresDialect, sql } from 'kysely';
import { Pool } from 'pg';
import type { Database } from './database.js';

export interface DatabaseClientOptions {
  connectionString: string;
  maxPoolSize?: number;
}

export interface DatabaseClient {
  db: Kysely<Database>;
  checkHealth: () => Promise<boolean>;
  close: () => Promise<void>;
}

export function createDatabaseClient(options: DatabaseClientOptions): DatabaseClient {
  const pool = new Pool({
    connectionString: options.connectionString,
    max: options.maxPoolSize ?? 10,
  });

  // pg.Pool emits 'error' when an idle client hits a backend error (e.g. the
  // database restarting). Without a listener, Node treats it as an
  // unhandled 'error' event and crashes the process — this keeps the API up
  // and lets checkHealth() report the outage instead.
  pool.on('error', (error) => {
    console.error('DevOS database pool error', error);
  });

  const db = new Kysely<Database>({
    dialect: new PostgresDialect({ pool }),
  });

  async function checkHealth(): Promise<boolean> {
    try {
      await sql`select 1`.execute(db);
      return true;
    } catch {
      return false;
    }
  }

  async function close(): Promise<void> {
    await db.destroy();
  }

  return { db, checkHealth, close };
}
