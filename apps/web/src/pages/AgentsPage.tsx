import { useEffect, useState, type FormEvent } from 'react';
import {
  Button,
  Chip,
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
  createAgent,
  createNewAgentVersion,
  getAgentQuality,
  listAgentVersions,
  listAgents,
  publishAgentVersion,
  type Agent,
  type AgentVersion,
  type AgentVersionQuality,
} from '../api-client.js';
import { ErrorAlert } from '../components/ErrorAlert.js';
import { LoadingState } from '../components/LoadingState.js';
import { useProjectContext } from '../project-context.js';

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

/**
 * DEVOS-173: the first web UI anywhere for real, non-template agents —
 * `Agent`/`AgentVersion` previously had no UI at all, only direct API
 * calls (confirmed by `specs/DEVOS-AGENT-PLATFORM-BACKLOG.md` §2 before
 * this task was scoped). Reuses `ProjectTypeAgentsEditor.tsx`'s own
 * configuration-field set and `CostPage.tsx`/`EngineeringIntelligencePage.tsx`'s
 * project-scoped page pattern.
 */
export function AgentsPage() {
  const { selectedProjectId } = useProjectContext();
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
  const [busyAgentId, setBusyAgentId] = useState<string | null>(null);

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

  async function handleDraftNewVersion(agentId: string) {
    setBusyAgentId(agentId);
    const result = await createNewAgentVersion(agentId);
    setBusyAgentId(null);
    if (!result.ok) {
      setSubmitError(result.error.message);
      return;
    }
    setRefreshToken((token) => token + 1);
  }

  async function handlePublish(agentId: string) {
    setBusyAgentId(agentId);
    const result = await publishAgentVersion(agentId);
    setBusyAgentId(null);
    if (!result.ok) {
      setSubmitError(result.error.message);
      return;
    }
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
        <Stack spacing={3} sx={{ mb: 4 }}>
          {agents.map((agent) => {
            const versions = [...(versionsByAgentId[agent.id] ?? [])].sort(
              (a, b) => b.version - a.version,
            );
            const latest = versions[0];
            const hasDraft = latest?.status === 'DRAFT';
            const qualityByVersionId = new Map(
              (qualityByAgentId[agent.id] ?? []).map((q) => [q.agentVersionId, q]),
            );
            return (
              <div key={agent.id}>
                <Typography variant="h6" component="h3">
                  {agent.name} <Chip size="small" label={agent.key} sx={{ ml: 1 }} />
                </Typography>
                <Table size="small" data-testid={`agent-versions-${agent.key}`}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Version</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Role</TableCell>
                      <TableCell>Model</TableCell>
                      <TableCell>Review pass rate</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {versions.map((version) => {
                      const quality = qualityByVersionId.get(version.id);
                      return (
                        <TableRow key={version.id}>
                          <TableCell>{version.version}</TableCell>
                          <TableCell>{version.status}</TableCell>
                          <TableCell>{version.configuration.role}</TableCell>
                          <TableCell>{version.configuration.modelRef}</TableCell>
                          <TableCell data-testid={`review-pass-rate-${version.id}`}>
                            {quality
                              ? `${(quality.passRate * 100).toFixed(0)}% (${quality.reviewCount} reviewed)`
                              : 'No reviews yet'}
                          </TableCell>
                          <TableCell>
                            {version.status === 'DRAFT' && (
                              <Button
                                size="small"
                                disabled={busyAgentId === agent.id}
                                onClick={() => handlePublish(agent.id)}
                              >
                                Publish
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {!hasDraft && (
                  <Button
                    size="small"
                    sx={{ mt: 1 }}
                    disabled={busyAgentId === agent.id}
                    onClick={() => handleDraftNewVersion(agent.id)}
                  >
                    Draft new version
                  </Button>
                )}
              </div>
            );
          })}
          {agents.length === 0 && (
            <Typography color="text.secondary">No agents in this project yet.</Typography>
          )}
        </Stack>
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
