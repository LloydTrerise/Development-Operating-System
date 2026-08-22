import { describe, expect, it } from 'vitest';
import { createDatabaseClient } from '../src/client.js';

// Port 1 on localhost refuses connections immediately (no service listens
// there), so these tests fail fast without needing a live Postgres.
const UNREACHABLE_CONNECTION_STRING = 'postgresql://user:pass@127.0.0.1:1/devos';

describe('database client', () => {
  it('constructs without connecting eagerly', () => {
    expect(() =>
      createDatabaseClient({ connectionString: UNREACHABLE_CONNECTION_STRING }),
    ).not.toThrow();
  });

  it('reports unhealthy when the database is unreachable', async () => {
    const client = createDatabaseClient({ connectionString: UNREACHABLE_CONNECTION_STRING });

    try {
      const healthy = await client.checkHealth();
      expect(healthy).toBe(false);
    } finally {
      await client.close();
    }
  });
});
