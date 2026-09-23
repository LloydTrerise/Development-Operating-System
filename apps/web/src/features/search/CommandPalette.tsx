import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  Divider,
  List,
  ListItemButton,
  ListItemText,
  ListSubheader,
  TextField,
  Typography,
} from '@mui/material';
import { useProjectContext } from '../../project-context.js';
import { SearchResultGroups } from './SearchResultGroups.js';
import { useProjectSearch } from './use-project-search.js';

interface StaticAction {
  id: string;
  label: string;
  run: (context: { navigate: ReturnType<typeof useNavigate> }) => void;
}

/**
 * DEVOS-265: static command-to-route mapping, per `README.md`'s own
 * action-to-route audit. "Open project" is handled separately below (it
 * expands into a real project picker, not a single fixed destination).
 */
const STATIC_ACTIONS: StaticAction[] = [
  { id: 'start-workflow', label: 'Start workflow', run: ({ navigate }) => navigate('/runs') },
  { id: 'open-approval', label: 'Open approval', run: ({ navigate }) => navigate('/approvals') },
  { id: 'open-artifact', label: 'Open artifact', run: ({ navigate }) => navigate('/artifacts') },
  {
    id: 'open-run',
    label: 'Open workflow run',
    run: ({ navigate }) => navigate('/runs'),
  },
  { id: 'jump-to-agent', label: 'Jump to agent', run: ({ navigate }) => navigate('/agents') },
  {
    id: 'open-integration',
    label: 'Open integration',
    run: ({ navigate }) => navigate('/integrations'),
  },
  {
    id: 'view-activity',
    label: 'View recent activity',
    run: ({ navigate }) => navigate('/governance'),
  },
];

/**
 * DEVOS-265: the first global keyboard-triggered surface in this codebase.
 * Static action shortcuts (real routes only, `README.md`'s audit) plus the
 * same live entity search `GlobalSearch` uses (`useProjectSearch` +
 * `SearchResultGroups`), generalizing "search work" to every searchable
 * entity type rather than duplicating a second search implementation.
 */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { projects, selectedProjectId, selectProject } = useProjectContext();
  const [query, setQuery] = useState('');
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setShowProjectPicker(false);
      setHighlightedIndex(-1);
    }
  }, [open]);

  // DEVOS-265: every selectable row (static action, project, or search
  // result) carries `data-command-item` — real `ArrowUp`/`ArrowDown`/`Enter`
  // keyboard navigation walks that flat, DOM-order list rather than
  // duplicating a second "which row is selected" model per section.
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [query, showProjectPicker]);

  const { results, loading, error } = useProjectSearch(
    showProjectPicker ? null : selectedProjectId,
    query,
  );

  const filteredActions = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return STATIC_ACTIONS;
    return STATIC_ACTIONS.filter((action) => action.label.toLowerCase().includes(search));
  }, [query]);

  function close() {
    onClose();
  }

  function runAction(action: StaticAction) {
    action.run({ navigate });
    close();
  }

  function openProject(projectId: string) {
    selectProject(projectId);
    close();
    navigate(`/projects/${projectId}`);
  }

  function getItems(): HTMLElement[] {
    return Array.from(listRef.current?.querySelectorAll<HTMLElement>('[data-command-item]') ?? []);
  }

  function handleListKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      close();
      return;
    }
    const items = getItems();
    if (items.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const next = Math.min(highlightedIndex + 1, items.length - 1);
      setHighlightedIndex(next);
      items[next]?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      const next = Math.max(highlightedIndex - 1, 0);
      setHighlightedIndex(next);
      items[next]?.focus();
    } else if (event.key === 'Enter' && highlightedIndex >= 0) {
      event.preventDefault();
      items[highlightedIndex]?.click();
    }
  }

  const showLiveSearch = !showProjectPicker && query.trim().length >= 2;
  const openProjectMatches =
    !showProjectPicker && 'open project'.includes(query.trim().toLowerCase());

  return (
    <Dialog
      open={open}
      onClose={close}
      fullWidth
      maxWidth="sm"
      slotProps={{ paper: { sx: { position: 'fixed', top: 96 } } }}
    >
      <TextField
        data-testid="command-palette-input"
        autoFocus
        fullWidth
        variant="outlined"
        placeholder={showProjectPicker ? 'Choose a project…' : 'Type a command or search…'}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={handleListKeyDown}
        sx={{ p: 1, '.MuiOutlinedInput-notchedOutline': { border: 'none' } }}
      />
      <Divider />
      <List
        dense
        ref={listRef}
        sx={{ maxHeight: 420, overflowY: 'auto' }}
        data-testid="command-palette-list"
        onKeyDown={handleListKeyDown}
      >
        {showProjectPicker ? (
          <>
            <ListSubheader component="div">Open project</ListSubheader>
            {projects.map((project) => (
              <ListItemButton
                key={project.id}
                data-command-item
                onClick={() => openProject(project.id)}
              >
                <ListItemText primary={project.name} secondary={project.slug} />
              </ListItemButton>
            ))}
            {projects.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                No projects available.
              </Typography>
            )}
          </>
        ) : (
          <>
            {openProjectMatches && (
              <ListItemButton
                data-testid="command-open-project"
                data-command-item
                onClick={() => setShowProjectPicker(true)}
              >
                <ListItemText primary="Open project…" secondary="Switch to a different project" />
              </ListItemButton>
            )}
            {filteredActions.map((action) => (
              <ListItemButton key={action.id} data-command-item onClick={() => runAction(action)}>
                <ListItemText primary={action.label} />
              </ListItemButton>
            ))}
            {showLiveSearch && loading && (
              <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                Searching…
              </Typography>
            )}
            {showLiveSearch && !loading && error && (
              <Typography variant="body2" color="error" sx={{ p: 2 }}>
                Search failed: {error}
              </Typography>
            )}
            {showLiveSearch && !loading && !error && results && (
              <SearchResultGroups results={results} onNavigate={close} />
            )}
          </>
        )}
      </List>
    </Dialog>
  );
}
