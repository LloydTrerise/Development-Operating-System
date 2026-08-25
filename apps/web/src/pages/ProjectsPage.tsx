import { useState, type FormEvent } from 'react';
import { Button, List, ListItemButton, ListItemText, Stack, TextField, Typography } from '@mui/material';
import { createProject } from '../api-client.js';
import { ErrorAlert } from '../components/ErrorAlert.js';
import { LoadingState } from '../components/LoadingState.js';
import { useProjectContext } from '../project-context.js';

export function ProjectsPage() {
  const { projects, selectedProjectId, selectProject, loading, error, refresh } =
    useProjectContext();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError(null);

    const result = await createProject({ name, slug });
    setSubmitting(false);

    if (!result.ok) {
      setSubmitError(result.error.message);
      return;
    }

    setName('');
    setSlug('');
    refresh();
    selectProject(result.data.id);
  }

  return (
    <section>
      <Typography variant="h4" component="h2" gutterBottom>
        Projects
      </Typography>

      {loading && <LoadingState label="Loading projects…" />}
      {error && <ErrorAlert message={`Failed to load projects: ${error}`} />}

      {!loading && !error && (
        <List dense>
          {projects.map((project) => (
            <ListItemButton
              key={project.id}
              selected={project.id === selectedProjectId}
              onClick={() => selectProject(project.id)}
            >
              <ListItemText primary={`${project.name} (${project.slug})`} />
            </ListItemButton>
          ))}
          {projects.length === 0 && <ListItemText primary="No projects yet." />}
        </List>
      )}

      <Typography variant="h6" component="h3" sx={{ mt: 4 }} gutterBottom>
        New project
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
          {submitting ? 'Creating…' : 'Create project'}
        </Button>
        {submitError && <ErrorAlert message={submitError} />}
      </Stack>
    </section>
  );
}
