import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
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
import {
  getKnowledgeSourceReferences,
  createKnowledgeSource,
  listKnowledgeSources,
  type KnowledgeReference,
  type KnowledgeSource,
} from '../../api-client.js';
import { ErrorAlert } from '../../components/ErrorAlert.js';
import { LoadingState } from '../../components/LoadingState.js';
import { StatusChip } from '../../components/StatusChip.js';
import { useProjectContext } from '../../project-context.js';

interface KnowledgeSourceFormState {
  key: string;
  name: string;
  sourceType: string;
  content: string;
}

const EMPTY_FORM: KnowledgeSourceFormState = { key: '', name: '', sourceType: '', content: '' };

function PanelHeader({ title }: { title: string }) {
  return (
    <Typography variant="subtitle1" sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
      {title}
    </Typography>
  );
}

/**
 * DEVOS-231: restyled into a summary table (`Paper`/`PanelHeader`, mirroring
 * `WorkItemsPage.tsx`'s DEVOS-212 dense-table convention) with row-click
 * navigation to a real `/knowledge/:id` detail view — the inline per-row
 * edit form, share/archive actions, and reference list moved to
 * `KnowledgeSourceDetailPage.tsx`. See specs/sprints/sprint-34/DEVOS-231.md.
 */
export function KnowledgeSourcesPage() {
  const { selectedProjectId } = useProjectContext();
  const navigate = useNavigate();
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
        <Paper variant="outlined" sx={{ mb: 4 }}>
          <PanelHeader title="Knowledge Sources" />
          <TableContainer>
            <Table size="small" data-testid="knowledge-sources-table">
              <TableHead>
                <TableRow>
                  <TableCell>Key</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Used by</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sources.map((source) => {
                  const references = referencesBySourceId[source.id] ?? [];
                  return (
                    <TableRow
                      key={source.id}
                      hover
                      onClick={() => navigate(`/knowledge/${source.id}`)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell>
                        {source.key}
                        {source.sharedAcrossOrganisation && (
                          <Chip size="small" label="shared" sx={{ ml: 1 }} />
                        )}
                      </TableCell>
                      <TableCell>{source.name}</TableCell>
                      <TableCell>{source.sourceType}</TableCell>
                      <TableCell>
                        <StatusChip status={source.status} />
                      </TableCell>
                      <TableCell data-testid={`knowledge-references-${source.id}`}>
                        {references.length} execution{references.length === 1 ? '' : 's'}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {sources.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <Typography color="text.secondary">
                        No knowledge sources in this project yet.
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
