import { useEffect, useRef, useState } from 'react';
import {
  Button,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  approveApproval,
  getArtifactVersionById,
  listApprovalsForProject,
  rejectApproval,
  type Approval,
} from '../api-client.js';
import { ErrorAlert } from '../components/ErrorAlert.js';
import { StatusChip } from '../components/StatusChip.js';
import { useProjectContext } from '../project-context.js';

/**
 * DEVOS-046 — a minimal approval inbox: pending approvals a reviewer can act
 * on, with the evidence being approved, and a record of already-decided
 * ones. Only a bare `approvals` feature-folder name is mentioned anywhere in
 * the specs (specs/architecture/repository-code-structure.md §10) — no
 * page/component behavior is specified, so this UI shape is an
 * implementation choice, mirroring RunsPage's established structure rather
 * than inventing a new pattern.
 *
 * DEVOS-095: evidence is now resolved from the raw `artifactVersionIds`
 * (DEVOS-045) into each version's owning artifact name/type via the new
 * `GET /artifact-versions/:id` endpoint, closing the gap this file's own
 * doc comment used to flag here.
 */
type EvidenceDetail = { artifactName: string; artifactType: string } | 'error';

export function ApprovalsPage() {
  const { selectedProjectId } = useProjectContext();
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [evidenceDetails, setEvidenceDetails] = useState<Record<string, EvidenceDetail>>({});
  const requestedEvidenceIds = useRef<Set<string>>(new Set());

  function refresh() {
    if (!selectedProjectId) {
      setApprovals([]);
      return;
    }
    listApprovalsForProject(selectedProjectId).then((result) => {
      if (result.ok) {
        setLoadError(null);
        setApprovals(result.data);
      } else {
        setLoadError(result.error.message);
      }
    });
  }

  useEffect(refresh, [selectedProjectId]);

  // DEVOS-095: resolve each not-yet-seen evidence artifact-version id to
  // its owning artifact's name/type, once per id (tracked in a ref so a
  // re-render triggered by the fetch itself doesn't re-request the same
  // id), across every approval currently loaded, not just pending ones.
  useEffect(() => {
    const idsToFetch = approvals
      .flatMap((approval) => approval.evidenceReference.artifactVersionIds)
      .filter((id) => !requestedEvidenceIds.current.has(id));

    for (const id of idsToFetch) {
      requestedEvidenceIds.current.add(id);
      getArtifactVersionById(id).then((result) => {
        setEvidenceDetails((current) => ({
          ...current,
          [id]: result.ok
            ? { artifactName: result.data.artifactName, artifactType: result.data.artifactType }
            : 'error',
        }));
      });
    }
  }, [approvals]);

  async function handleDecide(approval: Approval, decision: 'approve' | 'reject') {
    setDecidingId(approval.id);
    setDecisionError(null);

    const comment = comments[approval.id];
    const decide = decision === 'approve' ? approveApproval : rejectApproval;
    const result = await decide(approval.id, {
      scopeHash: approval.evidenceReference.scopeHash,
      ...(comment ? { comment } : {}),
    });

    setDecidingId(null);
    if (!result.ok) {
      setDecisionError(result.error.message);
      return;
    }
    refresh();
  }

  if (!selectedProjectId) {
    return (
      <section>
        <Typography variant="h4" component="h2" gutterBottom>
          Approvals
        </Typography>
        <Typography color="text.secondary">Select a project to review approvals.</Typography>
      </section>
    );
  }

  const pending = approvals.filter((approval) => approval.status === 'PENDING');
  const decided = approvals.filter((approval) => approval.status !== 'PENDING');

  return (
    <section>
      <Typography variant="h4" component="h2" gutterBottom>
        Approvals
      </Typography>

      {loadError && <ErrorAlert message={`Failed to load approvals: ${loadError}`} />}
      {decisionError && <ErrorAlert message={decisionError} />}

      <Typography variant="h6" component="h3" gutterBottom>
        Pending
      </Typography>
      <Stack spacing={2} sx={{ mb: 4 }}>
        {pending.map((approval) => (
          <Card key={approval.id} variant="outlined">
            <CardContent>
              <Typography gutterBottom>
                <strong>{approval.approvalType}</strong> for run{' '}
                <code>{approval.workflowRunId}</code> — requested by {approval.requestedBy} at{' '}
                {approval.requestedAt}
              </Typography>

              <Typography variant="subtitle2" sx={{ mt: 2 }}>
                Evidence
              </Typography>
              <List dense disablePadding>
                {approval.evidenceReference.artifactVersionIds.map((artifactVersionId) => {
                  const detail = evidenceDetails[artifactVersionId];
                  return (
                    <ListItem key={artifactVersionId} disableGutters>
                      <ListItemText
                        primary={
                          detail && detail !== 'error' ? (
                            <>
                              <strong>{detail.artifactName}</strong> ({detail.artifactType})
                            </>
                          ) : (
                            <code>{artifactVersionId}</code>
                          )
                        }
                      />
                    </ListItem>
                  );
                })}
              </List>

              <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 2 }}>
                <TextField
                  label="Comment"
                  size="small"
                  value={comments[approval.id] ?? ''}
                  onChange={(event) =>
                    setComments((current) => ({ ...current, [approval.id]: event.target.value }))
                  }
                  sx={{ flexGrow: 1 }}
                />
                <Button
                  variant="contained"
                  color="success"
                  disabled={decidingId === approval.id}
                  onClick={() => handleDecide(approval, 'approve')}
                >
                  Approve
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  disabled={decidingId === approval.id}
                  onClick={() => handleDecide(approval, 'reject')}
                >
                  Reject
                </Button>
              </Stack>
            </CardContent>
          </Card>
        ))}
        {pending.length === 0 && (
          <Typography color="text.secondary">No pending approvals.</Typography>
        )}
      </Stack>

      <Typography variant="h6" component="h3" gutterBottom>
        Decided
      </Typography>
      <List dense>
        {decided.map((approval) => (
          <ListItem key={approval.id} disableGutters>
            <ListItemText
              primary={approval.approvalType}
              secondary={
                <>
                  {approval.decidedBy && `by ${approval.decidedBy}`}
                  {approval.decisionReason && ` — "${approval.decisionReason}"`}
                </>
              }
            />
            <StatusChip status={approval.status} />
          </ListItem>
        ))}
        {decided.length === 0 && (
          <ListItem disableGutters>
            <ListItemText primary="No decided approvals yet." />
          </ListItem>
        )}
      </List>
    </section>
  );
}
