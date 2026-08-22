export type NodeEnvironment = 'development' | 'test' | 'production';

export type Environment = Record<string, string | undefined>;

export interface RawEnvironment {
  NODE_ENV?: string;
  PORT?: string;
  DATABASE_URL?: string;
  QUEUE_URL?: string;
  QUEUE_NAME?: string;
  STORAGE_ENDPOINT?: string;
  STORAGE_BUCKET?: string;
  STORAGE_REGION?: string;
  AUTH_ISSUER_URL?: string;
  AUTH_AUDIENCE?: string;
  LOG_LEVEL?: string;
  GEMINI_API_KEY?: string;
}

export function readEnvironment(env: Environment = process.env): RawEnvironment {
  const result: RawEnvironment = {};

  if (env.NODE_ENV !== undefined) result.NODE_ENV = env.NODE_ENV;
  if (env.PORT !== undefined) result.PORT = env.PORT;
  if (env.DATABASE_URL !== undefined) result.DATABASE_URL = env.DATABASE_URL;
  if (env.QUEUE_URL !== undefined) result.QUEUE_URL = env.QUEUE_URL;
  if (env.QUEUE_NAME !== undefined) result.QUEUE_NAME = env.QUEUE_NAME;

  if (env.STORAGE_ENDPOINT !== undefined) {
    result.STORAGE_ENDPOINT = env.STORAGE_ENDPOINT;
  }

  if (env.STORAGE_BUCKET !== undefined) {
    result.STORAGE_BUCKET = env.STORAGE_BUCKET;
  }

  if (env.STORAGE_REGION !== undefined) {
    result.STORAGE_REGION = env.STORAGE_REGION;
  }

  if (env.AUTH_ISSUER_URL !== undefined) {
    result.AUTH_ISSUER_URL = env.AUTH_ISSUER_URL;
  }

  if (env.AUTH_AUDIENCE !== undefined) {
    result.AUTH_AUDIENCE = env.AUTH_AUDIENCE;
  }

  if (env.LOG_LEVEL !== undefined) result.LOG_LEVEL = env.LOG_LEVEL;
  if (env.GEMINI_API_KEY !== undefined) result.GEMINI_API_KEY = env.GEMINI_API_KEY;

  return result;
}
