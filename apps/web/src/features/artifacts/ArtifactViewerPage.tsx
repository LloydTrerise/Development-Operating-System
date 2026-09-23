import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import {
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import {
  getArtifactForPrincipal,
  getArtifactProvenance,
  listArtifactVersions,
  type Artifact,
  type ArtifactProvenanceInfo,
  type ArtifactVersion,
} from '../../api-client.js';
import { DetailPageLayout } from '../../components/DetailPageLayout.js';
import { ErrorAlert } from '../../components/ErrorAlert.js';
import { LoadingState } from '../../components/LoadingState.js';
import { StatusChip } from '../../components/StatusChip.js';
import { useProjectContext } from '../../project-context.js';
import { diffLines } from './diff-lines.js';

const PRE_SX = {
  p: 1,
  fontFamily: 'monospace',
  fontSize: 12,
  overflow: 'auto',
  m: 0,
} as const;

function PanelHeader({ title }: { title: string }) {
  return (
    <Typography variant="subtitle1" sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
      {title}
    </Typography>
  );
}

function formatDate(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

function describeVersionContent(version: ArtifactVersion): string {
  return version.metadata
    ? JSON.stringify(version.metadata, null, 2)
    : `(no metadata recorded for version ${version.version})`;
}

/**
 * DEVOS-236/DEVOS-237: the real Artifact Viewer, closing the epic's largest
 * confirmed net-new UI gap. Content/diff render each version's `metadata`
 * (pretty-printed) rather than raw file bytes — no route in this codebase
 * serves decoded artifact content (see specs/sprints/sprint-35/README.md's
 * own grounding). Provenance is disclosed as identical to the artifact's own
 * `provenance` field; Relationships surfaces the one real
 * `metadata.derivedFromArtifactId` one-hop link evidence artifacts carry,
 * when present.
 */
export function ArtifactViewerPage() {
  const { id } = useParams<{ id: string }>();
  const { projects } = useProjectContext();
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const [versions, setVersions] = useState<ArtifactVersion[]>([]);
  const [provenance, setProvenance] = useState<ArtifactProvenanceInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedVersionNumber, setSelectedVersionNumber] = useState<number | null>(null);
  const [compareLeft, setCompareLeft] = useState<number | null>(null);
  const [compareRight, setCompareRight] = useState<number | null>(null);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    setLoading(true);

    Promise.all([
      getArtifactForPrincipal(id),
      listArtifactVersions(id),
      getArtifactProvenance(id),
    ]).then(([artifactResult, versionsResult, provenanceResult]) => {
      if (cancelled) return;
      setLoading(false);

      if (!artifactResult.ok) {
        setLoadError(artifactResult.error.message);
        return;
      }
      setLoadError(null);
      setArtifact(artifactResult.data);

      const sortedVersions = versionsResult.ok
        ? [...versionsResult.data].sort((a, b) => b.version - a.version)
        : [];
      setVersions(sortedVersions);
      setSelectedVersionNumber(sortedVersions[0]?.version ?? null);
      if (sortedVersions.length >= 2) {
        setCompareLeft(sortedVersions[1]!.version);
        setCompareRight(sortedVersions[0]!.version);
      }

      setProvenance(provenanceResult.ok ? provenanceResult.data : null);
    });

    return () => {
      cancelled = true;
    };
  }, [id]);

  const selectedVersion = versions.find((version) => version.version === selectedVersionNumber);
  const project = artifact
    ? projects.find((candidate) => candidate.id === artifact.projectId)
    : undefined;
  const derivedFromArtifactId =
    typeof selectedVersion?.metadata?.derivedFromArtifactId === 'string'
      ? selectedVersion.metadata.derivedFromArtifactId
      : null;

  const leftVersion = versions.find((version) => version.version === compareLeft);
  const rightVersion = versions.find((version) => version.version === compareRight);
  const diff = useMemo(() => {
    if (!leftVersion || !rightVersion) return null;
    return diffLines(describeVersionContent(leftVersion), describeVersionContent(rightVersion));
  }, [leftVersion, rightVersion]);

  return (
    <DetailPageLayout title={artifact?.name ?? 'Artifact'} backTo="/artifacts">
      {loading && <LoadingState label="Loading artifact…" />}
      {loadError && <ErrorAlert message={`Failed to load artifact: ${loadError}`} />}

      {!loading && !loadError && artifact && (
        <Stack spacing={3}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack direction="row" spacing={3} flexWrap="wrap" useFlexGap alignItems="flex-start">
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Type
                </Typography>
                <Typography variant="body2">{artifact.type}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Status
                </Typography>
                <Box sx={{ mt: 0.25 }}>
                  <StatusChip status={artifact.status} />
                </Box>
              </Box>
              {versions.length > 0 && (
                <FormControl size="small" sx={{ minWidth: 140 }}>
                  <InputLabel id="artifact-version-select-label">Version</InputLabel>
                  <Select
                    labelId="artifact-version-select-label"
                    label="Version"
                    value={selectedVersionNumber ?? ''}
                    onChange={(event) => setSelectedVersionNumber(Number(event.target.value))}
                  >
                    {versions.map((version) => (
                      <MenuItem key={version.id} value={version.version}>
                        v{version.version}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            </Stack>
          </Paper>

          <Paper variant="outlined">
            <PanelHeader title="Content" />
            <Box sx={{ p: 2 }}>
              {selectedVersion ? (
                <>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Content type: <code>{selectedVersion.contentType}</code> — hash{' '}
                    <code>{selectedVersion.contentHash}</code>
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    component="div"
                    sx={{ mb: 1 }}
                  >
                    No route in this codebase serves decoded artifact content — the pretty-printed
                    metadata below is the closest real substitute for a content preview, not a raw
                    file viewer.
                  </Typography>
                  <Paper variant="outlined" component="pre" sx={PRE_SX}>
                    {describeVersionContent(selectedVersion)}
                  </Paper>
                </>
              ) : (
                <Typography color="text.secondary">No versions recorded yet.</Typography>
              )}
            </Box>
          </Paper>

          <Paper variant="outlined">
            <PanelHeader title="Metadata" />
            <Stack direction="row" spacing={3} flexWrap="wrap" useFlexGap sx={{ p: 2 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Project
                </Typography>
                <Typography variant="body2">{project?.name ?? artifact.projectId}</Typography>
              </Box>
              {selectedVersion && (
                <>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Author
                    </Typography>
                    <Typography variant="body2">{selectedVersion.createdBy}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Created
                    </Typography>
                    <Typography variant="body2">{formatDate(selectedVersion.createdAt)}</Typography>
                  </Box>
                </>
              )}
            </Stack>
          </Paper>

          <Paper variant="outlined">
            <PanelHeader title="Provenance" />
            <Box sx={{ p: 2 }}>
              {provenance && (provenance.workflowRunId || provenance.workflowTaskId) ? (
                <Stack spacing={0.5}>
                  {provenance.workflowRunId && (
                    <Typography variant="body2">
                      Workflow run <code>{provenance.workflowRunId}</code> —{' '}
                      <RouterLink to={`/runs/${provenance.workflowRunId}`}>view run</RouterLink>
                    </Typography>
                  )}
                  {provenance.workflowTaskId && (
                    <Typography variant="body2">
                      Workflow task <code>{provenance.workflowTaskId}</code>
                    </Typography>
                  )}
                  <Typography variant="caption" color="text.secondary">
                    This is the same data already shown above — `getArtifactProvenance` returns no
                    richer trace (no origin/agent/context-manifest data source exists anywhere in
                    this codebase).
                  </Typography>
                </Stack>
              ) : (
                <Typography color="text.secondary">
                  No workflow provenance recorded for this artifact.
                </Typography>
              )}
            </Box>
          </Paper>

          <Paper variant="outlined">
            <PanelHeader title="Relationships" />
            <Box sx={{ p: 2 }}>
              {derivedFromArtifactId ? (
                <Typography variant="body2">
                  Derived from{' '}
                  <RouterLink to={`/artifacts/${derivedFromArtifactId}`}>
                    <code>{derivedFromArtifactId}</code>
                  </RouterLink>
                </Typography>
              ) : (
                <Typography color="text.secondary">
                  No relationship data for this version — only a one-hop "derived from" link
                  (present on evidence artifacts) is tracked anywhere in this codebase; no
                  downstream index exists.
                </Typography>
              )}
            </Box>
          </Paper>

          <Paper variant="outlined">
            <PanelHeader title="Version history" />
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Version</TableCell>
                  <TableCell>Author</TableCell>
                  <TableCell>Created</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {versions.map((version) => (
                  <TableRow
                    key={version.id}
                    hover
                    onClick={() => setSelectedVersionNumber(version.version)}
                    selected={version.version === selectedVersionNumber}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell>v{version.version}</TableCell>
                    <TableCell>{version.createdBy}</TableCell>
                    <TableCell>{formatDate(version.createdAt)}</TableCell>
                  </TableRow>
                ))}
                {versions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3}>
                      <Typography color="text.secondary">No versions yet.</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Paper>

          {versions.length >= 2 && (
            <Paper variant="outlined">
              <PanelHeader title="Compare versions" />
              <Stack direction="row" spacing={2} sx={{ p: 2 }}>
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel id="artifact-compare-left-label">From</InputLabel>
                  <Select
                    labelId="artifact-compare-left-label"
                    label="From"
                    value={compareLeft ?? ''}
                    onChange={(event) => setCompareLeft(Number(event.target.value))}
                  >
                    {versions.map((version) => (
                      <MenuItem key={version.id} value={version.version}>
                        v{version.version}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel id="artifact-compare-right-label">To</InputLabel>
                  <Select
                    labelId="artifact-compare-right-label"
                    label="To"
                    value={compareRight ?? ''}
                    onChange={(event) => setCompareRight(Number(event.target.value))}
                  >
                    {versions.map((version) => (
                      <MenuItem key={version.id} value={version.version}>
                        v{version.version}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ px: 2 }}>
                Diffs each version's metadata (the closest real content substitute — no route serves
                raw artifact bytes), not raw file content.
              </Typography>
              <Box sx={{ p: 2, pt: 1 }}>
                <Paper variant="outlined" component="pre" sx={PRE_SX}>
                  {diff?.map((line, index) => (
                    <Box
                      key={index}
                      component="div"
                      sx={{
                        bgcolor:
                          line.type === 'added'
                            ? 'success.light'
                            : line.type === 'removed'
                              ? 'error.light'
                              : 'transparent',
                        color: line.type === 'unchanged' ? 'text.primary' : 'common.black',
                      }}
                    >
                      {line.type === 'added' ? '+ ' : line.type === 'removed' ? '- ' : '  '}
                      {line.text}
                    </Box>
                  ))}
                  {!diff && 'Select two versions to compare.'}
                </Paper>
              </Box>
            </Paper>
          )}
        </Stack>
      )}
    </DetailPageLayout>
  );
}
