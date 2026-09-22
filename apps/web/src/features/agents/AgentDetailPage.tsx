import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import {
  createNewAgentVersion,
  getAgent,
  getAgentQuality,
  listAgentVersions,
  publishAgentVersion,
  shareAgentVersion,
  type Agent,
  type AgentVersion,
  type AgentVersionQuality,
} from '../../api-client.js';
import { DetailPageLayout } from '../../components/DetailPageLayout.js';
import { ErrorAlert } from '../../components/ErrorAlert.js';
import { LoadingState } from '../../components/LoadingState.js';
import { StatusChip } from '../../components/StatusChip.js';

function PanelHeader({ title }: { title: string }) {
  return (
    <Typography variant="subtitle1" sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
      {title}
    </Typography>
  );
}

/**
 * DEVOS-230: the real Agent detail view, closing the disclosed
 * `GET /agents/:id` client-wrapper/UI gap. Surfaces every field `ui-spec.txt`
 * §15 (Agent Catalogue) names that has a real data source in this codebase
 * (identity, role, status, version, capabilities, review pass rate) and
 * moves the Publish/Draft-new-version actions here from `AgentsPage.tsx`.
 * "Knowledge access" and "policies" (also named in §15) are disclosed below
 * as not backed by any real per-agent data source — no agent-to-knowledge
 * binding or per-agent policy record exists anywhere in this codebase — per
 * this sprint's own "omit rather than fabricate" discipline (see
 * specs/sprints/sprint-34/README.md's grounding).
 *
 * DEVOS-245: the Versions table also gained a Share/Unshare action per
 * PUBLISHED version (wiring DEVOS-177's real `sharedAgentVersion` route for
 * the first time) and a "Shared" indicator column — see
 * specs/sprints/sprint-37/README.md's grounding.
 */
export function AgentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [versions, setVersions] = useState<AgentVersion[]>([]);
  const [quality, setQuality] = useState<AgentVersionQuality[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    setLoading(true);

    Promise.all([getAgent(id), listAgentVersions(id), getAgentQuality(id)]).then(
      ([agentResult, versionsResult, qualityResult]) => {
        if (cancelled) return;
        setLoading(false);

        if (!agentResult.ok) {
          setLoadError(agentResult.error.message);
          return;
        }
        setLoadError(null);
        setAgent(agentResult.data);
        setVersions(versionsResult.ok ? versionsResult.data : []);
        setQuality(qualityResult.ok ? qualityResult.data : []);
      },
    );

    return () => {
      cancelled = true;
    };
  }, [id, refreshToken]);

  async function handleDraftNewVersion() {
    if (!id) return;
    setBusy(true);
    setActionError(null);
    const result = await createNewAgentVersion(id);
    setBusy(false);
    if (!result.ok) {
      setActionError(result.error.message);
      return;
    }
    setRefreshToken((token) => token + 1);
  }

  async function handlePublish() {
    if (!id) return;
    setBusy(true);
    setActionError(null);
    const result = await publishAgentVersion(id);
    setBusy(false);
    if (!result.ok) {
      setActionError(result.error.message);
      return;
    }
    setRefreshToken((token) => token + 1);
  }

  // DEVOS-245: no client-side role check — the backend's real `ForbiddenError`
  // ("Only a project owner may share an agent version.") surfaces through
  // `actionError`/`ErrorAlert` on rejection, matching `handlePublish`'s own
  // established convention exactly.
  async function handleShareToggle(version: AgentVersion) {
    if (!id) return;
    setBusy(true);
    setActionError(null);
    const result = await shareAgentVersion(id, version.version, !version.sharedAcrossOrganisation);
    setBusy(false);
    if (!result.ok) {
      setActionError(result.error.message);
      return;
    }
    setRefreshToken((token) => token + 1);
  }

  const sortedVersions = [...versions].sort((a, b) => b.version - a.version);
  const hasDraft = sortedVersions[0]?.status === 'DRAFT';
  const qualityByVersionId = new Map(quality.map((q) => [q.agentVersionId, q]));

  return (
    <DetailPageLayout title={agent?.name ?? 'Agent'} backTo="/agents">
      {loading && <LoadingState label="Loading agent…" />}
      {loadError && <ErrorAlert message={`Failed to load agent: ${loadError}`} />}
      {actionError && <ErrorAlert message={actionError} />}

      {!loading && !loadError && agent && (
        <Stack spacing={3}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack direction="row" spacing={3} flexWrap="wrap" useFlexGap alignItems="flex-start">
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Key
                </Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                  {agent.key}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Status
                </Typography>
                <Box sx={{ mt: 0.25 }}>
                  <StatusChip status={agent.status} />
                </Box>
              </Box>
              {agent.description && (
                <Box sx={{ minWidth: 240 }}>
                  <Typography variant="caption" color="text.secondary">
                    Description
                  </Typography>
                  <Typography variant="body2">{agent.description}</Typography>
                </Box>
              )}
            </Stack>
          </Paper>

          <Paper variant="outlined">
            <PanelHeader title="Versions" />
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Version</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Shared</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Provider</TableCell>
                  <TableCell>Model</TableCell>
                  <TableCell>Capabilities</TableCell>
                  <TableCell>Review pass rate</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedVersions.map((version) => {
                  const versionQuality = qualityByVersionId.get(version.id);
                  return (
                    <TableRow key={version.id}>
                      <TableCell>{version.version}</TableCell>
                      <TableCell>
                        <StatusChip status={version.status} />
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          variant={version.sharedAcrossOrganisation ? 'filled' : 'outlined'}
                          label={version.sharedAcrossOrganisation ? 'Shared' : 'Not shared'}
                        />
                      </TableCell>
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
                      <TableCell>
                        {versionQuality
                          ? `${(versionQuality.passRate * 100).toFixed(0)}% (${versionQuality.reviewCount} reviewed)`
                          : 'No reviews yet'}
                      </TableCell>
                      <TableCell>
                        {version.status === 'DRAFT' && (
                          <Button size="small" disabled={busy} onClick={handlePublish}>
                            Publish
                          </Button>
                        )}
                        {version.status === 'PUBLISHED' && (
                          <Button
                            size="small"
                            disabled={busy}
                            onClick={() => handleShareToggle(version)}
                          >
                            {version.sharedAcrossOrganisation ? 'Unshare' : 'Share'}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {sortedVersions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9}>
                      <Typography color="text.secondary">No versions yet.</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <Box sx={{ p: 1.5 }}>
              {!hasDraft && (
                <Button size="small" disabled={busy} onClick={handleDraftNewVersion}>
                  Draft new version
                </Button>
              )}
            </Box>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary">
              <strong>Knowledge access</strong> and <strong>policies</strong> (per{' '}
              <code>ui-spec.txt</code> §15) are not shown here — no agent-to-knowledge-source
              binding or per-agent policy record exists anywhere in this codebase yet. "Tools" and
              "Capabilities" are the same real field (<code>allowedCapabilities</code>, shown in
              the Versions table above), not two separate concepts in the domain model today.
            </Typography>
          </Paper>
        </Stack>
      )}
    </DetailPageLayout>
  );
}
