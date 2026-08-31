import type { Principal } from '../principals/principal.js';
import type { AuthProvider } from './provider.js';

const BEARER_PREFIX = 'Bearer ';

/**
 * Local development stand-in for a real OIDC provider (no spec defines one
 * yet). Trusts the bearer token's value as the principal id with no
 * credential verification — for local/dev use only, until a real provider
 * is implemented behind this same AuthProvider port.
 */
export function createLocalAuthProvider(): AuthProvider {
  return {
    async authenticate(authorizationHeader): Promise<Principal | null> {
      if (authorizationHeader === undefined || !authorizationHeader.startsWith(BEARER_PREFIX)) {
        return null;
      }

      const token = authorizationHeader.slice(BEARER_PREFIX.length).trim();
      if (token.length === 0) return null;

      return { id: token };
    },
  };
}
