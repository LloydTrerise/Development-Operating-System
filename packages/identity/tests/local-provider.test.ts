import { describe, expect, it } from 'vitest';
import { createLocalAuthProvider } from '../src/authentication/local-provider.js';

describe('local auth provider', () => {
  it('resolves the principal id from a bearer token', () => {
    const provider = createLocalAuthProvider();

    expect(provider.authenticate('Bearer alice')).toEqual({ id: 'alice' });
  });

  it('rejects a missing authorization header', () => {
    const provider = createLocalAuthProvider();

    expect(provider.authenticate(undefined)).toBeNull();
  });

  it('rejects a non-bearer authorization header', () => {
    const provider = createLocalAuthProvider();

    expect(provider.authenticate('Basic dXNlcjpwYXNz')).toBeNull();
  });

  it('rejects an empty bearer token', () => {
    const provider = createLocalAuthProvider();

    expect(provider.authenticate('Bearer ')).toBeNull();
    expect(provider.authenticate('Bearer    ')).toBeNull();
  });
});
