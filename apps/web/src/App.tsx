import { useEffect, useState } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import {
  AppBar,
  Box,
  Button,
  Divider,
  Drawer,
  FormControl,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  ListSubheader,
  MenuItem,
  Select,
  Toolbar,
  Typography,
} from '@mui/material';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import { getHealth } from './api-client.js';
import { AgentDetailPage } from './features/agents/AgentDetailPage.js';
import { AgentMarketplacePage } from './features/agents/AgentMarketplacePage.js';
import { AgentsPage } from './features/agents/AgentsPage.js';
import { ApprovalsPage } from './features/approvals/ApprovalsPage.js';
import { ArtifactLibraryPage } from './features/artifacts/ArtifactLibraryPage.js';
import { ArtifactViewerPage } from './features/artifacts/ArtifactViewerPage.js';
import { CostPage } from './features/cost/CostPage.js';
import { HomePage } from './features/home/HomePage.js';
import { EngineeringIntelligencePage } from './features/engineering-intelligence/EngineeringIntelligencePage.js';
import { GovernancePage } from './features/governance/GovernancePage.js';
import { IntegrationsPage } from './features/integrations/IntegrationsPage.js';
import { KnowledgeMarketplacePage } from './features/knowledge/KnowledgeMarketplacePage.js';
import { KnowledgeSourceDetailPage } from './features/knowledge/KnowledgeSourceDetailPage.js';
import { KnowledgeSourcesPage } from './features/knowledge/KnowledgeSourcesPage.js';
import { OrganisationsPage } from './features/organisations/OrganisationsPage.js';
import { ProjectTypesPage } from './features/project-types/ProjectTypesPage.js';
import { ProjectDetailPage } from './features/projects/ProjectDetailPage.js';
import { ProjectsPage } from './features/projects/ProjectsPage.js';
import { RunDetailPage } from './features/runs/RunDetailPage.js';
import { RunsPage } from './features/runs/RunsPage.js';
import { CommandPalette } from './features/search/CommandPalette.js';
import { GlobalSearch } from './features/search/GlobalSearch.js';
import { WorkItemDetailPage } from './features/work-items/WorkItemDetailPage.js';
import { WorkItemsPage } from './features/work-items/WorkItemsPage.js';
import { WorkflowLibraryPage } from './features/workflow-library/WorkflowLibraryPage.js';
import { WorkflowsPage } from './features/workflows/WorkflowsPage.js';
import { useOrganisationContext } from './organisation-context.js';
import { useProjectContext } from './project-context.js';
import { useSession } from './session.js';
import { useThemeMode } from './theme-mode-context.js';

type ApiStatus = 'checking' | 'online' | 'offline';

const DRAWER_WIDTH = 220;

/**
 * Grouped per Design/DevOS.dc.html's own navGroups mockup shape
 * (Overview/Work/Workflows/Decisions/Platform). The mockup's own IA only
 * names 10 of today's 14 real pages; the remaining 4 (Project Types,
 * Workflow Library, Cost, Engineering Intelligence) are placed here as a
 * disclosed assumption (specs/sprints/sprint-29/DEVOS-204.md) — Project
 * Types under Platform (a platform-level template catalog, not a single
 * workflow run), Workflow Library under Workflows (filling the mockup's
 * "Definitions" slot), Cost/Engineering Intelligence under Platform as
 * their own entries. Artifacts is populated for real by Sprint 35's
 * DEVOS-235; Integrations is populated for real by Sprint 36's DEVOS-241.
 */
const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [{ to: '/', label: 'Home' }],
  },
  {
    label: 'Work',
    items: [
      { to: '/work-items', label: 'Work Items' },
      { to: '/runs', label: 'Runs' },
    ],
  },
  {
    label: 'Workflows',
    items: [
      { to: '/workflows', label: 'Workflows' },
      { to: '/workflow-library', label: 'Workflow Library' },
    ],
  },
  {
    label: 'Decisions',
    items: [
      { to: '/approvals', label: 'Approvals' },
      { to: '/governance', label: 'Governance' },
    ],
  },
  {
    label: 'Platform',
    items: [
      { to: '/organisations', label: 'Organisations' },
      { to: '/projects', label: 'Projects' },
      { to: '/project-types', label: 'Project Types' },
      { to: '/agents', label: 'Agents' },
      { to: '/agents/marketplace', label: 'Agent Marketplace' },
      { to: '/knowledge', label: 'Knowledge' },
      { to: '/knowledge/marketplace', label: 'Knowledge Marketplace' },
      { to: '/cost', label: 'Cost' },
      { to: '/engineering-intelligence', label: 'Engineering Intelligence' },
    ],
  },
  { label: 'Artifacts', items: [{ to: '/artifacts', label: 'Artifacts' }] },
  { label: 'Integrations', items: [{ to: '/integrations', label: 'Integrations' }] },
] as const;

