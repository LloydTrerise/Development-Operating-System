import { readEnvironment, type NodeEnvironment } from './environment.js';
import { assertEnvironment } from './validation.js';

export interface DatabaseConfig {
  url: string;
}

export interface QueueConfig {
  url?: string;
  name?: string;
}

export interface StorageConfig {
  endpoint?: string;
  bucket?: string;
  region?: string;
}

export interface AuthConfig {
  issuerUrl?: string;
  audience?: string;
}

export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Optional here — only apps/worker's real agent-task handler (DEVOS-035)
 * actually requires geminiApiKey; that requirement is enforced at
 * apps/worker's startup, not globally in this shared schema (apps/api has
 * no LLM dependency and shouldn't fail to start over a missing LLM key).
 */
export interface AgentsConfig {
  geminiApiKey?: string;
}

export interface DevosConfig {
  environment: NodeEnvironment;
  port: number;
  database: DatabaseConfig;
  queue: QueueConfig;
  storage: StorageConfig;
  auth: AuthConfig;
  logging: LoggingConfig;
  agents: AgentsConfig;
}

function parseEnvironment(value: string | undefined): NodeEnvironment {
  if (value === 'test' || value === 'production') return value;
  return 'development';
}

function parsePort(value: string | undefined): number {
  return value === undefined ? 3000 : Number(value);
}

function optional(value: string | undefined): string | undefined {
  return value === undefined || value.trim() === '' ? undefined : value;
}

function required(value: string | undefined, key: string): string {
  if (value === undefined) throw new Error(`${key} is required but was not provided.`);
  return value;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): DevosConfig {
  const raw = readEnvironment(env);
  assertEnvironment(raw);

  const databaseUrl = required(optional(raw.DATABASE_URL), 'DATABASE_URL');
  const queueUrl = optional(raw.QUEUE_URL);
  const queueName = optional(raw.QUEUE_NAME);
  const storageEndpoint = optional(raw.STORAGE_ENDPOINT);
  const storageBucket = optional(raw.STORAGE_BUCKET);
  const storageRegion = optional(raw.STORAGE_REGION);
  const authIssuerUrl = optional(raw.AUTH_ISSUER_URL);
  const authAudience = optional(raw.AUTH_AUDIENCE);
  const geminiApiKey = optional(raw.GEMINI_API_KEY);

  return {
    environment: parseEnvironment(raw.NODE_ENV),
    port: parsePort(raw.PORT),
    database: { url: databaseUrl },
    queue: {
      ...(queueUrl === undefined ? {} : { url: queueUrl }),
      ...(queueName === undefined ? {} : { name: queueName }),
    },
    storage: {
      ...(storageEndpoint === undefined ? {} : { endpoint: storageEndpoint }),
      ...(storageBucket === undefined ? {} : { bucket: storageBucket }),
      ...(storageRegion === undefined ? {} : { region: storageRegion }),
    },
    auth: {
      ...(authIssuerUrl === undefined ? {} : { issuerUrl: authIssuerUrl }),
      ...(authAudience === undefined ? {} : { audience: authAudience }),
    },
    logging: {
      level:
        raw.LOG_LEVEL === 'debug' || raw.LOG_LEVEL === 'warn' || raw.LOG_LEVEL === 'error'
          ? raw.LOG_LEVEL
          : 'info',
    },
    agents: {
      ...(geminiApiKey === undefined ? {} : { geminiApiKey }),
    },
  };
}
