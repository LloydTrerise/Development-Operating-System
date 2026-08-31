import { useEffect, useState, type FormEvent } from 'react';
import {
  Button,
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
import { createWorkItem, listWorkItems, type WorkItem } from '../api-client.js';
import { ErrorAlert } from '../components/ErrorAlert.js';
import { LoadingState } from '../components/LoadingState.js';
import { StatusChip } from '../components/StatusChip.js';
import { useProjectContext } from '../project-context.js';

export function WorkItemsPage() {
  const { selectedProjectId } = useProjectContext();
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!selectedProjectId) {
      setWorkItems([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    listWorkItems(selectedProjectId).then((result) => {
      if (cancelled) return;
      setLoading(false);

      if (!result.ok) {
        setError(result.error.message);
        return;
      }

      setError(null);
      setWorkItems(result.data);
    });

    return () => {
      cancelled = true;
    };
  }, [selectedProjectId, reloadToken]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!selectedProjectId) return;

    setSubmitting(true);
    setSubmitError(null);

    const result = await createWorkItem(selectedProjectId, { title });
    setSubmitting(false);

    if (!result.ok) {
      setSubmitError(result.error.message);
      return;
    }

    setTitle('');
    setReloadToken((token) => token + 1);
  }

  if (!selectedProjectId) {
    return (
      <section>
        <Typography variant="h4" component="h2" gutterBottom>
          Work Items
        </Typography>
        <Typography color="text.secondary">Select a project to see its work items.</Typography>
      </section>
    );
  }

  return (
    <section>
      <Typography variant="h4" component="h2" gutterBottom>
        Work Items
      </Typography>

      {loading && <LoadingState label="Loading work items…" />}
      {error && <ErrorAlert message={`Failed to load work items: ${error}`} />}

      {!loading && !error && (
        <TableContainer sx={{ maxWidth: 720 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Priority</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {workItems.map((workItem) => (
                <TableRow key={workItem.id}>
                  <TableCell>{workItem.title}</TableCell>
                  <TableCell>{workItem.type}</TableCell>
                  <TableCell>
                    <StatusChip status={workItem.status} />
                  </TableCell>
                  <TableCell>{workItem.priority}</TableCell>
                </TableRow>
              ))}
              {workItems.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4}>No work items yet.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Typography variant="h6" component="h3" sx={{ mt: 4 }} gutterBottom>
        New work item
      </Typography>
      <Stack component="form" onSubmit={handleSubmit} spacing={2} sx={{ maxWidth: 360 }}>
        <TextField
          label="Title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          size="small"
        />
        <Button
          type="submit"
          variant="contained"
          disabled={submitting}
          sx={{ alignSelf: 'flex-start' }}
        >
          {submitting ? 'Creating…' : 'Create work item'}
        </Button>
        {submitError && <ErrorAlert message={submitError} />}
      </Stack>
    </section>
  );
}
