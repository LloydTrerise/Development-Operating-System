import { useEffect, useState, type FormEvent } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import {
  Box,
  Button,
  Chip,
  FormControl,
  Link,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  addWorkItemComment,
  archiveWorkItem,
  assignWorkItem,
  getWorkItem,
  listMembers,
  listWorkItemAssignments,
  listWorkItemComments,
  listWorkItems,
  removeWorkItemAssignment,
  updateWorkItem,
  type Membership,
  type WorkItem,
  type WorkItemAssignment,
  type WorkItemAssignmentRole,
  type WorkItemComment,
} from '../../api-client.js';
import { DetailPageLayout } from '../../components/DetailPageLayout.js';
import { ErrorAlert } from '../../components/ErrorAlert.js';
import { LoadingState } from '../../components/LoadingState.js';

const ASSIGNMENT_ROLES: WorkItemAssignmentRole[] = ['ASSIGNEE', 'REVIEWER', 'APPROVER'];

/**
 * DEVOS-213: the real work item detail/edit view, replacing Sprint 29's
 * DEVOS-206 routing scaffold. Uses the already-existing, already-tested
 * `GET`/`PATCH /work-items/:workItemId` routes — see
 * specs/sprints/sprint-31/DEVOS-213.md's own grounding for why this is
 * frontend-only work, not a new backend route. Status/priority are plain
 * text fields because `WorkItemStatus`/`WorkItemPriority` are open-ended
 * strings, not closed enums, anywhere in this codebase's domain model.
 *
 * DEVOS-306 (Sprint 50): adds an Assignments panel — `updateWorkItem`'s
 * PATCH above is now assignment-gated server-side (edit requires ASSIGNEE,
 * status transitions allow ASSIGNEE/REVIEWER/APPROVER), so this page needs
 * a way to see and change who holds those roles. Assign/remove are
 * `canManageMembers`-gated server-side (project OWNER/organisation
 * admin/owner) — except a principal who already holds ASSIGNEE may hand it
 * off to another member (a real "reassign my ticket" action, added after
 * this sprint's own initial completion per explicit user request); mirroring
 * `ProjectDetailPage.tsx`'s own established convention (DEVOS-293/301), no
 * client-side role check hides the form — an unauthorized attempt surfaces
 * the server's real 403 via the same error-alert pattern.
 *
 * Also adds a Hierarchy panel (same follow-up): the current parent (if any)
 * links to its own detail page, a picker changes or clears it (`parentId`
 * PATCHed as a real `WorkItemId` or explicit `null`), and direct children
 * are listed below, derived client-side from the same `listWorkItems`
 * fetch `WorkItemsPage.tsx` already performs unbounded for a project — this
 * page reuses that same established, already-accepted cost rather than
 * inventing a new cap for identical data.
 *
 * DEVOS-309 (Sprint 51 reconciliation): adds a Comments panel (any project
 * member may read/post — not assignment-gated) and an Archive action in the
 * Details panel (`canManageMembers`-gated server-side; the source
 * document's own `workitem.delete` grants no "project member" access at
 * all, so this deliberately does not reuse `updateWorkItem`'s broader
 * ASSIGNEE/REVIEWER/APPROVER-gated status-transition path).
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

  const [members, setMembers] = useState<Membership[]>([]);
  const [assignments, setAssignments] = useState<WorkItemAssignment[]>([]);
  const [assignmentsError, setAssignmentsError] = useState<string | null>(null);
  const [assignActionError, setAssignActionError] = useState<string | null>(null);
  const [assignBusyKey, setAssignBusyKey] = useState<string | null>(null);
  const [newAssignPrincipalId, setNewAssignPrincipalId] = useState('');
  const [newAssignRole, setNewAssignRole] = useState<WorkItemAssignmentRole>('ASSIGNEE');

  const [projectWorkItems, setProjectWorkItems] = useState<WorkItem[]>([]);
  const [parentSelection, setParentSelection] = useState('');
  const [parentSaving, setParentSaving] = useState(false);
  const [parentSaveError, setParentSaveError] = useState<string | null>(null);

  const [comments, setComments] = useState<WorkItemComment[]>([]);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [newCommentBody, setNewCommentBody] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentSubmitError, setCommentSubmitError] = useState<string | null>(null);

  const [archiving, setArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);

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
      setParentSelection(result.data.parentId ?? '');
    });

    return () => {
      cancelled = true;
    };
  }, [id]);

  function refreshAssignments() {
    if (!id) return;
    listWorkItemAssignments(id).then((result) => {
      if (!result.ok) {
        setAssignmentsError(result.error.message);
        return;
      }
      setAssignmentsError(null);
      setAssignments(result.data);
    });
  }

  function refreshComments() {
    if (!id) return;
    listWorkItemComments(id).then((result) => {
      if (!result.ok) {
        setCommentsError(result.error.message);
        return;
      }
      setCommentsError(null);
      setComments(result.data);
    });
  }

  useEffect(() => {
    if (!id || !workItem) return;

    let cancelled = false;

    listMembers(workItem.projectId).then((result) => {
      if (cancelled || !result.ok) return;
      setMembers(result.data);
    });
    listWorkItems(workItem.projectId).then((result) => {
      if (cancelled || !result.ok) return;
      setProjectWorkItems(result.data);
    });
    refreshAssignments();
    refreshComments();

    return () => {
      cancelled = true;
    };
  }, [id, workItem?.projectId]);

  async function handleChangeParent(event: FormEvent) {
    event.preventDefault();
    if (!id) return;

    setParentSaving(true);
    setParentSaveError(null);
    const result = await updateWorkItem(id, {
      parentId: parentSelection === '' ? null : parentSelection,
    });
    setParentSaving(false);

    if (!result.ok) {
      setParentSaveError(result.error.message);
      return;
    }
    setWorkItem(result.data);
  }

  async function handleAssign(event: FormEvent) {
    event.preventDefault();
    if (!id || !newAssignPrincipalId.trim()) return;

    setAssignBusyKey(`${newAssignPrincipalId}:${newAssignRole}`);
    setAssignActionError(null);
    const result = await assignWorkItem(id, newAssignPrincipalId, newAssignRole);
    setAssignBusyKey(null);

    if (!result.ok) {
      setAssignActionError(result.error.message);
      return;
    }
    setNewAssignPrincipalId('');
    refreshAssignments();
  }

  async function handleRemoveAssignment(principalId: string, role: WorkItemAssignmentRole) {
    if (!id) return;

    setAssignBusyKey(`${principalId}:${role}`);
    setAssignActionError(null);
    const result = await removeWorkItemAssignment(id, principalId, role);
    setAssignBusyKey(null);

    if (!result.ok) {
      setAssignActionError(result.error.message);
      return;
    }
    refreshAssignments();
  }

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

  async function handleAddComment(event: FormEvent) {
    event.preventDefault();
    if (!id || !newCommentBody.trim()) return;

    setCommentSubmitting(true);
    setCommentSubmitError(null);
    const result = await addWorkItemComment(id, newCommentBody);
    setCommentSubmitting(false);

    if (!result.ok) {
      setCommentSubmitError(result.error.message);
      return;
    }
    setNewCommentBody('');
    refreshComments();
  }

  async function handleArchive() {
    if (!id) return;
    if (!window.confirm('Archive this work item? It stays visible but is marked ARCHIVED.')) {
      return;
    }

    setArchiving(true);
    setArchiveError(null);
    const result = await archiveWorkItem(id);
    setArchiving(false);

    if (!result.ok) {
      setArchiveError(result.error.message);
      return;
    }
    setWorkItem(result.data);
    setStatus(result.data.status);
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
            {archiveError && <ErrorAlert message={archiveError} />}
            <Button
              variant="outlined"
              color="error"
              size="small"
              disabled={archiving || workItem.status === 'ARCHIVED'}
              onClick={handleArchive}
              sx={{ mt: 1.5 }}
            >
              {workItem.status === 'ARCHIVED'
                ? 'Archived'
                : archiving
                  ? 'Archiving…'
                  : 'Archive work item'}
            </Button>
          </Box>

          <Box sx={{ minWidth: 260 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Hierarchy
            </Typography>
            {parentSaveError && <ErrorAlert message={parentSaveError} />}

            <Stack spacing={0.5} sx={{ mb: 1.5 }}>
              <Typography variant="body2">
                <strong>Parent:</strong>{' '}
                {workItem.parentId ? (
                  <Link component={RouterLink} to={`/work-items/${workItem.parentId}`}>
                    {projectWorkItems.find((item) => item.id === workItem.parentId)?.title ??
                      workItem.parentId}
                  </Link>
                ) : (
                  <Typography component="span" variant="body2" color="text.secondary">
                    None
                  </Typography>
                )}
              </Typography>
            </Stack>

            <Stack component="form" onSubmit={handleChangeParent} spacing={1} sx={{ mb: 2 }}>
              <FormControl size="small">
                <Select
                  displayEmpty
                  value={parentSelection}
                  onChange={(event) => setParentSelection(event.target.value)}
                >
                  <MenuItem value="">None</MenuItem>
                  {projectWorkItems
                    .filter((item) => item.id !== workItem.id)
                    .map((item) => (
                      <MenuItem key={item.id} value={item.id}>
                        {item.title}
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>
              <Button
                type="submit"
                variant="outlined"
                size="small"
                disabled={parentSaving || parentSelection === (workItem.parentId ?? '')}
                sx={{ alignSelf: 'flex-start' }}
              >
                {parentSaving ? 'Saving…' : 'Change parent'}
              </Button>
            </Stack>

            <Typography variant="body2" gutterBottom>
              <strong>Children:</strong>
            </Typography>
            <Stack spacing={0.5}>
              {projectWorkItems
                .filter((item) => item.parentId === workItem.id)
                .map((child) => (
                  <Link key={child.id} component={RouterLink} to={`/work-items/${child.id}`}>
                    {child.title}
                  </Link>
                ))}
              {!projectWorkItems.some((item) => item.parentId === workItem.id) && (
                <Typography variant="caption" color="text.secondary">
                  None.
                </Typography>
              )}
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

          <Box sx={{ minWidth: 260 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Assignments
            </Typography>
            {assignmentsError && (
              <ErrorAlert message={`Failed to load assignments: ${assignmentsError}`} />
            )}
            {assignActionError && <ErrorAlert message={assignActionError} />}

            <Stack spacing={0.75} sx={{ mb: 1.5 }}>
              {assignments.map((assignment) => (
                <Chip
                  key={`${assignment.principalId}:${assignment.role}`}
                  label={`${assignment.role}: ${assignment.principalId}`}
                  size="small"
                  disabled={assignBusyKey === `${assignment.principalId}:${assignment.role}`}
                  onDelete={() => handleRemoveAssignment(assignment.principalId, assignment.role)}
                  sx={{ justifyContent: 'space-between', width: 'fit-content' }}
                />
              ))}
              {assignments.length === 0 && (
                <Typography variant="caption" color="text.secondary">
                  No assignments yet.
                </Typography>
              )}
            </Stack>

            <Stack component="form" onSubmit={handleAssign} spacing={1}>
              <FormControl size="small">
                <Select
                  displayEmpty
                  value={newAssignPrincipalId}
                  onChange={(event) => setNewAssignPrincipalId(event.target.value)}
                >
                  <MenuItem value="" disabled>
                    Principal
                  </MenuItem>
                  {members.map((member) => (
                    <MenuItem key={member.userId} value={member.userId}>
                      {member.userId}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small">
                <Select
                  value={newAssignRole}
                  onChange={(event) =>
                    setNewAssignRole(event.target.value as WorkItemAssignmentRole)
                  }
                >
                  {ASSIGNMENT_ROLES.map((role) => (
                    <MenuItem key={role} value={role}>
                      {role}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button
                type="submit"
                variant="outlined"
                size="small"
                disabled={!newAssignPrincipalId.trim()}
                sx={{ alignSelf: 'flex-start' }}
              >
                Assign
              </Button>
            </Stack>
          </Box>

          <Box sx={{ minWidth: 280 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Comments
            </Typography>
            {commentsError && <ErrorAlert message={`Failed to load comments: ${commentsError}`} />}

            <Stack spacing={1} sx={{ mb: 1.5 }}>
              {comments.map((comment) => (
                <Box key={comment.id} sx={{ borderLeft: 2, borderColor: 'divider', pl: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    {comment.principalId} · {new Date(comment.createdAt).toLocaleString()}
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {comment.body}
                  </Typography>
                </Box>
              ))}
              {comments.length === 0 && (
                <Typography variant="caption" color="text.secondary">
                  No comments yet.
                </Typography>
              )}
            </Stack>

            <Stack component="form" onSubmit={handleAddComment} spacing={1}>
              <TextField
                label="Add a comment"
                value={newCommentBody}
                onChange={(event) => setNewCommentBody(event.target.value)}
                multiline
                minRows={2}
                size="small"
              />
              <Button
                type="submit"
                variant="outlined"
                size="small"
                disabled={commentSubmitting || !newCommentBody.trim()}
                sx={{ alignSelf: 'flex-start' }}
              >
                {commentSubmitting ? 'Posting…' : 'Comment'}
              </Button>
              {commentSubmitError && <ErrorAlert message={commentSubmitError} />}
            </Stack>
          </Box>
        </Stack>
      )}
    </DetailPageLayout>
  );
}
