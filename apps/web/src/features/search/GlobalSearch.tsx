import { useRef, useState } from 'react';
import { ClickAwayListener, Paper, Popper, TextField, Typography } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { useProjectContext } from '../../project-context.js';
import { SearchResultGroups } from './SearchResultGroups.js';
import { useProjectSearch } from './use-project-search.js';

/**
 * DEVOS-264: the real top-bar search input `App.tsx`'s `AppBar` never had
 * before this sprint (`README.md`'s grounding — the mockup's own search box
 * was never wired to a real component). Debounced via `useProjectSearch`
 * (shared with `CommandPalette`'s own live search section).
 */
export function GlobalSearch() {
  const { selectedProjectId } = useProjectContext();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);

  const { results, loading, error } = useProjectSearch(selectedProjectId, query);

  function close() {
    setOpen(false);
  }

  const showDropdown = open && query.trim().length >= 2;

  return (
    <ClickAwayListener onClickAway={close}>
      <div ref={anchorRef} style={{ position: 'relative' }}>
        <TextField
          data-testid="global-search-input"
          size="small"
          placeholder={
            selectedProjectId
              ? 'Search work, artifacts, workflows, agents…'
              : 'Select a project to search'
          }
          disabled={!selectedProjectId}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') close();
          }}
          slotProps={{
            input: {
              startAdornment: <SearchIcon fontSize="small" sx={{ mr: 1, opacity: 0.6 }} />,
            },
          }}
          sx={{
            minWidth: 260,
            '.MuiOutlinedInput-root': { color: 'inherit' },
            '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.4)' },
          }}
        />
        <Popper
          open={showDropdown}
          anchorEl={anchorRef.current}
          placement="bottom-start"
          style={{ zIndex: 1400, width: anchorRef.current?.clientWidth ?? 320 }}
        >
          <Paper variant="outlined" sx={{ mt: 0.5, maxHeight: 420, overflowY: 'auto' }}>
            {loading && (
              <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                Searching…
              </Typography>
            )}
            {!loading && error && (
              <Typography variant="body2" color="error" sx={{ p: 2 }}>
                Search failed: {error}
              </Typography>
            )}
            {!loading && !error && results && (
              <SearchResultGroups results={results} onNavigate={close} />
            )}
          </Paper>
        </Popper>
      </div>
    </ClickAwayListener>
  );
}
