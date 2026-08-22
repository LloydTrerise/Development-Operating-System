import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { listProjects, type Project } from './api-client.js';

export interface ProjectContextValue {
  projects: Project[];
  selectedProjectId: string | null;
  selectProject: (projectId: string) => void;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    listProjects().then((result) => {
      if (cancelled) return;
      setLoading(false);

      if (!result.ok) {
        setError(result.error.message);
        return;
      }

      setError(null);
      setProjects(result.data);
      setSelectedProjectId((current) => {
        if (current && result.data.some((project) => project.id === current)) return current;
        return result.data[0]?.id ?? null;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  const selectProject = useCallback((projectId: string) => {
    setSelectedProjectId(projectId);
  }, []);

  const refresh = useCallback(() => {
    setRefreshToken((token) => token + 1);
  }, []);

  return (
    <ProjectContext.Provider
      value={{ projects, selectedProjectId, selectProject, loading, error, refresh }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProjectContext(): ProjectContextValue {
  const context = useContext(ProjectContext);
  if (!context) throw new Error('useProjectContext must be used within a ProjectProvider.');
  return context;
}
