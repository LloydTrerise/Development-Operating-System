import type { Principal } from '../principals/principal.js';

/**
 * DEVOS-107: `authenticate` returns a `Promise` (not the original
 * synchronous `Principal | null`) — real OIDC token validation
 * (`createOidcAuthProvider`) needs to fetch/verify against a real remote
 * JWKS, which is inherently asynchronous; `createLocalAuthProvider`'s own
 * synchronous bearer-token-as-id logic is trivially async-wrapped, so this
 * is the one shape both implementations can genuinely share.
 */
export interface AuthProvider {
  authenticate: (authorizationHeader: string | undefined) => Promise<Principal | null>;
}
