import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { Auth0Provider, useAuth0 } from '@auth0/auth0-react';
import { DEV_PRINCIPAL_ID, setAccessTokenGetter } from './api-client.js';

const AUTH0_DOMAIN = import.meta.env.VITE_AUTH0_DOMAIN;
const AUTH0_CLIENT_ID = import.meta.env.VITE_AUTH0_CLIENT_ID;
const AUTH0_AUDIENCE = import.meta.env.VITE_AUTH0_AUDIENCE;

/**
 * DEVOS-107: real OIDC auth is only attempted when a real Auth0 tenant is
 * actually configured (all three VITE_AUTH0_* values set) — every existing
 * deployment/test without one keeps the original dev-identity behaviour
 * unchanged, matching the same optional-and-additive pattern used
 * throughout this sprint (`CredentialResolver`, `AuthProvider` on the
 * backend).
 */
const AUTH0_CONFIGURED = Boolean(AUTH0_DOMAIN && AUTH0_CLIENT_ID && AUTH0_AUDIENCE);

export type Session =
  | { status: 'dev-identity'; principalId: string }
  | { status: 'loading' }
  | { status: 'unauthenticated'; login: () => void }
  | { status: 'authenticated'; principalId: string; email?: string; logout: () => void };

const devSession: Session = { status: 'dev-identity', principalId: DEV_PRINCIPAL_ID };

const SessionContext = createContext<Session>(devSession);

/** Renders inside `Auth0Provider` — bridges its real hook state into the
 * app's own `Session` shape, and registers/clears the real access-token
 * getter `api-client.ts` calls on every authenticated request. */
function Auth0SessionBridge({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated, user, loginWithRedirect, logout, getAccessTokenSilently } =
    useAuth0();

  useEffect(() => {
    if (!isAuthenticated) {
      setAccessTokenGetter(null);
      return;
    }
    setAccessTokenGetter(() =>
      getAccessTokenSilently({ authorizationParams: { audience: AUTH0_AUDIENCE } }),
    );
    return () => setAccessTokenGetter(null);
  }, [isAuthenticated, getAccessTokenSilently]);

  let session: Session;
  if (isLoading) {
    session = { status: 'loading' };
  } else if (isAuthenticated && user?.sub) {
    session = {
      status: 'authenticated',
      principalId: user.sub,
      ...(user.email !== undefined ? { email: user.email } : {}),
      logout: () => logout({ logoutParams: { returnTo: window.location.origin } }),
    };
  } else {
    session = {
      status: 'unauthenticated',
      login: () => loginWithRedirect(),
    };
  }

  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

function Auth0SessionProvider({ children }: { children: ReactNode }) {
  return (
    <Auth0Provider
      domain={AUTH0_DOMAIN}
      clientId={AUTH0_CLIENT_ID}
      authorizationParams={{ redirect_uri: window.location.origin, audience: AUTH0_AUDIENCE }}
    >
      <Auth0SessionBridge>{children}</Auth0SessionBridge>
    </Auth0Provider>
  );
}

export function SessionProvider({ children }: { children: ReactNode }) {
  if (AUTH0_CONFIGURED) {
    return <Auth0SessionProvider>{children}</Auth0SessionProvider>;
  }
  return <SessionContext.Provider value={devSession}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  return useContext(SessionContext);
}