function OrganisationSelector() {
  const { organisations, selectedOrganisationId, selectOrganisation, loading, error } =
    useOrganisationContext();

  if (loading) {
    return (
      <Typography
        data-testid="organisation-selector-status"
        variant="body2"
        component="span"
        color="inherit"
      >
        Loading organisations…
      </Typography>
    );
  }
  if (error) {
    return (
      <Typography
        data-testid="organisation-selector-status"
        variant="body2"
        component="span"
        color="inherit"
      >
        Organisations unavailable: {error}
      </Typography>
    );
  }
  if (organisations.length === 0) {
    return (
      <Typography
        data-testid="organisation-selector-status"
        variant="body2"
        component="span"
        color="inherit"
      >
        No organisations yet.
      </Typography>
    );
  }

  return (
    <FormControl size="small" sx={{ minWidth: 180 }}>
      <Select
        value={selectedOrganisationId ?? ''}
        onChange={(event) => selectOrganisation(event.target.value)}
        SelectDisplayProps={
          { 'data-testid': 'organisation-selector' } as React.HTMLAttributes<HTMLDivElement>
        }
        sx={{
          color: 'inherit',
          '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.4)' },
          '.MuiSvgIcon-root': { color: 'inherit' },
        }}
      >
        {organisations.map((organisation) => (
          <MenuItem key={organisation.id} value={organisation.id}>
            {organisation.name}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

function ProjectSelector() {
  const { projects, selectedProjectId, selectProject, loading, error } = useProjectContext();

  if (loading) {
    return (
      <Typography
        data-testid="project-selector-status"
        variant="body2"
        component="span"
        color="inherit"
      >
        Loading projects…
      </Typography>
    );
  }
  if (error) {
    return (
      <Typography
        data-testid="project-selector-status"
        variant="body2"
        component="span"
        color="inherit"
      >
        Projects unavailable: {error}
      </Typography>
    );
  }
  if (projects.length === 0) {
    return (
      <Typography
        data-testid="project-selector-status"
        variant="body2"
        component="span"
        color="inherit"
      >
        No projects yet.
      </Typography>
    );
  }

  return (
    <FormControl size="small" sx={{ minWidth: 180 }}>
      <Select
        value={selectedProjectId ?? ''}
        onChange={(event) => selectProject(event.target.value)}
        SelectDisplayProps={
          { 'data-testid': 'project-selector' } as React.HTMLAttributes<HTMLDivElement>
        }
        sx={{
          color: 'inherit',
          '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.4)' },
          '.MuiSvgIcon-root': { color: 'inherit' },
        }}
      >
        {projects.map((project) => (
          <MenuItem key={project.id} value={project.id}>
            {project.name}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

function SessionStatus() {
  const session = useSession();

  switch (session.status) {
    case 'dev-identity':
      return (
        <Typography data-testid="session-status" variant="body2" component="span">
          Session: dev-identity ({session.principalId})
        </Typography>
      );
    case 'loading':
      return (
        <Typography data-testid="session-status" variant="body2" component="span">
          Signing in…
        </Typography>
      );
    case 'unauthenticated':
      return (
        <Button data-testid="session-login" color="inherit" size="small" onClick={session.login}>
          Log in
        </Button>
      );
    case 'authenticated':
      return (
        <>
          <Typography data-testid="session-status" variant="body2" component="span">
            {session.email ?? session.principalId}
          </Typography>
          <Button
            data-testid="session-logout"
            color="inherit"
            size="small"
            onClick={session.logout}
          >
            Log out
          </Button>
        </>
      );
  }
}

export function App() {
  const { mode, toggleMode } = useThemeMode();
  const [apiStatus, setApiStatus] = useState<ApiStatus>('checking');
  const [paletteOpen, setPaletteOpen] = useState(false);

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

  // DEVOS-265: the first global keyboard shortcut in this codebase — Cmd+K
  // on macOS, Ctrl+K elsewhere, preventDefault()'d so it doesn't collide
  // with any browser/OS default binding.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen(true);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar sx={{ gap: 2 }}>
          <Typography variant="h6" noWrap component="h1" sx={{ flexGrow: 1 }}>
            DevOS
          </Typography>
          <OrganisationSelector />
          <ProjectSelector />
          <GlobalSearch />
          <Typography data-testid="api-status" variant="body2" component="span">
            API: {apiStatus}
          </Typography>
          <SessionStatus />
          <IconButton
            color="inherit"
            onClick={toggleMode}
            aria-label={mode === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            {mode === 'light' ? <DarkModeIcon /> : <LightModeIcon />}
          </IconButton>
        </Toolbar>
      </AppBar>
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
        }}
      >
        <Toolbar />
        <Divider />
        <List>
          {NAV_GROUPS.map((group) => (
            <li key={group.label}>
              <ul style={{ padding: 0 }}>
                <ListSubheader component="div">{group.label}</ListSubheader>
                {group.items.map(({ to, label }) => (
                  <ListItemButton
                    key={to}
                    component={NavLink}
                    to={to}
                    end={to === '/'}
                    sx={{ '&.active': { bgcolor: 'action.selected' } }}
                  >
                    <ListItemText primary={label} />
                  </ListItemButton>
                ))}
              </ul>
            </li>
          ))}
        </List>
      </Drawer>
      <Box component="main" sx={{ flexGrow: 1, p: 3, mt: 8 }}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/organisations" element={<OrganisationsPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          {/* DEVOS-225/226/227: the `/{area}/:id` convention's real Projects
              detail page — identity, membership panel, rename settings. */}
          <Route path="/projects/:id" element={<ProjectDetailPage />} />
          <Route path="/project-types" element={<ProjectTypesPage />} />
          <Route path="/work-items" element={<WorkItemsPage />} />
          {/* DEVOS-206 scaffolding proof of concept for the /{area}/:id convention; replaced with real content by Sprint 31's DEVOS-213. */}
          <Route path="/work-items/:id" element={<WorkItemDetailPage />} />
          <Route path="/agents" element={<AgentsPage />} />
          {/* DEVOS-245: a static path, ranks above the dynamic `/agents/:id`
              route below regardless of declaration order. */}
          <Route path="/agents/marketplace" element={<AgentMarketplacePage />} />
          {/* DEVOS-230: the `/{area}/:id` convention's real Agent detail view. */}
          <Route path="/agents/:id" element={<AgentDetailPage />} />
          <Route path="/knowledge" element={<KnowledgeSourcesPage />} />
          {/* DEVOS-248: a static path, ranks above the dynamic `/knowledge/:id`
              route below regardless of declaration order. */}
          <Route path="/knowledge/marketplace" element={<KnowledgeMarketplacePage />} />
          {/* DEVOS-231: the `/{area}/:id` convention's real Knowledge Source detail view. */}
          <Route path="/knowledge/:id" element={<KnowledgeSourceDetailPage />} />
          <Route path="/workflows" element={<WorkflowsPage />} />
          <Route path="/workflow-library" element={<WorkflowLibraryPage />} />
          <Route path="/runs" element={<RunsPage />} />
          {/* Sprint 41 gap closure: the `/{area}/:id` convention's real Run
              detail view — `GET /runs/:runId` already existed, unwired. */}
          <Route path="/runs/:id" element={<RunDetailPage />} />
          <Route path="/approvals" element={<ApprovalsPage />} />
          <Route path="/governance" element={<GovernancePage />} />
          <Route path="/cost" element={<CostPage />} />
          <Route path="/engineering-intelligence" element={<EngineeringIntelligencePage />} />
          <Route path="/artifacts" element={<ArtifactLibraryPage />} />
          {/* DEVOS-236: the `/{area}/:id` convention's real Artifact Viewer. */}
          <Route path="/artifacts/:id" element={<ArtifactViewerPage />} />
          {/* DEVOS-241: list + register only, no `/integrations/:id` route —
              no backend GET-by-id route exists to back one. */}
          <Route path="/integrations" element={<IntegrationsPage />} />
        </Routes>
      </Box>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </Box>
  );
}
