import { useEffect, useState } from 'react';
import {
  Button,
  Chip,
  FormControl,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { installAgentVersion, listSharedAgentVersions, type SharedAgentVersion } from '../../api-client.js';
import { ErrorAlert } from '../../components/ErrorAlert.js';
import { LoadingState } from '../../components/LoadingState.js';
import { useOrganisationContext } from '../../organisation-context.js';
import { useProjectContext } from '../../project-context.js';

function PanelHeader({ title }: { title: string }) {
  return (
    <Typography variant="subtitle1" sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
      {title}
    </Typography>
  );
}

/**
 * DEVOS-245: the Agent Marketplace — browse every real agent version shared
 * across the caller's selected organisation (DEVOS-178's real
 * `listSharedAgentVersionsForOrganisation`, previously wired at the API
 * layer only) and install one into a different project in that same
 * organisation. `SharedAgentVersion` carries no `sourceProjectName` field
 * (a real, disclosed divergence from `SharedKnowledgeSource` — see
 * specs/sprints/sprint-37/README.md's grounding), so the source project's
 * name is resolved client-side from the caller's own already-loaded,
 * organisation-filtered `projects` list, falling back to the raw id when
 * the source project isn't in it.
 */
export function AgentMarketplacePage() {
  const { selectedOrganisationId } = useOrganisationContext();
  const { projects } = useProjectContext();
  const [versions, setVersions] = useState<SharedAgentVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [targetByVersionId, setTargetByVersionId] = useState<Record<string, string>>({});
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [installErrorByVersionId, setInstallErrorByVersionId] = useState<Record<string, string>>(
    {},
  );
  const [installedByVersionId, setInstalledByVersionId] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!selectedOrganisationId) {
      setVersions([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    listSharedAgentVersions(selectedOrganisationId).then((result) => {
      if (cancelled) return;
      setLoading(false);

      if (!result.ok) {
        setError(result.error.message);
        return;
      }

      setError(null);
      setVersions(result.data);
    });

    return () => {
      cancelled = true;
    };
  }, [selectedOrganisationId]);

  function projectName(projectId: string): string {
    return projects.find((project) => project.id === projectId)?.name ?? projectId;
  }

  async function handleInstall(version: SharedAgentVersion) {
    if (!selectedOrganisationId) return;
    const targetProjectId = targetByVersionId[version.id];
    if (!targetProjectId) return;

    setInstallingId(version.id);
    setInstallErrorByVersionId((current) => ({ ...current, [version.id]: '' }));
    const result = await installAgentVersion(selectedOrganisationId, version.id, targetProjectId);
    setInstallingId(null);

    if (!result.ok) {
      setInstallErrorByVersionId((current) => ({ ...current, [version.id]: result.error.message }));
      return;
    }

    setInstalledByVersionId((current) => ({
      ...current,
      [version.id]: `Installed as ${result.data.name} v${result.data.version.version}.`,
    }));
  }

  if (!selectedOrganisationId) {
    return (
      <section>
        <Typography variant="h4" component="h2" gutterBottom>
          Agent Marketplace
        </Typography>
        <Typography color="text.secondary">
          Select an organisation to browse its shared agent versions.
        </Typography>
      </section>
    );
  }

  return (
    <section>
      <Typography variant="h4" component="h2" gutterBottom>
        Agent Marketplace
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Agent versions other projects in your organisation have shared. Installing creates a real,
        independent copy in the project you choose.
      </Typography>

      {loading && <LoadingState label="Loading shared agent versions…" />}
      {error && <ErrorAlert message={`Failed to load shared agent versions: ${error}`} />}

      {!loading && !error && (
        <Paper variant="outlined">
          <PanelHeader title="Shared agent versions" />
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Agent</TableCell>
                  <TableCell>Version</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Provider</TableCell>
                  <TableCell>Model</TableCell>
                  <TableCell>Capabilities</TableCell>
                  <TableCell>Source project</TableCell>
                  <TableCell>Install</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {versions.map((version) => {
                  const installError = installErrorByVersionId[version.id];
                  const installedMessage = installedByVersionId[version.id];
                  const target = targetByVersionId[version.id] ?? '';
                  return (
                  <TableRow key={version.id}>
                    <TableCell>
                      <Typography variant="body2">{version.agentName}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {version.agentKey}
                      </Typography>
                    </TableCell>
                    <TableCell>v{version.version}</TableCell>
                    <TableCell>{version.configuration.role}</TableCell>
                    <TableCell>{version.configuration.provider}</TableCell>
                    <TableCell>{version.configuration.modelRef}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                        {version.configuration.allowedCapabilities.map((capability) => (
                          <Chip key={capability} size="small" label={capability} />
                        ))}
                        {version.configuration.allowedCapabilities.length === 0 && '—'}
                      </Stack>
                    </TableCell>
                    <TableCell>{projectName(version.sourceProjectId)}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <FormControl size="small" sx={{ minWidth: 160 }}>
                          <Select
                            displayEmpty
                            value={target}
                            onChange={(event) =>
                              setTargetByVersionId((current) => ({
                                ...current,
                                [version.id]: event.target.value,
                              }))
                            }
                          >
                            <MenuItem value="">
                              <em>Select project…</em>
                            </MenuItem>
                            {projects.map((project) => (
                              <MenuItem key={project.id} value={project.id}>
                                {project.name}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={installingId === version.id || !target}
                          onClick={() => handleInstall(version)}
                        >
                          {installingId === version.id ? 'Installing…' : 'Install'}
                        </Button>
                      </Stack>
                      {installError && <ErrorAlert message={installError} />}
                      {installedMessage && (
                        <Typography variant="caption" color="success.main">
                          {installedMessage}
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                  );
                })}
                {versions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <Typography color="text.secondary">
                        No agent versions shared in this organisation yet.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </section>
  );
}
