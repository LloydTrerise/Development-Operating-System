import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Chip,
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
import { createWorkItem, listWorkItems, type WorkItem } from '../../api-client.js';
import { ErrorAlert } from '../../components/ErrorAlert.js';
import { LoadingState } from '../../components/LoadingState.js';
import { StatusChip } from '../../components/StatusChip.js';
import { useProjectContext } from '../../project-context.js';

const ALL_STATUSES = 'All';

function formatDate(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

/**
 * DEVOS-212: dense-table restyle. Status filter chips are derived from the
 * distinct statuses actually present in the loaded data, not a hardcoded
 * enum — `WorkItemStatus` remains an open-ended string
 * (packages/contracts/src/status.ts). No per-row stage-progress bar: see
 * specs/sprints/sprint-31/README.md's grounding on the disproportionate
 * N+1 cost across a table that can hold hundreds of real rows.
 */
export function WorkItemsPage() {
  const { selectedProjectId } = useProjectContext();
  const navigate = useNavigate();
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [statusFilter, setStatusFilter] = useState(ALL_STATUSES);

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

  useEffect(() => {
    setStatusFilter(ALL_STATUSES);
  }, [selectedProjectId]);

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

  const statuses = useMemo(
    () => Array.from(new Set(workItems.map((workItem) => workItem.status))).sort(),
    [workItems],
  );

  const visibleWorkItems = useMemo(
    () =>
      statusFilter === ALL_STATUSES
        ? workItems
        : workItems.filter((workItem) => workItem.status === statusFilter),
    [workItems, statusFilter],
  );

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
        <>
          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 1.5 }}>
            <Chip
              label={`${ALL_STATUSES} (${workItems.length})`}
              size="small"
              color={statusFilter === ALL_STATUSES ? 'primary' : 'default'}
              onClick={() => setStatusFilter(ALL_STATUSES)}
            />
            {statuses.map((status) => (
              <Chip
                key={status}
                label={status}
                size="small"
                color={statusFilter === status ? 'primary' : 'default'}
                onClick={() => setStatusFilter(status)}
              />
            ))}
          </Stack>

          <TableContainer sx={{ maxWidth: 960 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Work item</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Priority</TableCell>
                  <TableCell>Updated</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {visibleWorkItems.map((workItem) => (
                  <TableRow
                    key={workItem.id}
                    hover
                    onClick={() => navigate(`/work-items/${workItem.id}`)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell>
                      <Typography variant="body2">{workItem.title}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {workItem.externalRef ?? workItem.id}
                      </Typography>
                    </TableCell>
                    <TableCell>{workItem.type}</TableCell>
                    <TableCell>
                      <StatusChip status={workItem.status} />
                    </TableCell>
                    <TableCell>{workItem.priority}</TableCell>
                    <TableCell>{formatDate(workItem.updatedAt)}</TableCell>
                  </TableRow>
                ))}
                {visibleWorkItems.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5}>
                      {workItems.length === 0 ? 'No work items yet.' : 'No work items match this filter.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </>
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
