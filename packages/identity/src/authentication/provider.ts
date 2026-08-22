import type { Principal } from '../principals/principal.js';

export interface AuthProvider {
  authenticate: (authorizationHeader: string | undefined) => Principal | null;
}
