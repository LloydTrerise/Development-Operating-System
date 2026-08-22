import { useEffect, useState } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import { getHealth } from './api-client.js';
import { ApprovalsPage } from './pages/ApprovalsPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { ProjectsPage } from './pages/ProjectsPage.js';
import { RunsPage } from './pages/RunsPage.js';
import { WorkItemsPage } from './pages/WorkItemsPage.js';
import { useProjectContext } from './project-context.js';
import { useSession } from './session.js';

type ApiStatus = 'checking' | 'online' | 'offline';

function ProjectSelector() {
  const { projects, selectedProjectId, selectProject, loading, error } = useProjectContext();

  if (loading) return <span data-testid="project-selector-status">Loading projects…</span>;
  if (error)
    return <span data-testid="project-selector-status">Projects unavailable: {error}</span>;
  if (projects.length === 0) {
    return <span data-testid="project-selector-status">No projects yet.</span>;
  }

  return (
    <select
      data-testid="project-selector"
      value={selectedProjectId ?? ''}
      onChange={(event) => selectProject(event.target.value)}
    >
      {projects.map((project) => (
        <option key={project.id} value={project.id}>
          {project.name}
        </option>
      ))}
    </select>
  );
}

export function App() {
  const session = useSession();
  const [apiStatus, setApiStatus] = useState<ApiStatus>('checking');

  useEffect(() => {
    let cancelled = false;

    getHealth()
      .then((result) => {
        if (!cancelled) setApiStatus(result.ok ? 'online' : 'offline');
      })
      .catch(() => {
        if (!cancelled) setApiStatus('offline');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <header>
        <h1>DevOS</h1>
        <nav>
          <NavLink to="/">Dashboard</NavLink>
          <NavLink to="/projects">Projects</NavLink>
          <NavLink to="/work-items">Work Items</NavLink>
          <NavLink to="/runs">Runs</NavLink>
          <NavLink to="/approvals">Approvals</NavLink>
        </nav>
        <ProjectSelector />
        <span data-testid="api-status">API: {apiStatus}</span>
        <span data-testid="session-status">
          Session: {session.status} ({session.principalId})
        </span>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/work-items" element={<WorkItemsPage />} />
          <Route path="/runs" element={<RunsPage />} />
          <Route path="/approvals" element={<ApprovalsPage />} />
        </Routes>
      </main>
    </div>
  );
}
