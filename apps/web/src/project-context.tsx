import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { listProjects, type Project } from './api-client.js';
import { useOrganisationContext } from './organisation-context.js';

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
  const { selectedOrganisationId } = useOrganisationContext();
  const [allProjects, setAllProjects] = useState<Project[]>([]);
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
      setAllProjects(result.data);
    });

    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  // specs/architecture/organisations-and-project-types.md §10.2: the
  // project list is scoped to the selected organisation. There is no
  // organisation-scoped query parameter on GET /projects (it lists every
  // project the principal has access to), so this filters client-side
  // rather than expanding the API contract for it.
  const projects = useMemo(
    () =>
      selectedOrganisationId
        ? allProjects.filter((project) => project.organisationId === selectedOrganisationId)
        : allProjects,
    [allProjects, selectedOrganisationId],
  );

  useEffect(() => {
    setSelectedProjectId((current) => {
      if (current && projects.some((project) => project.id === current)) return current;
      return projects[0]?.id ?? null;
    });
  }, [projects]);

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
