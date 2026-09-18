import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair, type KeyLike } from 'jose';
import { describe, expect, it, vi } from 'vitest';
import { createOidcAuthProvider } from '../src/authentication/oidc-provider.js';

const ISSUER = 'https://devos-test.example.auth0.com/';
const AUDIENCE = 'https://devos-api';
const KID = 'test-key-1';

interface SignTokenOverrides {
  sub?: string;
  email?: string;
  issuer?: string;
  audience?: string;
  expired?: boolean;
}

async function buildRealSignedProvider() {
  // A real RS256 keypair, generated fresh per test — signing/verification
  // below is a genuine cryptographic round-trip, not a mocked assertion.
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const publicJwk = await exportJWK(publicKey);
  const jwks = createLocalJWKSet({ keys: [{ ...publicJwk, kid: KID, alg: 'RS256', use: 'sig' }] });

  const provider = createOidcAuthProvider({
    issuerUrl: ISSUER,
    audience: AUDIENCE,
    resolveKeySet: async () => jwks,
  });

  async function signToken(overrides: SignTokenOverrides = {}, signingKey: KeyLike = privateKey) {
    return new SignJWT(overrides.email !== undefined ? { email: overrides.email } : {})
      .setProtectedHeader({ alg: 'RS256', kid: KID })
      .setSubject(overrides.sub ?? 'auth0|abc123')
      .setIssuedAt()
      .setIssuer(overrides.issuer ?? ISSUER)
      .setAudience(overrides.audience ?? AUDIENCE)
      .setExpirationTime(overrides.expired ? '-1h' : '1h')
      .sign(signingKey);
  }

  return { provider, signToken, privateKey };
}

describe('createOidcAuthProvider', () => {
  it('authenticates a real, validly signed token and resolves sub/email as the principal', async () => {
    const { provider, signToken } = await buildRealSignedProvider();
    const token = await signToken({ sub: 'auth0|abc123', email: 'alice@example.com' });

    await expect(provider.authenticate(`Bearer ${token}`)).resolves.toEqual({
      id: 'auth0|abc123',
      email: 'alice@example.com',
    });
  });

  it('resolves a principal without email when the token has no email claim', async () => {
    const { provider, signToken } = await buildRealSignedProvider();
    const token = await signToken({ sub: 'auth0|no-email' });

    await expect(provider.authenticate(`Bearer ${token}`)).resolves.toEqual({
      id: 'auth0|no-email',
    });
  });

  it('resolves null for a missing, non-bearer, or empty authorization header', async () => {
    const { provider } = await buildRealSignedProvider();

    await expect(provider.authenticate(undefined)).resolves.toBeNull();
    await expect(provider.authenticate('Basic dXNlcjpwYXNz')).resolves.toBeNull();
    await expect(provider.authenticate('Bearer ')).resolves.toBeNull();
  });

  it('rejects a token with the wrong issuer', async () => {
    const { provider, signToken } = await buildRealSignedProvider();
    const token = await signToken({ issuer: 'https://not-the-real-issuer.example.com/' });

    await expect(provider.authenticate(`Bearer ${token}`)).resolves.toBeNull();
  });

  it('rejects a token with the wrong audience', async () => {
    const { provider, signToken } = await buildRealSignedProvider();
    const token = await signToken({ audience: 'https://some-other-api' });

    await expect(provider.authenticate(`Bearer ${token}`)).resolves.toBeNull();
  });

  it('rejects an expired token', async () => {
    const { provider, signToken } = await buildRealSignedProvider();
    const token = await signToken({ expired: true });

    await expect(provider.authenticate(`Bearer ${token}`)).resolves.toBeNull();
  });

  it('rejects a token signed by an untrusted key (forged signature)', async () => {
    const { provider, signToken } = await buildRealSignedProvider();
    const { privateKey: attackerPrivateKey } = await generateKeyPair('RS256');
    const forgedToken = await signToken({ sub: 'attacker' }, attackerPrivateKey);

    await expect(provider.authenticate(`Bearer ${forgedToken}`)).resolves.toBeNull();
  });

  it('resolves null (fails closed) when OIDC discovery itself fails, without exposing the token', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('not found', { status: 404 }));
    const provider = createOidcAuthProvider({
      issuerUrl: ISSUER,
      audience: AUDIENCE,
      fetchImpl,
    });

    await expect(provider.authenticate('Bearer super-secret-looking-token')).resolves.toBeNull();
  });

  it('resolves null (fails closed) when the discovery document has no jwks_uri', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const provider = createOidcAuthProvider({ issuerUrl: ISSUER, audience: AUDIENCE, fetchImpl });

    await expect(provider.authenticate('Bearer some-token')).resolves.toBeNull();
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://devos-test.example.auth0.com/.well-known/openid-configuration',
    );
  });
});
