import { useEffect, useMemo, useState, type FormEvent } from 'react';
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
import { createIntegration, listIntegrations, type Integration } from '../../api-client.js';
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

interface IntegrationFormState {
  type: string;
  provider: string;
  name: string;
  credentialReference: string;
  configuration: string;
}

const EMPTY_FORM: IntegrationFormState = {
  type: '',
  provider: '',
  name: '',
  credentialReference: '',
  configuration: '',
};

/**
 * DEVOS-241: the Integrations page — list + register form only, no detail
 * view. Unlike Artifacts/Agents/Knowledge, no `GET /integrations/:id` route
 * exists anywhere in this codebase (confirmed during Sprint 36's own
 * conversion grounding — `getIntegrationForPrincipal` exists at the
 * application layer but was never wired to a route), so rows are
 * deliberately not clickable and there is no `/integrations/:id` route to
 * navigate to. See specs/sprints/sprint-36/README.md's own grounding.
 */
export function IntegrationsPage() {
  const { selectedProjectId } = useProjectContext();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [form, setForm] = useState<IntegrationFormState>(EMPTY_FORM);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!selectedProjectId) {
      setIntegrations([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    listIntegrations(selectedProjectId).then((result) => {
      if (cancelled) return;
      setLoading(false);

      if (!result.ok) {
        setError(result.error.message);
        return;
      }

      setError(null);
      setIntegrations(result.data);
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

    let configuration: Record<string, unknown> | undefined;
    if (form.configuration.trim().length > 0) {
      try {
        const parsed: unknown = JSON.parse(form.configuration);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          setSubmitError('Configuration must be a JSON object.');
          return;
        }
        configuration = parsed as Record<string, unknown>;
      } catch {
        setSubmitError('Configuration is not valid JSON.');
        return;
      }
    }

    setSubmitting(true);
    setSubmitError(null);

    const result = await createIntegration(selectedProjectId, {
      type: form.type,
      provider: form.provider,
      name: form.name,
      credentialReference: form.credentialReference,
      ...(configuration !== undefined ? { configuration } : {}),
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
    () => Array.from(new Set(integrations.map((integration) => integration.type))).sort(),
    [integrations],
  );
  const statuses = useMemo(
    () => Array.from(new Set(integrations.map((integration) => integration.status))).sort(),
    [integrations],
  );

  const visibleIntegrations = useMemo(() => {
    const query = search.trim().toLowerCase();
    return integrations.filter((integration) => {
      if (typeFilter !== ALL && integration.type !== typeFilter) return false;
      if (statusFilter !== ALL && integration.status !== statusFilter) return false;
      if (query && !integration.name.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [integrations, typeFilter, statusFilter, search]);

  if (!selectedProjectId) {
    return (
      <section>
        <Typography variant="h4" component="h2" gutterBottom>
          Integrations
        </Typography>
        <Typography color="text.secondary">Select a project to see its integrations.</Typography>
      </section>
    );
  }

  return (
    <section>
      <Typography variant="h4" component="h2" gutterBottom>
        Integrations
      </Typography>

      {loading && <LoadingState label="Loading integrations…" />}
      {error && <ErrorAlert message={`Failed to load integrations: ${error}`} />}

      {!loading && !error && (
        <Paper variant="outlined" sx={{ mb: 4 }}>
          <PanelHeader title={`Integrations (${visibleIntegrations.length} of ${integrations.length})`} />
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
                  <TableCell>Provider</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Created</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {visibleIntegrations.map((integration) => (
                  <TableRow key={integration.id}>
                    <TableCell>{integration.name}</TableCell>
                    <TableCell>{integration.type}</TableCell>
                    <TableCell>{integration.provider}</TableCell>
                    <TableCell>
                      <StatusChip status={integration.status} />
                    </TableCell>
                    <TableCell>{formatDate(integration.createdAt)}</TableCell>
                  </TableRow>
                ))}
                {visibleIntegrations.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <Typography color="text.secondary">
                        {integrations.length === 0
                          ? 'No integrations in this project yet.'
                          : 'No integrations match this filter.'}
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
        New integration
      </Typography>
      <Stack component="form" onSubmit={handleSubmit} spacing={2} sx={{ maxWidth: 420 }}>
        <TextField
          label="Type"
          value={form.type}
          onChange={(event) => setForm({ ...form, type: event.target.value })}
          required
          size="small"
          helperText="'Git' or 'Deployment' are the only values real workflow tasks dispatch on"
        />
        <TextField
          label="Provider"
          value={form.provider}
          onChange={(event) => setForm({ ...form, provider: event.target.value })}
          required
          size="small"
          helperText="For a 'Git' integration: 'github' or 'gitlab' select the real pull-request provider"
        />
        <TextField
          label="Name"
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
          required
          size="small"
        />
        <TextField
          label="Credential reference"
          value={form.credentialReference}
          onChange={(event) => setForm({ ...form, credentialReference: event.target.value })}
          required
          size="small"
          helperText="A reference name resolved elsewhere — never a secret value itself"
        />
        <TextField
          label="Configuration"
          value={form.configuration}
          onChange={(event) => setForm({ ...form, configuration: event.target.value })}
          multiline
          minRows={3}
          size="small"
          helperText='Optional JSON object, e.g. {"github": {"owner": "...", "repo": "..."}}'
        />
        <Button
          type="submit"
          variant="contained"
          disabled={submitting}
          sx={{ alignSelf: 'flex-start' }}
        >
          {submitting ? 'Creating…' : 'Register integration'}
        </Button>
        {submitError && <ErrorAlert message={submitError} />}
      </Stack>
    </section>
  );
}
