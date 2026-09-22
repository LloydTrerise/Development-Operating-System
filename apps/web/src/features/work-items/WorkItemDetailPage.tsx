import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Button, Stack, TextField, Typography } from '@mui/material';
import { getWorkItem, updateWorkItem, type WorkItem } from '../../api-client.js';
import { DetailPageLayout } from '../../components/DetailPageLayout.js';
import { ErrorAlert } from '../../components/ErrorAlert.js';
import { LoadingState } from '../../components/LoadingState.js';

/**
 * DEVOS-213: the real work item detail/edit view, replacing Sprint 29's
 * DEVOS-206 routing scaffold. Uses the already-existing, already-tested
 * `GET`/`PATCH /work-items/:workItemId` routes — see
 * specs/sprints/sprint-31/DEVOS-213.md's own grounding for why this is
 * frontend-only work, not a new backend route. Status/priority are plain
 * text fields because `WorkItemStatus`/`WorkItemPriority` are open-ended
 * strings, not closed enums, anywhere in this codebase's domain model.
 */
export function WorkItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [workItem, setWorkItem] = useState<WorkItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    setLoading(true);

    getWorkItem(id).then((result) => {
      if (cancelled) return;
      setLoading(false);

      if (!result.ok) {
        setLoadError(result.error.message);
        return;
      }

      setLoadError(null);
      setWorkItem(result.data);
      setTitle(result.data.title);
      setDescription(result.data.description ?? '');
      setStatus(result.data.status);
      setPriority(result.data.priority);
    });

    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!id) return;

    setSaving(true);
    setSaveError(null);
    setSavedAt(null);

    const result = await updateWorkItem(id, { title, description, status, priority });
    setSaving(false);

    if (!result.ok) {
      setSaveError(result.error.message);
      return;
    }

    setWorkItem(result.data);
    setSavedAt(Date.now());
  }

  return (
    <DetailPageLayout title={workItem?.title ?? 'Work Item'} backTo="/work-items">
      {loading && <LoadingState label="Loading work item…" />}
      {loadError && <ErrorAlert message={`Failed to load work item: ${loadError}`} />}

      {!loading && !loadError && workItem && (
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={4}>
          <Box sx={{ minWidth: 260 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Details
            </Typography>
            <Stack spacing={1}>
              <Typography variant="body2">
                <strong>Type:</strong> {workItem.type}
              </Typography>
              {workItem.externalRef && (
                <Typography variant="body2">
                  <strong>External ref:</strong> {workItem.externalRef}
                </Typography>
              )}
              {workItem.source && (
                <Typography variant="body2">
                  <strong>Source:</strong> {workItem.source}
                </Typography>
              )}
              <Typography variant="body2">
                <strong>Created:</strong> {new Date(workItem.createdAt).toLocaleString()}
              </Typography>
              <Typography variant="body2">
                <strong>Updated:</strong> {new Date(workItem.updatedAt).toLocaleString()}
              </Typography>
            </Stack>
          </Box>

          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Edit
            </Typography>
            <Stack component="form" onSubmit={handleSubmit} spacing={2} sx={{ maxWidth: 480 }}>
              <TextField
                label="Title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
                size="small"
              />
              <TextField
                label="Description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                multiline
                minRows={3}
                size="small"
              />
              <TextField
                label="Status"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                size="small"
                helperText="Free text — this codebase does not define a closed status enumeration."
              />
              <TextField
                label="Priority"
                value={priority}
                onChange={(event) => setPriority(event.target.value)}
                size="small"
              />
              <Button
                type="submit"
                variant="contained"
                disabled={saving}
                sx={{ alignSelf: 'flex-start' }}
              >
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
              {saveError && <ErrorAlert message={saveError} />}
              {savedAt && (
                <Typography variant="caption" color="success.main">
                  Saved.
                </Typography>
              )}
            </Stack>
          </Box>
        </Stack>
      )}
    </DetailPageLayout>
  );
}
