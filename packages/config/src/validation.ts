import type { RawEnvironment } from './environment.js';

export interface ConfigValidationIssue {
  key: string;
  message: string;
}

export interface ConfigValidationResult {
  valid: boolean;
  issues: ConfigValidationIssue[];
}

export class ConfigValidationError extends Error {
  public readonly issues: ConfigValidationIssue[];

  constructor(issues: ConfigValidationIssue[]) {
    super(`Invalid configuration: ${issues.map((issue) => issue.key).join(', ')}`);
    this.name = 'ConfigValidationError';
    this.issues = issues;
  }
}

function validUrl(value: string | undefined, key: string, issues: ConfigValidationIssue[]): void {
  if (value === undefined) return;

  try {
    new URL(value);
  } catch {
    issues.push({
      key,
      message: `${key} must be a valid URL.`,
    });
  }
}

function validInteger(
  value: string | undefined,
  key: string,
  issues: ConfigValidationIssue[],
): void {
  if (value === undefined) return;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    issues.push({
      key,
      message: `${key} must be an integer between 1 and 65535.`,
    });
  }
}

export function validateEnvironment(env: RawEnvironment): ConfigValidationResult {
  const issues: ConfigValidationIssue[] = [];

  if (env.NODE_ENV !== undefined && !['development', 'test', 'production'].includes(env.NODE_ENV)) {
    issues.push({
      key: 'NODE_ENV',
      message: 'NODE_ENV must be development, test, or production.',
    });
  }

  validInteger(env.PORT, 'PORT', issues);

  if (env.DATABASE_URL === undefined || env.DATABASE_URL.trim().length === 0) {
    issues.push({ key: 'DATABASE_URL', message: 'DATABASE_URL is required.' });
  } else {
    validUrl(env.DATABASE_URL, 'DATABASE_URL', issues);
  }

  validUrl(env.QUEUE_URL, 'QUEUE_URL', issues);
  validUrl(env.STORAGE_ENDPOINT, 'STORAGE_ENDPOINT', issues);
  validUrl(env.AUTH_ISSUER_URL, 'AUTH_ISSUER_URL', issues);

  if (env.QUEUE_NAME !== undefined && env.QUEUE_NAME.trim().length === 0) {
    issues.push({
      key: 'QUEUE_NAME',
      message: 'QUEUE_NAME must not be empty when provided.',
    });
  }

  if (env.STORAGE_BUCKET !== undefined && env.STORAGE_BUCKET.trim().length === 0) {
    issues.push({
      key: 'STORAGE_BUCKET',
      message: 'STORAGE_BUCKET must not be empty when provided.',
    });
  }

  if (env.STORAGE_REGION !== undefined && env.STORAGE_REGION.trim().length === 0) {
    issues.push({
      key: 'STORAGE_REGION',
      message: 'STORAGE_REGION must not be empty when provided.',
    });
  }

  if (env.AUTH_AUDIENCE !== undefined && env.AUTH_AUDIENCE.trim().length === 0) {
    issues.push({
      key: 'AUTH_AUDIENCE',
      message: 'AUTH_AUDIENCE must not be empty when provided.',
    });
  }

  // GEMINI_API_KEY (DEVOS-035): optional here — only apps/worker's real
  // agent-task handler needs it, not every DevOS process — but never echo
  // the value itself in an issue message (matching every other secret in
  // this file, e.g. DATABASE_URL's embedded credentials).
  if (env.GEMINI_API_KEY !== undefined && env.GEMINI_API_KEY.trim().length === 0) {
    issues.push({
      key: 'GEMINI_API_KEY',
      message: 'GEMINI_API_KEY must not be empty when provided.',
    });
  }

  if (env.LOG_LEVEL !== undefined && !['debug', 'info', 'warn', 'error'].includes(env.LOG_LEVEL)) {
    issues.push({
      key: 'LOG_LEVEL',
      message: 'LOG_LEVEL must be debug, info, warn, or error.',
    });
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

export function assertEnvironment(env: RawEnvironment = {}): void {
  const result = validateEnvironment(env);

  if (!result.valid) {
    throw new ConfigValidationError(result.issues);
  }
}
