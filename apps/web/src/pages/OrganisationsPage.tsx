import { useState, type FormEvent } from 'react';
import { Button, List, ListItemButton, ListItemText, Stack, TextField, Typography } from '@mui/material';
import { createOrganisation } from '../api-client.js';
import { ErrorAlert } from '../components/ErrorAlert.js';
import { LoadingState } from '../components/LoadingState.js';
import { useOrganisationContext } from '../organisation-context.js';

export function OrganisationsPage() {
  const {
    organisations,
    selectedOrganisationId,
    selectOrganisation,
    loading,
    error,
    refresh,
  } = useOrganisationContext();
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
        <List dense>
          {organisations.map((organisation) => (
            <ListItemButton
              key={organisation.id}
              selected={organisation.id === selectedOrganisationId}
              onClick={() => selectOrganisation(organisation.id)}
            >
              <ListItemText primary={`${organisation.name} (${organisation.slug})`} />
            </ListItemButton>
          ))}
          {organisations.length === 0 && <ListItemText primary="No organisations yet." />}
        </List>
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
        <Button type="submit" variant="contained" disabled={submitting} sx={{ alignSelf: 'flex-start' }}>
          {submitting ? 'Creating…' : 'Create organisation'}
        </Button>
        {submitError && <ErrorAlert message={submitError} />}
      </Stack>
    </section>
  );
}
