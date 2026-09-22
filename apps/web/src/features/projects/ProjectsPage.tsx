import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import {
  createProject,
  listProjectTypes,
  listWorkItems,
  type Project,
  type ProjectType,
} from '../../api-client.js';
import { ErrorAlert } from '../../components/ErrorAlert.js';
import { LoadingState } from '../../components/LoadingState.js';
import { StatusChip } from '../../components/StatusChip.js';
import { useOrganisationContext } from '../../organisation-context.js';
import { useProjectContext } from '../../project-context.js';

/**
 * DEVOS-225: the mockup's grid-of-cards layout (`Design/DevOS.dc.html` lines
 * 611-647) on existing real data/logic, using only real, already-available
 * fields — real `status`, and a real work-item count fetched the same
 * per-project fan-out `HomePage.tsx`/`WorkflowLibraryPage.tsx` already
 * established. The mockup's own health line (`p.health`) has no real data
 * source anywhere in this codebase and is deliberately omitted, not
 * fabricated — see specs/sprints/sprint-33/README.md's own grounding.
 */
export function ProjectsPage() {
  const { projects, selectedProjectId, selectProject, loading, error, refresh } =
    useProjectContext();
  const { organisations, selectedOrganisationId } = useOrganisationContext();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [organisationId, setOrganisationId] = useState(selectedOrganisationId ?? '');
  const [projectTypes, setProjectTypes] = useState<ProjectType[]>([]);
  const [projectTypeId, setProjectTypeId] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [workItemCounts, setWorkItemCounts] = useState<Record<string, number>>({});

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

  useEffect(() => {
    if (projects.length === 0) {
      setWorkItemCounts({});
      return;
    }
    let cancelled = false;

    Promise.all(
      projects.map((project) =>
        listWorkItems(project.id).then((result) => ({
          id: project.id,
          count: result.ok ? result.data.length : null,
        })),
      ),
    ).then((results) => {
      if (cancelled) return;
      const next: Record<string, number> = {};
      for (const { id, count } of results) {
        if (count !== null) next[id] = count;
      }
      setWorkItemCounts(next);
    });

    return () => {
      cancelled = true;
    };
  }, [projects]);

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

  function openProject(project: Project) {
    selectProject(project.id);
    navigate(`/projects/${project.id}`);
  }

  return (
    <section>
      <Typography variant="h4" component="h2" gutterBottom>
        Projects
      </Typography>

      {loading && <LoadingState label="Loading projects…" />}
      {error && <ErrorAlert message={`Failed to load projects: ${error}`} />}

      {!loading && !error && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0,1fr))' },
            gap: 1.5,
          }}
        >
          {projects.map((project) => (
            <Paper
              key={project.id}
              variant="outlined"
              onClick={() => openProject(project)}
              sx={{
                p: 2,
                cursor: 'pointer',
                ...(project.id === selectedProjectId ? { borderColor: 'primary.main' } : undefined),
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <Box
                  sx={{
                    display: 'grid',
                    placeItems: 'center',
                    width: 32,
                    height: 32,
                    borderRadius: 1,
                    bgcolor: 'action.selected',
                    color: 'primary.main',
                  }}
                >
                  <FolderIcon fontSize="small" />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body1" noWrap>
                    {project.name}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontFamily: 'monospace' }}
                  >
                    {project.slug}
                  </Typography>
                </Box>
                {project.id === selectedProjectId && (
                  <Box
                    sx={{
                      fontSize: 10.5,
                      px: 1,
                      py: 0.25,
                      borderRadius: 999,
                      bgcolor: 'action.selected',
                      color: 'primary.main',
                    }}
                  >
                    Current
                  </Box>
                )}
              </Stack>
              <Stack direction="row" spacing={3} sx={{ mt: 2 }}>
                <Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}
                  >
                    Status
                  </Typography>
                  <Box sx={{ mt: 0.5 }}>
                    <StatusChip status={project.status} />
                  </Box>
                </Box>
                <Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}
                  >
                    Work items
                  </Typography>
                  <Typography variant="body1" sx={{ mt: 0.5 }}>
                    {workItemCounts[project.id] ?? '—'}
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          ))}
          {projects.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              No projects yet.
            </Typography>
          )}
        </Box>
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
