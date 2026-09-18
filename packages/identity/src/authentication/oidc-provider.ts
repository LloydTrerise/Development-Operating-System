import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import type { Principal } from '../principals/principal.js';
import type { AuthProvider } from './provider.js';

const BEARER_PREFIX = 'Bearer ';

export interface OidcAuthProviderOptions {
  /** The token's expected `iss` claim — also used for OIDC discovery (`{issuerUrl}/.well-known/openid-configuration`). */
  issuerUrl: string;
  /** The token's expected `aud` claim. */
  audience: string;
  /** Injectable for tests — defaults to real OIDC discovery + `createRemoteJWKSet`. */
  resolveKeySet?: () => Promise<JWTVerifyGetKey>;
  /** Injectable for tests — used only by the default discovery path. */
  fetchImpl?: typeof fetch;
}

interface OidcDiscoveryDocument {
  jwks_uri?: string;
}

async function discoverJwksUri(issuerUrl: string, fetchImpl: typeof fetch): Promise<string> {
  const discoveryUrl = `${issuerUrl.replace(/\/+$/, '')}/.well-known/openid-configuration`;
  let response: Response;
  try {
    response = await fetchImpl(discoveryUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown network error.';
    throw new Error(`OIDC discovery request to "${discoveryUrl}" failed: ${message}`, {
      cause: error,
    });
  }
  if (!response.ok) {
    throw new Error(
      `OIDC discovery request to "${discoveryUrl}" failed with status ${response.status}.`,
    );
  }
  const body = (await response.json()) as OidcDiscoveryDocument;
  if (typeof body.jwks_uri !== 'string' || body.jwks_uri.length === 0) {
    throw new Error(`OIDC discovery document at "${discoveryUrl}" has no "jwks_uri".`);
  }
  return body.jwks_uri;
}

/**
 * DEVOS-107: a real `AuthProvider` that validates a real OIDC-issued JWT
 * against the identity provider's real published keys (`jose`'s
 * `createRemoteJWKSet`, fed by real OIDC discovery —
 * `{issuerUrl}/.well-known/openid-configuration`'s own `jwks_uri`, not an
 * assumed URL convention), alongside the existing `createLocalAuthProvider`.
 * `Principal.id` is the token's `sub` claim — the standard OIDC "subject"
 * identifier — matching `createLocalAuthProvider`'s own existing
 * opaque-string-id contract exactly, so every caller that only reads
 * `principal.id` needs no change.
 *
 * The key set is resolved lazily (on first `authenticate` call, not at
 * construction) and cached for the life of this provider — `jose`'s
 * `createRemoteJWKSet` itself already caches individual keys internally;
 * this only avoids a discovery round-trip before the first token is seen.
 *
 * An invalid, expired, wrong-issuer/audience, or otherwise unverifiable
 * token resolves to `null` (not authenticated) rather than throwing — a
 * bad token is exactly the "not authenticated" case `AuthProvider`'s own
 * contract already models for a missing/malformed bearer header. Never
 * logs the token itself.
 */
export function createOidcAuthProvider(options: OidcAuthProviderOptions): AuthProvider {
  const fetchImpl = options.fetchImpl ?? fetch;
  let keySetPromise: Promise<JWTVerifyGetKey> | undefined;

  async function resolveKeySet(): Promise<JWTVerifyGetKey> {
    if (options.resolveKeySet) return options.resolveKeySet();
    keySetPromise ??= discoverJwksUri(options.issuerUrl, fetchImpl).then((jwksUri) =>
      createRemoteJWKSet(new URL(jwksUri)),
    );
    return keySetPromise;
  }

  return {
    async authenticate(authorizationHeader): Promise<Principal | null> {
      if (authorizationHeader === undefined || !authorizationHeader.startsWith(BEARER_PREFIX)) {
        return null;
      }
      const token = authorizationHeader.slice(BEARER_PREFIX.length).trim();
      if (token.length === 0) return null;

      try {
        const keySet = await resolveKeySet();
        const { payload } = await jwtVerify(token, keySet, {
          issuer: options.issuerUrl,
          audience: options.audience,
        });
        if (typeof payload.sub !== 'string' || payload.sub.length === 0) return null;
        return {
          id: payload.sub,
          ...(typeof payload.email === 'string' ? { email: payload.email } : {}),
        };
      } catch {
        return null;
      }
    },
  };
}
