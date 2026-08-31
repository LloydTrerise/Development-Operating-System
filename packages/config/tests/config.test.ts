import { describe, expect, it } from 'vitest';
import {
  ConfigValidationError,
  assertEnvironment,
  loadConfig,
  validateEnvironment,
} from '../src/index.js';

describe('configuration', () => {
  it('loads development defaults', () => {
    const config = loadConfig({
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://localhost/devos',
    });

    expect(config.environment).toBe('development');
    expect(config.port).toBe(3000);
    expect(config.logging.level).toBe('info');
    expect(config.database).toEqual({ url: 'postgresql://localhost/devos' });
  });

  it('fails fast when DATABASE_URL is missing', () => {
    expect(() => loadConfig({ NODE_ENV: 'development' })).toThrow(ConfigValidationError);
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

  it('loads GEMINI_API_KEY as optional agents config when provided', () => {
    const config = loadConfig({
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://localhost/devos',
      GEMINI_API_KEY: 'test-key',
    });

    expect(config.agents).toEqual({ geminiApiKey: 'test-key' });
  });

  it('omits agents.geminiApiKey when GEMINI_API_KEY is not provided', () => {
    const config = loadConfig({
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://localhost/devos',
    });

    expect(config.agents).toEqual({});
  });

  it('rejects an empty GEMINI_API_KEY without exposing its value', () => {
    const secret = 'a-leaked-looking-key';
    const result = validateEnvironment({
      DATABASE_URL: 'postgresql://localhost/devos',
      GEMINI_API_KEY: '   ',
    });

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.key)).toContain('GEMINI_API_KEY');
    expect(JSON.stringify(result)).not.toContain(secret);
  });

  it('loads VAULT_ADDR/VAULT_TOKEN as optional secrets config when provided', () => {
    const config = loadConfig({
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://localhost/devos',
      VAULT_ADDR: 'http://localhost:8200',
      VAULT_TOKEN: 'test-token',
    });

    expect(config.secrets).toEqual({
      vaultAddress: 'http://localhost:8200',
      vaultToken: 'test-token',
    });
  });

  it('omits secrets fields when VAULT_ADDR/VAULT_TOKEN are not provided', () => {
    const config = loadConfig({
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://localhost/devos',
    });

    expect(config.secrets).toEqual({});
  });

  it('rejects an empty VAULT_TOKEN without exposing its value', () => {
    const secret = 'a-leaked-looking-vault-token';
    const result = validateEnvironment({
      DATABASE_URL: 'postgresql://localhost/devos',
      VAULT_TOKEN: '   ',
    });

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.key)).toContain('VAULT_TOKEN');
    expect(JSON.stringify(result)).not.toContain(secret);
  });

  it('DEVOS-107: loadConfig treats blank optional values (the .env.example scaffold convention) as absent, not invalid', () => {
    // Exercises the full readEnvironment -> validateEnvironment pipeline
    // loadConfig actually runs against real process.env-shaped input —
    // found for real once apps/api's `dev` script started actually loading
    // .env (previously it never did, so this path was never exercised).
    const config = loadConfig({
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://localhost/devos',
      QUEUE_URL: '',
      QUEUE_NAME: '',
      STORAGE_ENDPOINT: '',
      STORAGE_BUCKET: '',
      STORAGE_REGION: '',
      AUTH_ISSUER_URL: '',
      AUTH_AUDIENCE: '',
      GEMINI_API_KEY: '',
      VAULT_ADDR: '',
      VAULT_TOKEN: '',
      LOG_LEVEL: '',
    });

    expect(config.queue).toEqual({});
    expect(config.storage).toEqual({});
    expect(config.auth).toEqual({});
    expect(config.agents).toEqual({});
    expect(config.secrets).toEqual({});
    expect(config.logging.level).toBe('info');
  });

  it('rejects a malformed VAULT_ADDR', () => {
    const result = validateEnvironment({
      DATABASE_URL: 'postgresql://localhost/devos',
      VAULT_ADDR: 'not-a-url',
    });

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.key)).toContain('VAULT_ADDR');
  });

  it('DEVOS-118: loads REDIS_URL as optional rateLimit config when provided', () => {
    const config = loadConfig({
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://localhost/devos',
      REDIS_URL: 'redis://localhost:6379',
    });

    expect(config.rateLimit).toEqual({ redisUrl: 'redis://localhost:6379' });
  });

  it('DEVOS-118: omits rateLimit fields when REDIS_URL is not provided', () => {
    const config = loadConfig({
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://localhost/devos',
    });

    expect(config.rateLimit).toEqual({});
  });

  it('DEVOS-118: treats a blank REDIS_URL (the .env.example scaffold convention) as absent, not invalid', () => {
    const config = loadConfig({
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://localhost/devos',
      REDIS_URL: '',
    });

    expect(config.rateLimit).toEqual({});
  });

  it('DEVOS-118: rejects a malformed REDIS_URL', () => {
    const result = validateEnvironment({
      DATABASE_URL: 'postgresql://localhost/devos',
      REDIS_URL: 'not-a-url',
    });

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.key)).toContain('REDIS_URL');
  });
});
