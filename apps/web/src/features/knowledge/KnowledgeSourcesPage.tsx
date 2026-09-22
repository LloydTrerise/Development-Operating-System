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
  archiveKnowledgeSource,
  createKnowledgeSource,
  getKnowledgeSourceReferences,
  listKnowledgeSources,
  shareKnowledgeSource,
  updateKnowledgeSource,
  type KnowledgeReference,
  type KnowledgeSource,
} from '../../api-client.js';
import { ErrorAlert } from '../../components/ErrorAlert.js';
import { LoadingState } from '../../components/LoadingState.js';
import { useProjectContext } from '../../project-context.js';

interface KnowledgeSourceFormState {
  key: string;
  name: string;
  sourceType: string;
  content: string;
}

const EMPTY_FORM: KnowledgeSourceFormState = { key: '', name: '', sourceType: '', content: '' };

interface EditState {
  name: string;
  content: string;
  sourceType: string;
}

/**
 * DEVOS-183: the first web UI anywhere for `KnowledgeSource` — previously
 * create/list-only, direct-API-only (confirmed by
 * `specs/DEVOS-KNOWLEDGE-PLATFORM-BACKLOG.md` §2 before this task was
 * scoped). Reuses `AgentsPage.tsx`'s own project-scoped list/create/edit
 * page pattern.
 */
export function KnowledgeSourcesPage() {
  const { selectedProjectId } = useProjectContext();
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [referencesBySourceId, setReferencesBySourceId] = useState<
    Record<string, KnowledgeReference[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [form, setForm] = useState<KnowledgeSourceFormState>(EMPTY_FORM);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);

  useEffect(() => {
    if (!selectedProjectId) {
      setSources([]);
      setReferencesBySourceId({});
      return;
    }

    let cancelled = false;
    setLoading(true);

    listKnowledgeSources(selectedProjectId).then(async (result) => {
      if (cancelled) return;

      if (!result.ok) {
        setLoading(false);
        setError(result.error.message);
        return;
      }

      setError(null);
      setSources(result.data);
      setLoading(false);

      // DEVOS-184: real usage traceability, rendered per source.
      const referenceResults = await Promise.all(
        result.data.map((source) => getKnowledgeSourceReferences(source.id)),
      );
      if (cancelled) return;
      const nextReferences: Record<string, KnowledgeReference[]> = {};
      result.data.forEach((source, index) => {
        const referenceResult = referenceResults[index];
        if (referenceResult?.ok) nextReferences[source.id] = referenceResult.data;
      });
      setReferencesBySourceId(nextReferences);
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

    const result = await createKnowledgeSource(selectedProjectId, form);
    setSubmitting(false);

    if (!result.ok) {
      setSubmitError(result.error.message);
      return;
    }

    setForm(EMPTY_FORM);
    setRefreshToken((token) => token + 1);
  }

  function startEdit(source: KnowledgeSource) {
    setEditingId(source.id);
    setEditState({ name: source.name, content: source.content, sourceType: source.sourceType });
  }

  async function handleSaveEdit(sourceId: string) {
    if (!editState) return;
    setBusyId(sourceId);
    const result = await updateKnowledgeSource(sourceId, editState);
    setBusyId(null);
    if (!result.ok) {
      setSubmitError(result.error.message);
      return;
    }
    setEditingId(null);
    setEditState(null);
    setRefreshToken((token) => token + 1);
  }

  async function handleArchive(sourceId: string) {
    setBusyId(sourceId);
    const result = await archiveKnowledgeSource(sourceId);
    setBusyId(null);
    if (!result.ok) {
      setSubmitError(result.error.message);
      return;
    }
    setRefreshToken((token) => token + 1);
  }

  async function handleShareToggle(source: KnowledgeSource) {
    setBusyId(source.id);
    const result = await shareKnowledgeSource(source.id, !source.sharedAcrossOrganisation);
    setBusyId(null);
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
          Knowledge
        </Typography>
        <Typography color="text.secondary">Select a project to manage its knowledge sources.</Typography>
      </section>
    );
  }

  return (
    <section>
      <Typography variant="h4" component="h2" gutterBottom>
        Knowledge
      </Typography>

      {loading && <LoadingState label="Loading knowledge sources…" />}
      {error && <ErrorAlert message={`Failed to load knowledge sources: ${error}`} />}

      {!loading && !error && (
        <Table size="small" data-testid="knowledge-sources-table" sx={{ mb: 4 }}>
          <TableHead>
            <TableRow>
              <TableCell>Key</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Content</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Used by</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {sources.map((source) => {
              const references = referencesBySourceId[source.id] ?? [];
              const isEditing = editingId === source.id;
              return (
                <TableRow key={source.id}>
                  <TableCell>
                    {source.key}
                    {source.sharedAcrossOrganisation && (
                      <Chip size="small" label="shared" sx={{ ml: 1 }} />
                    )}
                  </TableCell>
                  {isEditing && editState ? (
                    <>
                      <TableCell>
                        <TextField
                          size="small"
                          value={editState.name}
                          onChange={(e) => setEditState({ ...editState, name: e.target.value })}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          value={editState.sourceType}
                          onChange={(e) =>
                            setEditState({ ...editState, sourceType: e.target.value })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          multiline
                          value={editState.content}
                          onChange={(e) =>
                            setEditState({ ...editState, content: e.target.value })
                          }
                        />
                      </TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell>{source.name}</TableCell>
                      <TableCell>{source.sourceType}</TableCell>
                      <TableCell sx={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {source.content}
                      </TableCell>
                    </>
                  )}
                  <TableCell>{source.status}</TableCell>
                  <TableCell data-testid={`knowledge-references-${source.id}`}>
                    {references.length} execution{references.length === 1 ? '' : 's'}
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1}>
                      {isEditing ? (
                        <Button size="small" disabled={busyId === source.id} onClick={() => handleSaveEdit(source.id)}>
                          Save
                        </Button>
                      ) : (
                        source.status !== 'ARCHIVED' && (
                          <Button size="small" onClick={() => startEdit(source)}>
                            Edit
                          </Button>
                        )
                      )}
                      {source.status !== 'ARCHIVED' && (
                        <Button
                          size="small"
                          disabled={busyId === source.id}
                          onClick={() => handleShareToggle(source)}
                        >
                          {source.sharedAcrossOrganisation ? 'Unshare' : 'Share'}
                        </Button>
                      )}
                      {source.status !== 'ARCHIVED' && (
                        <Button
                          size="small"
                          color="warning"
                          disabled={busyId === source.id}
                          onClick={() => handleArchive(source.id)}
                        >
                          Archive
                        </Button>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              );
            })}
            {sources.length === 0 && (
              <TableRow>
                <TableCell colSpan={7}>
                  <Typography color="text.secondary">No knowledge sources in this project yet.</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      <Typography variant="h6" component="h3" gutterBottom>
        New knowledge source
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
          label="Source type"
          value={form.sourceType}
          onChange={(event) => setForm({ ...form, sourceType: event.target.value })}
          required
          size="small"
          helperText="e.g. STANDARD, POLICY, PATTERN"
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
        <Button
          type="submit"
          variant="contained"
          disabled={submitting}
          sx={{ alignSelf: 'flex-start' }}
        >
          {submitting ? 'Creating…' : 'Create knowledge source'}
        </Button>
        {submitError && <ErrorAlert message={submitError} />}
      </Stack>
    </section>
  );
}
