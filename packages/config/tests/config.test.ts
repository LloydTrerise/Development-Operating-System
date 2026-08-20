import { describe, expect, it } from 'vitest';
import {
  ConfigValidationError,
  assertEnvironment,
  loadConfig,
  validateEnvironment,
} from '../src/index.js';

describe('configuration', () => {
  it('loads development defaults', () => {
    const config = loadConfig({ NODE_ENV: 'development' });

    expect(config.environment).toBe('development');
    expect(config.port).toBe(3000);
    expect(config.logging.level).toBe('info');
    expect(config.database).toEqual({});
  });

  it('accepts valid optional subsystem configuration', () => {
    const result = validateEnvironment({
      NODE_ENV: 'development',
      PORT: '4000',
      DATABASE_URL: 'postgresql://localhost/devos',
      QUEUE_URL: 'redis://localhost:6379',
      QUEUE_NAME: 'devos',
      STORAGE_ENDPOINT: 'http://localhost:9000',
      STORAGE_BUCKET: 'devos',
      STORAGE_REGION: 'local',
      AUTH_ISSUER_URL: 'https://issuer.example.com',
      AUTH_AUDIENCE: 'devos-api',
      LOG_LEVEL: 'debug',
    });

    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('rejects invalid configuration values', () => {
    const result = validateEnvironment({
      NODE_ENV: 'invalid',
      PORT: '70000',
      DATABASE_URL: 'not-a-url',
      LOG_LEVEL: 'trace',
    });

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.key)).toEqual([
      'NODE_ENV',
      'PORT',
      'DATABASE_URL',
      'LOG_LEVEL',
    ]);
  });

  it('throws a structured validation error', () => {
    expect(() => assertEnvironment({ PORT: 'invalid' })).toThrow(ConfigValidationError);
  });

  it('does not expose secret values in validation errors', () => {
    const secret = 'super-secret-password';
    const result = validateEnvironment({
      DATABASE_URL: `postgresql://user:${secret}@localhost/devos`,
    });

    expect(result.valid).toBe(true);
    expect(JSON.stringify(result)).not.toContain(secret);
  });
});
