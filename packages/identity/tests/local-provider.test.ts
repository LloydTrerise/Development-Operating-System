import { describe, expect, it } from 'vitest';
import { createLocalAuthProvider } from '../src/authentication/local-provider.js';

describe('local auth provider', () => {
  it('resolves the principal id from a bearer token', async () => {
    const provider = createLocalAuthProvider();

    await expect(provider.authenticate('Bearer alice')).resolves.toEqual({ id: 'alice' });
  });

  it('rejects a missing authorization header', async () => {
    const provider = createLocalAuthProvider();

    await expect(provider.authenticate(undefined)).resolves.toBeNull();
  });

  it('rejects a non-bearer authorization header', async () => {
    const provider = createLocalAuthProvider();

    await expect(provider.authenticate('Basic dXNlcjpwYXNz')).resolves.toBeNull();
  });

  it('rejects an empty bearer token', async () => {
    const provider = createLocalAuthProvider();

    await expect(provider.authenticate('Bearer ')).resolves.toBeNull();
    await expect(provider.authenticate('Bearer    ')).resolves.toBeNull();
  });
});
