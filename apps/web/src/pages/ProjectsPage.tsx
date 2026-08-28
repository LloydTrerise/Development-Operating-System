import { useEffect, useState, type FormEvent } from 'react';
import {
  Button,
  FormControl,
  InputLabel,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { createProject, listProjectTypes, type ProjectType } from '../api-client.js';
import { ErrorAlert } from '../components/ErrorAlert.js';
import { LoadingState } from '../components/LoadingState.js';
import { useOrganisationContext } from '../organisation-context.js';
import { useProjectContext } from '../project-context.js';

export function ProjectsPage() {
  const { projects, selectedProjectId, selectProject, loading, error, refresh } =
    useProjectContext();
  const { organisations, selectedOrganisationId } = useOrganisationContext();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [organisationId, setOrganisationId] = useState(selectedOrganisationId ?? '');
  const [projectTypes, setProjectTypes] = useState<ProjectType[]>([]);
  const [projectTypeId, setProjectTypeId] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!organisationId && selectedOrganisationId) {
      setOrganisationId(selectedOrganisationId);
    }
  }, [organisationId, selectedOrganisationId]);

  useEffect(() => {
    let cancelled = false;

    listProjectTypes().then((result) => {
      if (cancelled || !result.ok) return;
      setProjectTypes(result.data);
      setProjectTypeId((current) =>
        current && result.data.some((type) => type.id === current)
          ? current
          : (result.data.find((type) => type.status === 'ACTIVE')?.id ?? ''),
      );
    });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError(null);

    const result = await createProject({
      name,
      slug,
      projectTypeId,
      ...(organisationId ? { organisationId } : {}),
    });
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
        <FormControl size="small" required>
          <InputLabel id="project-organisation-label">Organisation</InputLabel>
          <Select
            labelId="project-organisation-label"
            label="Organisation"
            value={organisationId}
            onChange={(event) => setOrganisationId(event.target.value)}
          >
            {organisations.map((organisation) => (
              <MenuItem key={organisation.id} value={organisation.id}>
                {organisation.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" required>
          <InputLabel id="project-type-label">Project type</InputLabel>
          <Select
            labelId="project-type-label"
            label="Project type"
            value={projectTypeId}
            onChange={(event) => setProjectTypeId(event.target.value)}
          >
            {projectTypes.map((projectType) => (
              <MenuItem
                key={projectType.id}
                value={projectType.id}
                disabled={projectType.status !== 'ACTIVE'}
              >
                {projectType.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
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
          disabled={submitting || !projectTypeId}
          sx={{ alignSelf: 'flex-start' }}
        >
          {submitting ? 'Creating…' : 'Create project'}
        </Button>
        {submitError && <ErrorAlert message={submitError} />}
      </Stack>
    </section>
  );
}
