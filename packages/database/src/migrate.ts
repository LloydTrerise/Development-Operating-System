import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { FileMigrationProvider, Migrator } from 'kysely/migration';
import { createDatabaseClient } from './client.js';

const migrationFolder = path.join(path.dirname(fileURLToPath(import.meta.url)), '../migrations');

// Node's default ESM loader rejects raw Windows paths (e.g. "C:\...") passed
// to dynamic import() — they must be file:// URLs. FileMigrationProvider's
// default `import` doesn't do this conversion, so it's overridden here.
function importMigrationModule(modulePath: string): Promise<unknown> {
  return import(pathToFileURL(modulePath).href);
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (connectionString === undefined) {
    throw new Error('DATABASE_URL is required to run migrations.');
  }

  const { db, close } = createDatabaseClient({ connectionString });

  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder,
      import: importMigrationModule,
    }),
  });

  const { error, results } = await migrator.migrateToLatest();

  for (const result of results ?? []) {
    if (result.status === 'Success') {
      console.log(`migration "${result.migrationName}" executed successfully`);
    } else if (result.status === 'Error') {
      console.error(`migration "${result.migrationName}" failed`);
    }
  }

  await close();

  if (error !== undefined) {
    console.error('Migration run failed.');
    console.error(error);
    process.exitCode = 1;
  }
}

void main();
