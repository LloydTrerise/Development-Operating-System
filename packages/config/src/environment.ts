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
  VAULT_ADDR?: string;
  VAULT_TOKEN?: string;
  REDIS_URL?: string;
}

/**
 * DEVOS-107: found while live-verifying against a real running process for
 * the first time with `.env` actually loaded into `process.env` (apps/api's
 * and apps/worker's `dev` scripts never loaded it before this sprint — see
 * their own `--env-file-if-exists` addition) — `.env.example`'s own
 * `KEY=` scaffold convention for "optional, unset locally" produces an
 * *empty string*, not `undefined`, once real env-file loading happens.
 * Every optional field below previously treated `''` as "provided" (then
 * failed `validateEnvironment`'s URL/non-empty checks), which is not what
 * a human editing that template intends. Blank/whitespace-only is now
 * treated identically to absent, for every optional field.
 */
function optionalValue(value: string | undefined): string | undefined {
  return value === undefined || value.trim() === '' ? undefined : value;
}

export function readEnvironment(env: Environment = process.env): RawEnvironment {
  const result: RawEnvironment = {};

  const nodeEnv = optionalValue(env.NODE_ENV);
  if (nodeEnv !== undefined) result.NODE_ENV = nodeEnv;
  const port = optionalValue(env.PORT);
  if (port !== undefined) result.PORT = port;
  if (env.DATABASE_URL !== undefined) result.DATABASE_URL = env.DATABASE_URL;

  const queueUrl = optionalValue(env.QUEUE_URL);
  if (queueUrl !== undefined) result.QUEUE_URL = queueUrl;
  const queueName = optionalValue(env.QUEUE_NAME);
  if (queueName !== undefined) result.QUEUE_NAME = queueName;

  const storageEndpoint = optionalValue(env.STORAGE_ENDPOINT);
  if (storageEndpoint !== undefined) result.STORAGE_ENDPOINT = storageEndpoint;

  const storageBucket = optionalValue(env.STORAGE_BUCKET);
  if (storageBucket !== undefined) result.STORAGE_BUCKET = storageBucket;

  const storageRegion = optionalValue(env.STORAGE_REGION);
  if (storageRegion !== undefined) result.STORAGE_REGION = storageRegion;

  const authIssuerUrl = optionalValue(env.AUTH_ISSUER_URL);
  if (authIssuerUrl !== undefined) result.AUTH_ISSUER_URL = authIssuerUrl;

  const authAudience = optionalValue(env.AUTH_AUDIENCE);
  if (authAudience !== undefined) result.AUTH_AUDIENCE = authAudience;

  const logLevel = optionalValue(env.LOG_LEVEL);
  if (logLevel !== undefined) result.LOG_LEVEL = logLevel;
  const geminiApiKey = optionalValue(env.GEMINI_API_KEY);
  if (geminiApiKey !== undefined) result.GEMINI_API_KEY = geminiApiKey;
  const vaultAddr = optionalValue(env.VAULT_ADDR);
  if (vaultAddr !== undefined) result.VAULT_ADDR = vaultAddr;
  const vaultToken = optionalValue(env.VAULT_TOKEN);
  if (vaultToken !== undefined) result.VAULT_TOKEN = vaultToken;
  const redisUrl = optionalValue(env.REDIS_URL);
  if (redisUrl !== undefined) result.REDIS_URL = redisUrl;

  return result;
}
