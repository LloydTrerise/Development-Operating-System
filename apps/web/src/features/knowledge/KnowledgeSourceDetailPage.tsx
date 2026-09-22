import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Button,
  Paper,
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
  archiveKnowledgeSource,
  getKnowledgeSource,
  getKnowledgeSourceReferences,
  shareKnowledgeSource,
  updateKnowledgeSource,
  type KnowledgeReference,
  type KnowledgeSource,
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

function formatDate(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

/**
 * DEVOS-231: the real Knowledge Source detail view, closing the disclosed
 * `GET /knowledge-sources/:id` client-wrapper/UI gap. Satisfies `ui-spec.txt`
 * §17's "Status, permissions, freshness" using only real fields: `status`,
 * the real `sharedAcrossOrganisation` flag (the only real access-scope
 * signal in this codebase — there is no separate permissions matrix), and
 * `updatedAt`/`createdAt` (the only real recency signal — there is no
 * separate ingestion/sync-freshness concept), per this sprint's own "omit
 * rather than fabricate" discipline (see specs/sprints/sprint-34/README.md's
 * grounding). Edit/share/archive and the real usage/reference list move here
 * from `KnowledgeSourcesPage.tsx`'s previous inline row actions.
 */
export function KnowledgeSourceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [source, setSource] = useState<KnowledgeSource | null>(null);
  const [references, setReferences] = useState<KnowledgeReference[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [sourceType, setSourceType] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    setLoading(true);

    Promise.all([getKnowledgeSource(id), getKnowledgeSourceReferences(id)]).then(
      ([sourceResult, referencesResult]) => {
        if (cancelled) return;
        setLoading(false);

        if (!sourceResult.ok) {
          setLoadError(sourceResult.error.message);
          return;
        }
        setLoadError(null);
        setSource(sourceResult.data);
        setName(sourceResult.data.name);
        setContent(sourceResult.data.content);
        setSourceType(sourceResult.data.sourceType);
        setReferences(referencesResult.ok ? referencesResult.data : []);
      },
    );

    return () => {
      cancelled = true;
    };
  }, [id, refreshToken]);

  async function handleSave() {
    if (!id) return;
    setSaving(true);
    setSaveError(null);
    setSavedAt(null);
    const result = await updateKnowledgeSource(id, { name, content, sourceType });
    setSaving(false);
    if (!result.ok) {
      setSaveError(result.error.message);
      return;
    }
    setSource(result.data);
    setSavedAt(Date.now());
  }

  async function handleShareToggle() {
    if (!id || !source) return;
    setBusy(true);
    setActionError(null);
    const result = await shareKnowledgeSource(id, !source.sharedAcrossOrganisation);
    setBusy(false);
    if (!result.ok) {
      setActionError(result.error.message);
      return;
    }
    setRefreshToken((token) => token + 1);
  }

  async function handleArchive() {
    if (!id) return;
    setBusy(true);
    setActionError(null);
    const result = await archiveKnowledgeSource(id);
    setBusy(false);
    if (!result.ok) {
      setActionError(result.error.message);
      return;
    }
    setRefreshToken((token) => token + 1);
  }

  const isArchived = source?.status === 'ARCHIVED';

  return (
    <DetailPageLayout title={source?.name ?? 'Knowledge Source'} backTo="/knowledge">
      {loading && <LoadingState label="Loading knowledge source…" />}
      {loadError && <ErrorAlert message={`Failed to load knowledge source: ${loadError}`} />}
      {actionError && <ErrorAlert message={actionError} />}

      {!loading && !loadError && source && (
        <Stack spacing={3}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack direction="row" spacing={3} flexWrap="wrap" useFlexGap alignItems="flex-start">
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Key
                </Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                  {source.key}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Status
                </Typography>
                <Box sx={{ mt: 0.25 }}>
                  <StatusChip status={source.status} />
                </Box>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Permissions
                </Typography>
                <Typography variant="body2">
                  {source.sharedAcrossOrganisation
                    ? 'Shared across organisation'
                    : 'Project-only (not shared)'}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Freshness
                </Typography>
                <Typography variant="body2">Updated {formatDate(source.updatedAt)}</Typography>
                <Typography variant="caption" color="text.secondary">
                  Created {formatDate(source.createdAt)} by {source.createdBy}
                </Typography>
              </Box>
            </Stack>
            <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
              {!isArchived && (
                <Button size="small" variant="outlined" disabled={busy} onClick={handleShareToggle}>
                  {source.sharedAcrossOrganisation ? 'Unshare' : 'Share'}
                </Button>
              )}
              {!isArchived && (
                <Button
                  size="small"
                  variant="outlined"
                  color="warning"
                  disabled={busy}
                  onClick={handleArchive}
                >
                  Archive
                </Button>
              )}
            </Stack>
          </Paper>

          <Paper variant="outlined">
            <PanelHeader title="Content" />
            <Stack spacing={2} sx={{ p: 2 }}>
              <TextField
                label="Name"
                size="small"
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={isArchived}
              />
              <TextField
                label="Source type"
                size="small"
                value={sourceType}
                onChange={(event) => setSourceType(event.target.value)}
                disabled={isArchived}
              />
              <TextField
                label="Content"
                size="small"
                multiline
                minRows={4}
                value={content}
                onChange={(event) => setContent(event.target.value)}
                disabled={isArchived}
              />
              {!isArchived && (
                <Button
                  variant="contained"
                  size="small"
                  disabled={saving}
                  onClick={handleSave}
                  sx={{ alignSelf: 'flex-start' }}
                >
                  {saving ? 'Saving…' : 'Save changes'}
                </Button>
              )}
              {saveError && <ErrorAlert message={saveError} />}
              {savedAt && (
                <Typography variant="caption" color="success.main">
                  Saved.
                </Typography>
              )}
            </Stack>
          </Paper>

          <Paper variant="outlined">
            <PanelHeader title="Usage" />
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Workflow task</TableCell>
                  <TableCell>Agent execution</TableCell>
                  <TableCell>Used at</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {references.map((reference) => (
                  <TableRow key={reference.id}>
                    <TableCell sx={{ fontFamily: 'monospace' }}>
                      {reference.workflowTaskId}
                    </TableCell>
                    <TableCell sx={{ fontFamily: 'monospace' }}>
                      {reference.agentExecutionId ?? '—'}
                    </TableCell>
                    <TableCell>{formatDate(reference.createdAt)}</TableCell>
                  </TableRow>
                ))}
                {references.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3}>
                      <Typography color="text.secondary">
                        Not used by any execution yet.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Paper>
        </Stack>
      )}
    </DetailPageLayout>
  );
}
