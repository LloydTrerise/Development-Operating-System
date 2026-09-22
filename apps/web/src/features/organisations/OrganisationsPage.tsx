import { useState, type FormEvent } from 'react';
import {
  Box,
  Button,
  Collapse,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import { createOrganisation, updateOrganisation } from '../../api-client.js';
import { ErrorAlert } from '../../components/ErrorAlert.js';
import { LoadingState } from '../../components/LoadingState.js';
import { StatusChip } from '../../components/StatusChip.js';
import { useOrganisationContext } from '../../organisation-context.js';

function PanelHeader({ title }: { title: string }) {
  return (
    <Typography variant="subtitle1" sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
      {title}
    </Typography>
  );
}

/**
 * DEVOS-227: an inline, expand-in-place Settings affordance per row —
 * closes the real, disclosed `PATCH /organisations/:id` UI gap
 * (`updateOrganisation` already had a client wrapper; only the UI was
 * missing). This page itself is not restyled until Sprint 34
 * (specs/DEVOS-UI-UX-REDESIGN-BACKLOG.md §6.6, DEVOS-229) and has no detail
 * route yet, so a `/organisations/:id` route is deliberately not pre-built
 * this sprint — see specs/sprints/sprint-33/README.md's own grounding.
 * Owns the whole row (selectable button + settings trigger + collapsing
 * form below it) so the expanding panel renders as its own row, not
 * squeezed inside the flex-row `ListItemButton`.
 */
function OrganisationRow({
  organisationId,
  currentName,
  slug,
  status,
  selected,
  onSelect,
  onSaved,
}: {
  organisationId: string;
  currentName: string;
  slug: string;
  status: string;
  selected: boolean;
  onSelect: () => void;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    setSavedAt(null);
    const result = await updateOrganisation(organisationId, { name: name.trim() });
    setSaving(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    onSaved();
    setSavedAt(Date.now());
  }

  return (
    <Box>
      <ListItemButton selected={selected} onClick={onSelect}>
        <ListItemText primary={`${currentName} (${slug})`} sx={{ flex: 1 }} />
        <StatusChip status={status} />
        <IconButton
          aria-label={`Settings for ${currentName}`}
          size="small"
          onClick={(event) => {
            event.stopPropagation();
            setOpen((current) => !current);
          }}
        >
          <SettingsIcon fontSize="small" />
        </IconButton>
      </ListItemButton>
      <Collapse in={open} unmountOnExit>
        <Box
          component="form"
          onSubmit={handleSave}
          sx={{ display: 'flex', alignItems: 'center', gap: 1, pl: 2, pb: 1.5, pt: 0.5 }}
        >
          <TextField
            label="Name"
            size="small"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <Button type="submit" size="small" variant="outlined" disabled={saving || !name.trim()}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
          {savedAt && (
            <Typography variant="caption" color="success.main">
              Saved.
            </Typography>
          )}
          {error && <ErrorAlert message={error} />}
        </Box>
      </Collapse>
    </Box>
  );
}

export function OrganisationsPage() {
  const { organisations, selectedOrganisationId, selectOrganisation, loading, error, refresh } =
    useOrganisationContext();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError(null);

    const result = await createOrganisation({ name, slug });
    setSubmitting(false);

    if (!result.ok) {
      setSubmitError(result.error.message);
      return;
    }

    setName('');
    setSlug('');
    refresh();
    selectOrganisation(result.data.id);
  }

  return (
    <section>
      <Typography variant="h4" component="h2" gutterBottom>
        Organisations
      </Typography>

      {loading && <LoadingState label="Loading organisations…" />}
      {error && <ErrorAlert message={`Failed to load organisations: ${error}`} />}

      {!loading && !error && (
        <Paper variant="outlined">
          <PanelHeader title="Organisations" />
          <List dense sx={{ py: 0 }}>
            {organisations.map((organisation) => (
              <OrganisationRow
                key={organisation.id}
                organisationId={organisation.id}
                currentName={organisation.name}
                slug={organisation.slug}
                status={organisation.status}
                selected={organisation.id === selectedOrganisationId}
                onSelect={() => selectOrganisation(organisation.id)}
                onSaved={refresh}
              />
            ))}
            {organisations.length === 0 && (
              <ListItemText primary="No organisations yet." sx={{ px: 2, py: 1 }} />
            )}
          </List>
        </Paper>
      )}

      <Typography variant="h6" component="h3" sx={{ mt: 4 }} gutterBottom>
        New organisation
      </Typography>
      <Stack component="form" onSubmit={handleSubmit} spacing={2} sx={{ maxWidth: 360 }}>
        <TextField
          label="Name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          size="small"
        />
        <TextField
          label="Slug"
          value={slug}
          onChange={(event) => setSlug(event.target.value)}
          required
          size="small"
        />
        <Button
          type="submit"
          variant="contained"
          disabled={submitting}
          sx={{ alignSelf: 'flex-start' }}
        >
          {submitting ? 'Creating…' : 'Create organisation'}
        </Button>
        {submitError && <ErrorAlert message={submitError} />}
      </Stack>
    </section>
  );
}
