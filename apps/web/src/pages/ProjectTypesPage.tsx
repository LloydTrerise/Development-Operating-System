import { useEffect, useState, type FormEvent } from 'react';
import {
  Button,
  Divider,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  createProjectType,
  listProjectTypes,
  updateProjectType,
  type ProjectType,
} from '../api-client.js';
import { ErrorAlert } from '../components/ErrorAlert.js';
import { LoadingState } from '../components/LoadingState.js';
import { ProjectTypeAgentsEditor } from '../components/ProjectTypeAgentsEditor.js';
import { ProjectTypeWorkflowsEditor } from '../components/ProjectTypeWorkflowsEditor.js';

export function ProjectTypesPage() {
  const [projectTypes, setProjectTypes] = useState<ProjectType[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    listProjectTypes().then((result) => {
      if (cancelled) return;
      setLoading(false);

      if (!result.ok) {
        setError(result.error.message);
        return;
      }

      setError(null);
      setProjectTypes(result.data);
      setSelectedId((current) => {
        if (current && result.data.some((type) => type.id === current)) return current;
        return result.data[0]?.id ?? null;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError(null);

    const result = await createProjectType({
      key,
      name,
      ...(description ? { description } : {}),
    });
    setSubmitting(false);

    if (!result.ok) {
      setSubmitError(result.error.message);
      return;
    }

    setKey('');
    setName('');
    setDescription('');
    setSelectedId(result.data.id);
    setRefreshToken((token) => token + 1);
  }

  const selected = projectTypes.find((type) => type.id === selectedId) ?? null;

  async function toggleStatus() {
    if (!selected) return;
    setStatusUpdating(true);
    await updateProjectType(selected.id, {
      status: selected.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE',
    });
    setStatusUpdating(false);
    setRefreshToken((token) => token + 1);
  }

  return (
    <section>
      <Typography variant="h4" component="h2" gutterBottom>
        Project Types
      </Typography>

      {loading && <LoadingState label="Loading project types…" />}
      {error && <ErrorAlert message={`Failed to load project types: ${error}`} />}

      {!loading && !error && (
        <List dense>
          {projectTypes.map((projectType) => (
            <ListItemButton
              key={projectType.id}
              selected={projectType.id === selectedId}
              onClick={() => setSelectedId(projectType.id)}
            >
              <ListItemText
                primary={`${projectType.name} (${projectType.key})`}
                secondary={projectType.status}
              />
            </ListItemButton>
          ))}
          {projectTypes.length === 0 && <ListItemText primary="No project types yet." />}
        </List>
      )}

      <Typography variant="h6" component="h3" sx={{ mt: 4 }} gutterBottom>
        New project type
      </Typography>
      <Stack component="form" onSubmit={handleSubmit} spacing={2} sx={{ maxWidth: 360 }}>
        <TextField
          label="Key"
          value={key}
          onChange={(event) => setKey(event.target.value)}
          required
          size="small"
        />
        <TextField
          label="Name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          size="small"
        />
        <TextField
          label="Description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          size="small"
        />
        <Button
          type="submit"
          variant="contained"
          disabled={submitting}
          sx={{ alignSelf: 'flex-start' }}
        >
          {submitting ? 'Creating…' : 'Create project type'}
        </Button>
        {submitError && <ErrorAlert message={submitError} />}
      </Stack>

      {selected && (
        <>
          <Divider sx={{ my: 4 }} />
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
            <Typography variant="h5" component="h3">
              {selected.name}
            </Typography>
            <Button
              size="small"
              variant="outlined"
              disabled={statusUpdating}
              onClick={toggleStatus}
            >
              {selected.status === 'ACTIVE' ? 'Disable' : 'Activate'}
            </Button>
          </Stack>

          <ProjectTypeWorkflowsEditor projectTypeId={selected.id} />
          <Divider sx={{ my: 4 }} />
          <ProjectTypeAgentsEditor projectTypeId={selected.id} />
        </>
      )}
    </section>
  );
}
