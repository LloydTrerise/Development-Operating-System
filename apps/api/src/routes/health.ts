import type { DatabaseClient } from '@devos/database';
import type { Route } from '../http/router.js';

export interface HealthResult {
  status: 'ok' | 'degraded';
  checks: { database: 'ok' | 'error' };
}

export function createHealthRoutes(prefix: string, database: DatabaseClient): Route[] {
  return [
    {
      method: 'GET',
      pattern: `${prefix}/health`,
      protected: false,
      handler: async (): Promise<HealthResult> => {
        const databaseHealthy = await database.checkHealth();
        return {
          status: databaseHealthy ? 'ok' : 'degraded',
          checks: { database: databaseHealthy ? 'ok' : 'error' },
        };
      },
    },
  ];
}
