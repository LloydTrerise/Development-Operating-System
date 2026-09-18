import { useEffect, useState, type FormEvent } from 'react';
import {
  Button,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import {
  createProjectTypeAgent,
  listProjectTypeAgents,
  updateProjectTypeAgent,
  type ProjectTypeAgent,
} from '../api-client.js';
import { ErrorAlert } from './ErrorAlert.js';
import { LoadingState } from './LoadingState.js';

interface AgentFormState {
  key: string;
  name: string;
  role: string;
  provider: string;
  modelRef: string;
  promptReference: string;
  allowedCapabilities: string;
}

const EMPTY_FORM: AgentFormState = {
  key: '',
  name: '',
  role: '',
  provider: '',
  modelRef: '',
  promptReference: '',
  allowedCapabilities: '',
};

function toFormState(agent: ProjectTypeAgent): AgentFormState {
  return {
    key: agent.key,
    name: agent.name,
    role: agent.configuration.role,
    provider: agent.configuration.provider,
    modelRef: agent.configuration.modelRef,
    promptReference: agent.promptReference ?? '',
    allowedCapabilities: agent.configuration.allowedCapabilities.join(', '),
  };
}

function parseCapabilities(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function ProjectTypeAgentsEditor({ projectTypeId }: { projectTypeId: string }) {
  const [agents, setAgents] = useState<ProjectTypeAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [form, setForm] = useState<AgentFormState>(EMPTY_FORM);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    listProjectTypeAgents(projectTypeId).then((result) => {
      if (cancelled) return;
      setLoading(false);

      if (!result.ok) {
        setError(result.error.message);
        return;
      }

      setError(null);
      setAgents(result.data);
    });

    return () => {
      cancelled = true;
    };
  }, [projectTypeId, refreshToken]);

  function startCreate() {
    setEditingKey(null);
    setForm(EMPTY_FORM);
    setSubmitError(null);
  }

  function startEdit(agent: ProjectTypeAgent) {
    setEditingKey(agent.key);
    setForm(toFormState(agent));
    setSubmitError(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError(null);

    const configuration = {
      role: form.role,
      provider: form.provider,
      modelRef: form.modelRef,
      allowedCapabilities: parseCapabilities(form.allowedCapabilities),
    };

    const result = editingKey
      ? await updateProjectTypeAgent(projectTypeId, editingKey, {
          name: form.name,
          configuration,
          ...(form.promptReference ? { promptReference: form.promptReference } : {}),
        })
      : await createProjectTypeAgent(projectTypeId, {
          key: form.key,
          name: form.name,
          configuration,
          ...(form.promptReference ? { promptReference: form.promptReference } : {}),
        });

    setSubmitting(false);

    if (!result.ok) {
      setSubmitError(result.error.message);
      return;
    }

    startCreate();
    setRefreshToken((token) => token + 1);
  }

  return (
    <section>
      <Typography variant="subtitle1" gutterBottom>
        Agent templates
      </Typography>

      {loading && <LoadingState label="Loading agent templates…" />}
      {error && <ErrorAlert message={`Failed to load agent templates: ${error}`} />}

      {!loading && !error && (
        <Table size="small" sx={{ mb: 2 }}>
          <TableHead>
            <TableRow>
              <TableCell>Key</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Provider</TableCell>
              <TableCell>Model</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {agents.map((agent) => (
              <TableRow key={agent.id} selected={editingKey === agent.key}>
                <TableCell>{agent.key}</TableCell>
                <TableCell>{agent.name}</TableCell>
                <TableCell>{agent.configuration.role}</TableCell>
                <TableCell>{agent.configuration.provider}</TableCell>
                <TableCell>{agent.configuration.modelRef}</TableCell>
                <TableCell>
                  <Button size="small" onClick={() => startEdit(agent)}>
                    Edit
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {agents.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>No agent templates yet.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      <Typography variant="body2" sx={{ mb: 1 }}>
        {editingKey ? `Editing "${editingKey}"` : 'New agent template'}
      </Typography>
      <Stack component="form" onSubmit={handleSubmit} spacing={2} sx={{ maxWidth: 420 }}>
        <TextField
          label="Key"
          value={form.key}
          onChange={(event) => setForm({ ...form, key: event.target.value })}
          required
          disabled={editingKey !== null}
          size="small"
        />
        <TextField
          label="Name"
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
          required
          size="small"
        />
        <TextField
          label="Role"
          value={form.role}
          onChange={(event) => setForm({ ...form, role: event.target.value })}
          required
          size="small"
          helperText="e.g. DISCOVERY, REQUIREMENTS, DEVELOPMENT, REVIEW"
        />
        <TextField
          label="Provider"
          value={form.provider}
          onChange={(event) => setForm({ ...form, provider: event.target.value })}
          required
          size="small"
        />
        <TextField
          label="Model reference"
          value={form.modelRef}
          onChange={(event) => setForm({ ...form, modelRef: event.target.value })}
          required
          size="small"
        />
        <TextField
          label="Prompt reference"
          value={form.promptReference}
          onChange={(event) => setForm({ ...form, promptReference: event.target.value })}
          size="small"
        />
        <TextField
          label="Allowed capabilities (comma-separated)"
          value={form.allowedCapabilities}
          onChange={(event) => setForm({ ...form, allowedCapabilities: event.target.value })}
          size="small"
        />
        <Stack direction="row" spacing={1}>
          <Button type="submit" variant="contained" disabled={submitting}>
            {submitting ? 'Saving…' : editingKey ? 'Save changes' : 'Create agent template'}
          </Button>
          {editingKey && (
            <Button onClick={startCreate} disabled={submitting}>
              Cancel
            </Button>
          )}
        </Stack>
        {submitError && <ErrorAlert message={submitError} />}
      </Stack>
    </section>
  );
}
