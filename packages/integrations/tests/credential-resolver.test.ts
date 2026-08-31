import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createEnvCredentialResolver,
  createVaultCredentialResolver,
} from '../src/credential-resolver.js';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

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

describe('createVaultCredentialResolver', () => {
  it('resolves a secret value from a KV v2 read response', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { data: { data: { value: 'super-secret-value' } } }));
    const resolver = createVaultCredentialResolver({
      address: 'http://localhost:8200',
      token: 'test-token',
      fetchImpl,
    });

    await expect(resolver.resolve('github/pat')).resolves.toBe('super-secret-value');

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:8200/v1/secret/data/github/pat');
    expect((init.headers as Record<string, string>)['X-Vault-Token']).toBe('test-token');
  });

  it('returns null for a 404 (no such secret)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
    const resolver = createVaultCredentialResolver({
      address: 'http://localhost:8200',
      token: 'test-token',
      fetchImpl,
    });

    await expect(resolver.resolve('missing/secret')).resolves.toBeNull();
  });

  it('throws, without exposing the token, on a non-2xx/404 response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('forbidden', { status: 403 }));
    const resolver = createVaultCredentialResolver({
      address: 'http://localhost:8200',
      token: 'super-secret-token',
      fetchImpl,
    });

    await expect(resolver.resolve('github/pat')).rejects.toThrow(/status 403/);
    await expect(resolver.resolve('github/pat')).rejects.not.toThrow(/super-secret-token/);
  });

  it('respects a custom mount path and strips leading/trailing slashes', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { data: { data: { value: 'v' } } }));
    const resolver = createVaultCredentialResolver({
      address: 'http://localhost:8200/',
      token: 'test-token',
      mountPath: 'devos-secrets',
      fetchImpl,
    });

    await resolver.resolve('/render/api-key');

    const [url] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:8200/v1/devos-secrets/data/render/api-key');
  });
});
