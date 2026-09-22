import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { createArtifact, listArtifacts, type Artifact } from '../../api-client.js';
import { ErrorAlert } from '../../components/ErrorAlert.js';
import { LoadingState } from '../../components/LoadingState.js';
import { StatusChip } from '../../components/StatusChip.js';
import { useProjectContext } from '../../project-context.js';

const ALL = 'All';

function formatDate(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

function PanelHeader({ title }: { title: string }) {
  return (
    <Typography variant="subtitle1" sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
      {title}
    </Typography>
  );
}

interface ArtifactFormState {
  artifactType: string;
  name: string;
  content: string;
  contentType: string;
}

const EMPTY_FORM: ArtifactFormState = { artifactType: '', name: '', content: '', contentType: '' };

/**
 * DEVOS-235: the Artifact Library — search, data-derived type/status filter
 * chips (mirroring `WorkItemsPage.tsx`'s DEVOS-212 convention), and a
 * creation form exercising DEVOS-234's `createArtifact` wrapper. Cross-project
 * and author filtering (`ui-spec.txt` §19) are not built: this page is
 * already scoped to the globally-selected project like every other
 * project-scoped page, and the `Artifact` DTO carries no `createdBy` field
 * to filter by (only `ArtifactVersion` does) — see
 * specs/sprints/sprint-35/README.md's own grounding.
 */
export function ArtifactLibraryPage() {
  const { selectedProjectId } = useProjectContext();
  const navigate = useNavigate();
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [form, setForm] = useState<ArtifactFormState>(EMPTY_FORM);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!selectedProjectId) {
      setArtifacts([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    listArtifacts(selectedProjectId).then((result) => {
      if (cancelled) return;
      setLoading(false);

      if (!result.ok) {
        setError(result.error.message);
        return;
      }

      setError(null);
      setArtifacts(result.data);
    });

    return () => {
      cancelled = true;
    };
  }, [selectedProjectId, reloadToken]);

  useEffect(() => {
    setTypeFilter(ALL);
    setStatusFilter(ALL);
    setSearch('');
  }, [selectedProjectId]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!selectedProjectId) return;

    setSubmitting(true);
    setSubmitError(null);

    const result = await createArtifact(selectedProjectId, {
      artifactType: form.artifactType,
      name: form.name,
      content: form.content,
      ...(form.contentType ? { contentType: form.contentType } : {}),
    });
    setSubmitting(false);

    if (!result.ok) {
      setSubmitError(result.error.message);
      return;
    }

    setForm(EMPTY_FORM);
    setReloadToken((token) => token + 1);
  }

  const types = useMemo(
    () => Array.from(new Set(artifacts.map((artifact) => artifact.type))).sort(),
    [artifacts],
  );
  const statuses = useMemo(
    () => Array.from(new Set(artifacts.map((artifact) => artifact.status))).sort(),
    [artifacts],
  );

  const visibleArtifacts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return artifacts.filter((artifact) => {
      if (typeFilter !== ALL && artifact.type !== typeFilter) return false;
      if (statusFilter !== ALL && artifact.status !== statusFilter) return false;
      if (query && !artifact.name.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [artifacts, typeFilter, statusFilter, search]);

  if (!selectedProjectId) {
    return (
      <section>
        <Typography variant="h4" component="h2" gutterBottom>
          Artifacts
        </Typography>
        <Typography color="text.secondary">Select a project to see its artifacts.</Typography>
      </section>
    );
  }

  return (
    <section>
      <Typography variant="h4" component="h2" gutterBottom>
        Artifacts
      </Typography>

      {loading && <LoadingState label="Loading artifacts…" />}
      {error && <ErrorAlert message={`Failed to load artifacts: ${error}`} />}

      {!loading && !error && (
        <Paper variant="outlined" sx={{ mb: 4 }}>
          <PanelHeader title={`Artifacts (${visibleArtifacts.length} of ${artifacts.length})`} />
          <Stack spacing={1} sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
            <TextField
              label="Search by name"
              size="small"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              sx={{ maxWidth: 320 }}
            />
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Chip
                label={`Type: ${ALL}`}
                size="small"
                color={typeFilter === ALL ? 'primary' : 'default'}
                onClick={() => setTypeFilter(ALL)}
              />
              {types.map((type) => (
                <Chip
                  key={type}
                  label={type}
                  size="small"
                  color={typeFilter === type ? 'primary' : 'default'}
                  onClick={() => setTypeFilter(type)}
                />
              ))}
            </Stack>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Chip
                label={`Status: ${ALL}`}
                size="small"
                color={statusFilter === ALL ? 'primary' : 'default'}
                onClick={() => setStatusFilter(ALL)}
              />
              {statuses.map((status) => (
                <Chip
                  key={status}
                  label={status}
                  size="small"
                  color={statusFilter === status ? 'primary' : 'default'}
                  onClick={() => setStatusFilter(status)}
                />
              ))}
            </Stack>
          </Stack>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Created</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {visibleArtifacts.map((artifact) => (
                  <TableRow
                    key={artifact.id}
                    hover
                    onClick={() => navigate(`/artifacts/${artifact.id}`)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell>{artifact.name}</TableCell>
                    <TableCell>{artifact.type}</TableCell>
                    <TableCell>
                      <StatusChip status={artifact.status} />
                    </TableCell>
                    <TableCell>{formatDate(artifact.createdAt)}</TableCell>
                  </TableRow>
                ))}
                {visibleArtifacts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4}>
                      <Typography color="text.secondary">
                        {artifacts.length === 0
                          ? 'No artifacts in this project yet.'
                          : 'No artifacts match this filter.'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      <Typography variant="h6" component="h3" gutterBottom>
        New artifact
      </Typography>
      <Stack component="form" onSubmit={handleSubmit} spacing={2} sx={{ maxWidth: 420 }}>
        <TextField
          label="Type"
          value={form.artifactType}
          onChange={(event) => setForm({ ...form, artifactType: event.target.value })}
          required
          size="small"
          helperText="e.g. CODE_CHANGE, PRD, TECHNICAL_DESIGN"
        />
        <TextField
          label="Name"
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
          required
          size="small"
        />
        <TextField
          label="Content"
          value={form.content}
          onChange={(event) => setForm({ ...form, content: event.target.value })}
          required
          multiline
          minRows={3}
          size="small"
        />
        <TextField
          label="Content type"
          value={form.contentType}
          onChange={(event) => setForm({ ...form, contentType: event.target.value })}
          size="small"
          helperText="Defaults to text/plain when left blank"
        />
        <Button
          type="submit"
          variant="contained"
          disabled={submitting}
          sx={{ alignSelf: 'flex-start' }}
        >
          {submitting ? 'Creating…' : 'Create artifact'}
        </Button>
        {submitError && <ErrorAlert message={submitError} />}
      </Stack>
    </section>
  );
}
