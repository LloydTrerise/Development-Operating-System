import { readEnvironment, type NodeEnvironment } from './environment.js';
import { assertEnvironment } from './validation.js';

export interface DatabaseConfig {
  url?: string;
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

export interface DevosConfig {
  environment: NodeEnvironment;
  port: number;
  database: DatabaseConfig;
  queue: QueueConfig;
  storage: StorageConfig;
  auth: AuthConfig;
  logging: LoggingConfig;
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

export function loadConfig(env: NodeJS.ProcessEnv = process.env): DevosConfig {
  const raw = readEnvironment(env);
  assertEnvironment(raw);

  const databaseUrl = optional(raw.DATABASE_URL);
  const queueUrl = optional(raw.QUEUE_URL);
  const queueName = optional(raw.QUEUE_NAME);
  const storageEndpoint = optional(raw.STORAGE_ENDPOINT);
  const storageBucket = optional(raw.STORAGE_BUCKET);
  const storageRegion = optional(raw.STORAGE_REGION);
  const authIssuerUrl = optional(raw.AUTH_ISSUER_URL);
  const authAudience = optional(raw.AUTH_AUDIENCE);

  return {
    environment: parseEnvironment(raw.NODE_ENV),
    port: parsePort(raw.PORT),
    database: databaseUrl === undefined ? {} : { url: databaseUrl },
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
  };
}
