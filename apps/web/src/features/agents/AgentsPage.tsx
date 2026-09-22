import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
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
import {
  createAgent,
  getAgentQuality,
  listAgentVersions,
  listAgents,
  type Agent,
  type AgentVersion,
  type AgentVersionQuality,
} from '../../api-client.js';
import { ErrorAlert } from '../../components/ErrorAlert.js';
import { LoadingState } from '../../components/LoadingState.js';
import { StatusChip } from '../../components/StatusChip.js';
import { useProjectContext } from '../../project-context.js';

interface AgentFormState {
  key: string;
  name: string;
  description: string;
  role: string;
  provider: string;
  modelRef: string;
  promptReference: string;
  allowedCapabilities: string;
}

const EMPTY_FORM: AgentFormState = {
  key: '',
  name: '',
  description: '',
  role: '',
  provider: '',
  modelRef: '',
  promptReference: '',
  allowedCapabilities: '',
};

function parseCapabilities(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function PanelHeader({ title }: { title: string }) {
  return (
    <Typography variant="subtitle1" sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
      {title}
    </Typography>
  );
}

/**
 * DEVOS-230: restyled into a summary table (`Paper`/`PanelHeader`, mirroring
 * `WorkItemsPage.tsx`'s DEVOS-212 dense-table convention) with row-click
 * navigation to a real `/agents/:id` detail view — the full per-version
 * table, quality figures, and Publish/Draft-new-version actions moved to
 * `AgentDetailPage.tsx`. See specs/sprints/sprint-34/DEVOS-230.md.
 */
export function AgentsPage() {
  const { selectedProjectId } = useProjectContext();
  const navigate = useNavigate();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [versionsByAgentId, setVersionsByAgentId] = useState<Record<string, AgentVersion[]>>({});
  const [qualityByAgentId, setQualityByAgentId] = useState<Record<string, AgentVersionQuality[]>>(
    {},
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [form, setForm] = useState<AgentFormState>(EMPTY_FORM);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!selectedProjectId) {
      setAgents([]);
      setVersionsByAgentId({});
      return;
    }

    let cancelled = false;
    setLoading(true);

    listAgents(selectedProjectId).then(async (result) => {
      if (cancelled) return;

      if (!result.ok) {
        setLoading(false);
        setError(result.error.message);
        return;
      }

      setError(null);
      setAgents(result.data);

      const versionResults = await Promise.all(
        result.data.map((agent) => listAgentVersions(agent.id)),
      );
      if (cancelled) return;

      const nextVersions: Record<string, AgentVersion[]> = {};
      result.data.forEach((agent, index) => {
        const versionResult = versionResults[index];
        if (versionResult?.ok) nextVersions[agent.id] = versionResult.data;
      });
      setVersionsByAgentId(nextVersions);
      setLoading(false);

      const qualityResults = await Promise.all(
        result.data.map((agent) => getAgentQuality(agent.id)),
      );
      if (cancelled) return;
      const nextQuality: Record<string, AgentVersionQuality[]> = {};
      result.data.forEach((agent, index) => {
        const qualityResult = qualityResults[index];
        if (qualityResult?.ok) nextQuality[agent.id] = qualityResult.data;
      });
      setQualityByAgentId(nextQuality);
    });

    return () => {
      cancelled = true;
    };
  }, [selectedProjectId, refreshToken]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!selectedProjectId) return;
    setSubmitting(true);
    setSubmitError(null);

    const result = await createAgent(selectedProjectId, {
      key: form.key,
      name: form.name,
      ...(form.description ? { description: form.description } : {}),
      configuration: {
        role: form.role,
        provider: form.provider,
        modelRef: form.modelRef,
        allowedCapabilities: parseCapabilities(form.allowedCapabilities),
      },
      ...(form.promptReference ? { promptReference: form.promptReference } : {}),
    });
    setSubmitting(false);

    if (!result.ok) {
      setSubmitError(result.error.message);
      return;
    }

    setForm(EMPTY_FORM);
    setRefreshToken((token) => token + 1);
  }

  if (!selectedProjectId) {
    return (
      <section>
        <Typography variant="h4" component="h2" gutterBottom>
          Agents
        </Typography>
        <Typography color="text.secondary">Select a project to manage its agents.</Typography>
      </section>
    );
  }

  return (
    <section>
      <Typography variant="h4" component="h2" gutterBottom>
        Agents
      </Typography>

      {loading && <LoadingState label="Loading agents…" />}
      {error && <ErrorAlert message={`Failed to load agents: ${error}`} />}

      {!loading && !error && (
        <Paper variant="outlined" sx={{ mb: 4 }}>
          <PanelHeader title="Agents" />
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Agent</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Latest version</TableCell>
                  <TableCell>Version status</TableCell>
                  <TableCell>Review pass rate</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {agents.map((agent) => {
                  const versions = [...(versionsByAgentId[agent.id] ?? [])].sort(
                    (a, b) => b.version - a.version,
                  );
                  const latest = versions[0];
                  const latestQuality = latest
                    ? (qualityByAgentId[agent.id] ?? []).find(
                        (q) => q.agentVersionId === latest.id,
                      )
                    : undefined;
                  return (
                    <TableRow
                      key={agent.id}
                      hover
                      onClick={() => navigate(`/agents/${agent.id}`)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell>
                        <Typography variant="body2">{agent.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {agent.key}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <StatusChip status={agent.status} />
                      </TableCell>
                      <TableCell>{latest ? `v${latest.version}` : '—'}</TableCell>
                      <TableCell>
                        {latest ? <StatusChip status={latest.status} /> : '—'}
                      </TableCell>
                      <TableCell>
                        {latestQuality
                          ? `${(latestQuality.passRate * 100).toFixed(0)}% (${latestQuality.reviewCount} reviewed)`
                          : 'No reviews yet'}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {agents.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <Typography color="text.secondary">
                        No agents in this project yet.
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
        New agent
      </Typography>
      <Stack component="form" onSubmit={handleSubmit} spacing={2} sx={{ maxWidth: 420 }}>
        <TextField
          label="Key"
          value={form.key}
          onChange={(event) => setForm({ ...form, key: event.target.value })}
          required
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
          label="Description"
          value={form.description}
          onChange={(event) => setForm({ ...form, description: event.target.value })}
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
        <Button
          type="submit"
          variant="contained"
          disabled={submitting}
          sx={{ alignSelf: 'flex-start' }}
        >
          {submitting ? 'Creating…' : 'Create agent'}
        </Button>
        {submitError && <ErrorAlert message={submitError} />}
      </Stack>
    </section>
  );
}
