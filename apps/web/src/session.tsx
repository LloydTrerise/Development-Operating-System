import { createContext, useContext, type ReactNode } from 'react';
import { DEV_PRINCIPAL_ID } from './api-client.js';

/**
 * Real authentication (Bearer/OIDC session token per
 * specs/api/poc-api-contracts.md) is not implemented yet — there is no
 * login UI. Every request is made as DEV_PRINCIPAL_ID (see api-client.ts),
 * so the session simply reflects that fixed identity.
 */
export interface Session {
  status: 'dev-identity';
  principalId: string;
}

const devSession: Session = { status: 'dev-identity', principalId: DEV_PRINCIPAL_ID };

const SessionContext = createContext<Session>(devSession);

export function SessionProvider({ children }: { children: ReactNode }) {
  return <SessionContext.Provider value={devSession}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  return useContext(SessionContext);
}
