import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { listOrganisations, type Organisation } from './api-client.js';

export interface OrganisationContextValue {
  organisations: Organisation[];
  selectedOrganisationId: string | null;
  selectOrganisation: (organisationId: string) => void;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

const OrganisationContext = createContext<OrganisationContextValue | null>(null);

export function OrganisationProvider({ children }: { children: ReactNode }) {
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [selectedOrganisationId, setSelectedOrganisationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    listOrganisations().then((result) => {
      if (cancelled) return;
      setLoading(false);

      if (!result.ok) {
        setError(result.error.message);
        return;
      }

      setError(null);
      setOrganisations(result.data);
      setSelectedOrganisationId((current) => {
        if (current && result.data.some((organisation) => organisation.id === current)) {
          return current;
        }
        return result.data[0]?.id ?? null;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  const selectOrganisation = useCallback((organisationId: string) => {
    setSelectedOrganisationId(organisationId);
  }, []);

  const refresh = useCallback(() => {
    setRefreshToken((token) => token + 1);
  }, []);

  return (
    <OrganisationContext.Provider
      value={{
        organisations,
        selectedOrganisationId,
        selectOrganisation,
        loading,
        error,
        refresh,
      }}
    >
      {children}
    </OrganisationContext.Provider>
  );
}

export function useOrganisationContext(): OrganisationContextValue {
  const context = useContext(OrganisationContext);
  if (!context) {
    throw new Error('useOrganisationContext must be used within an OrganisationProvider.');
  }
  return context;
}
