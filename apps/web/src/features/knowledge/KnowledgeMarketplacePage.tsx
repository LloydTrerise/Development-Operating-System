import { useEffect, useState } from 'react';
import {
  Button,
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
import {
  installKnowledgeSource,
  listSharedKnowledgeSources,
  type SharedKnowledgeSource,
} from '../../api-client.js';
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
 * DEVOS-248: the Knowledge Marketplace — browse every real knowledge source
 * shared across the caller's selected organisation (DEVOS-189's real
 * `listSharedKnowledgeSourcesForOrganisation`, previously wired at the API
 * layer only) and install one into a different project in that same
 * organisation. Unlike `AgentMarketplacePage.tsx`, `SharedKnowledgeSource`
 * already carries `sourceProjectName` directly (see
 * specs/sprints/sprint-38/README.md's grounding), so no client-side name
 * resolution against `useProjectContext()`'s `projects` list is needed —
 * that list is used only to populate the install-target picker.
 */
export function KnowledgeMarketplacePage() {
  const { selectedOrganisationId } = useOrganisationContext();
  const { projects } = useProjectContext();
  const [sources, setSources] = useState<SharedKnowledgeSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [targetBySourceId, setTargetBySourceId] = useState<Record<string, string>>({});
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [installErrorBySourceId, setInstallErrorBySourceId] = useState<Record<string, string>>(
    {},
  );
  const [installedBySourceId, setInstalledBySourceId] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!selectedOrganisationId) {
      setSources([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    listSharedKnowledgeSources(selectedOrganisationId).then((result) => {
      if (cancelled) return;
      setLoading(false);

      if (!result.ok) {
        setError(result.error.message);
        return;
      }

      setError(null);
      setSources(result.data);
    });

    return () => {
      cancelled = true;
    };
  }, [selectedOrganisationId]);

  async function handleInstall(source: SharedKnowledgeSource) {
    if (!selectedOrganisationId) return;
    const targetProjectId = targetBySourceId[source.id];
    if (!targetProjectId) return;

    setInstallingId(source.id);
    setInstallErrorBySourceId((current) => ({ ...current, [source.id]: '' }));
    const result = await installKnowledgeSource(selectedOrganisationId, source.id, targetProjectId);
    setInstallingId(null);

    if (!result.ok) {
      setInstallErrorBySourceId((current) => ({ ...current, [source.id]: result.error.message }));
      return;
    }

    setInstalledBySourceId((current) => ({
      ...current,
      [source.id]: `Installed as ${result.data.name}.`,
    }));
  }

  if (!selectedOrganisationId) {
    return (
      <section>
        <Typography variant="h4" component="h2" gutterBottom>
          Knowledge Marketplace
        </Typography>
        <Typography color="text.secondary">
          Select an organisation to browse its shared knowledge sources.
        </Typography>
      </section>
    );
  }

  return (
    <section>
      <Typography variant="h4" component="h2" gutterBottom>
        Knowledge Marketplace
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Knowledge sources other projects in your organisation have shared. Installing creates a
        real, independent copy in the project you choose.
      </Typography>

      {loading && <LoadingState label="Loading shared knowledge sources…" />}
      {error && <ErrorAlert message={`Failed to load shared knowledge sources: ${error}`} />}

      {!loading && !error && (
        <Paper variant="outlined">
          <PanelHeader title="Shared knowledge sources" />
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Key</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Source project</TableCell>
                  <TableCell>Install</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sources.map((source) => {
                  const installError = installErrorBySourceId[source.id];
                  const installedMessage = installedBySourceId[source.id];
                  const target = targetBySourceId[source.id] ?? '';
                  return (
                    <TableRow key={source.id}>
                      <TableCell sx={{ fontFamily: 'monospace' }}>{source.key}</TableCell>
                      <TableCell>{source.name}</TableCell>
                      <TableCell>{source.sourceType}</TableCell>
                      <TableCell>{source.sourceProjectName}</TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <FormControl size="small" sx={{ minWidth: 160 }}>
                            <Select
                              displayEmpty
                              value={target}
                              onChange={(event) =>
                                setTargetBySourceId((current) => ({
                                  ...current,
                                  [source.id]: event.target.value,
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
                            disabled={installingId === source.id || !target}
                            onClick={() => handleInstall(source)}
                          >
                            {installingId === source.id ? 'Installing…' : 'Install'}
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
                {sources.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <Typography color="text.secondary">
                        No knowledge sources shared in this organisation yet.
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
