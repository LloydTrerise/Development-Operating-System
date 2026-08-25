import { useEffect, useState } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import {
  AppBar,
  Box,
  Divider,
  Drawer,
  FormControl,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Select,
  Toolbar,
  Typography,
} from '@mui/material';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import { getHealth } from './api-client.js';
import { ApprovalsPage } from './pages/ApprovalsPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { GovernancePage } from './pages/GovernancePage.js';
import { ProjectsPage } from './pages/ProjectsPage.js';
import { RunsPage } from './pages/RunsPage.js';
import { WorkItemsPage } from './pages/WorkItemsPage.js';
import { useProjectContext } from './project-context.js';
import { useSession } from './session.js';
import { useThemeMode } from './theme-mode-context.js';

type ApiStatus = 'checking' | 'online' | 'offline';

const DRAWER_WIDTH = 220;

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard' },
  { to: '/projects', label: 'Projects' },
  { to: '/work-items', label: 'Work Items' },
  { to: '/runs', label: 'Runs' },
  { to: '/approvals', label: 'Approvals' },
  { to: '/governance', label: 'Governance' },
] as const;

function ProjectSelector() {
  const { projects, selectedProjectId, selectProject, loading, error } = useProjectContext();

  if (loading) {
    return (
      <Typography data-testid="project-selector-status" variant="body2" component="span" color="inherit">
        Loading projects…
      </Typography>
    );
  }
  if (error) {
    return (
      <Typography data-testid="project-selector-status" variant="body2" component="span" color="inherit">
        Projects unavailable: {error}
      </Typography>
    );
  }
  if (projects.length === 0) {
    return (
      <Typography data-testid="project-selector-status" variant="body2" component="span" color="inherit">
        No projects yet.
      </Typography>
    );
  }

  return (
    <FormControl size="small" sx={{ minWidth: 180 }}>
      <Select
        value={selectedProjectId ?? ''}
        onChange={(event) => selectProject(event.target.value)}
        SelectDisplayProps={{ 'data-testid': 'project-selector' } as React.HTMLAttributes<HTMLDivElement>}
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

export function App() {
  const session = useSession();
  const { mode, toggleMode } = useThemeMode();
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
    <Box sx={{ display: 'flex' }}>
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar sx={{ gap: 2 }}>
          <Typography variant="h6" noWrap component="h1" sx={{ flexGrow: 1 }}>
            DevOS
          </Typography>
          <ProjectSelector />
          <Typography data-testid="api-status" variant="body2" component="span">
            API: {apiStatus}
          </Typography>
          <Typography data-testid="session-status" variant="body2" component="span">
            Session: {session.status} ({session.principalId})
          </Typography>
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
          {NAV_ITEMS.map(({ to, label }) => (
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
        </List>
      </Drawer>
      <Box component="main" sx={{ flexGrow: 1, p: 3, mt: 8 }}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/work-items" element={<WorkItemsPage />} />
          <Route path="/runs" element={<RunsPage />} />
          <Route path="/approvals" element={<ApprovalsPage />} />
          <Route path="/governance" element={<GovernancePage />} />
        </Routes>
      </Box>
    </Box>
  );
}
