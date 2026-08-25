import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createEnvCredentialResolver } from '../src/credential-resolver.js';

describe('createEnvCredentialResolver', () => {
  const REFERENCE = 'DEVOS_TEST_CREDENTIAL_REFERENCE';

  beforeEach(() => {
    delete process.env[REFERENCE];
  });
  afterEach(() => {
    delete process.env[REFERENCE];
  });

  it('resolves an existing environment variable by name', async () => {
    process.env[REFERENCE] = 'super-secret-value';
    const resolver = createEnvCredentialResolver();

    await expect(resolver.resolve(REFERENCE)).resolves.toBe('super-secret-value');
  });

  it('returns null for a reference with no matching environment variable', async () => {
    const resolver = createEnvCredentialResolver();

    await expect(resolver.resolve(REFERENCE)).resolves.toBeNull();
  });
});
