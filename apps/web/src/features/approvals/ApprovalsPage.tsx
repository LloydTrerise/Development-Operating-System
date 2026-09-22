import { useEffect, useMemo, useRef, useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import {
  Box,
  Button,
  Chip,
  List,
  ListItemButton,
  ListItemText,
  Paper,
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
} from '../../api-client.js';
import { ErrorAlert } from '../../components/ErrorAlert.js';
import { LoadingState } from '../../components/LoadingState.js';
import { StatusChip } from '../../components/StatusChip.js';
import { useProjectContext } from '../../project-context.js';

type EvidenceDetail = { artifactName: string; artifactType: string } | 'error';

const RISK_COLOR: Record<string, 'default' | 'warning' | 'error'> = {
  R0: 'default',
  R1: 'default',
  R2: 'warning',
  R3: 'error',
  R4: 'error',
};

const FILTERS = ['All', 'Pending', 'Decided'] as const;
type Filter = (typeof FILTERS)[number];

function relativeAge(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return iso;
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/**
 * DEVOS-218: the mockup's split-pane "Approval centre" — a fixed-height,
 * internally-scrolling list pane plus a detail pane for the selected
 * approval, on the same real data/logic `ApprovalsPage.tsx` already had.
 * This organically resolves the real, disclosed-but-deferred Sprint 31 gap
 * (specs/sprints/sprint-31/DEVOS-217.md): the page itself no longer grows
 * with the real approval count, since only the list panel scrolls.
 *
 * The mockup's "What will happen if you approve" / "Approval target" /
 * "Why approval is required" / "Traceability" boxes and its "Defer" action
 * are omitted — no real data source or backend capability exists anywhere
 * in this codebase for any of them (see specs/sprints/sprint-32/README.md's
 * own grounding). `riskClass` is the one new real field this sprint exposes
 * (`apps/api/src/dto/approval.ts`), additive and optional.
 */
export function ApprovalsPage() {
  const { selectedProjectId } = useProjectContext();
  const [searchParams] = useSearchParams();
  const linkedApprovalId = searchParams.get('approvalId');
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [evidenceDetails, setEvidenceDetails] = useState<Record<string, EvidenceDetail>>({});
  const requestedEvidenceIds = useRef<Set<string>>(new Set());
  const [filter, setFilter] = useState<Filter>('All');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  function refresh() {
    if (!selectedProjectId) {
      setApprovals([]);
      return;
    }
    setLoading(true);
    listApprovalsForProject(selectedProjectId).then((result) => {
      setLoading(false);
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
  // its owning artifact's name/type, once per id.
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

  // DEVOS-215/DEVOS-218: a run-linked `?approvalId=` selects that approval
  // directly into the detail pane — a strictly better outcome than Sprint
  // 31's own scroll-to-highlight, since the target is no longer buried in
  // an unbounded page.
  useEffect(() => {
    if (linkedApprovalId && approvals.some((approval) => approval.id === linkedApprovalId)) {
      setSelectedId(linkedApprovalId);
    }
  }, [linkedApprovalId, approvals]);

  const visibleApprovals = useMemo(() => {
    const sorted = [...approvals].sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
    if (filter === 'Pending') return sorted.filter((approval) => approval.status === 'PENDING');
    if (filter === 'Decided') return sorted.filter((approval) => approval.status !== 'PENDING');
    return sorted;
  }, [approvals, filter]);

  useEffect(() => {
    if (selectedId && visibleApprovals.some((approval) => approval.id === selectedId)) return;
    setSelectedId(visibleApprovals[0]?.id ?? null);
  }, [visibleApprovals, selectedId]);

  const selected = approvals.find((approval) => approval.id === selectedId) ?? null;

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

  return (
    <section>
      <Typography variant="h4" component="h2" gutterBottom>
        Approvals
      </Typography>

      {loadError && <ErrorAlert message={`Failed to load approvals: ${loadError}`} />}
      {decisionError && <ErrorAlert message={decisionError} />}
      {loading && <LoadingState label="Loading approvals…" />}

      {!loading && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'minmax(300px, 350px) minmax(0, 1fr)' },
            gap: 1.5,
            height: 'calc(100vh - 220px)',
            minHeight: 420,
          }}
        >
          <Paper variant="outlined" sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <Stack spacing={1} sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="subtitle1">Approval centre</Typography>
              <Stack direction="row" spacing={1}>
                {FILTERS.map((option) => (
                  <Chip
                    key={option}
                    label={option}
                    size="small"
                    color={filter === option ? 'primary' : 'default'}
                    onClick={() => setFilter(option)}
                  />
                ))}
              </Stack>
            </Stack>
            <List dense disablePadding sx={{ overflow: 'auto', flex: 1 }}>
              {visibleApprovals.map((approval) => (
                <ListItemButton
                  key={approval.id}
                  selected={approval.id === selectedId}
                  onClick={() => setSelectedId(approval.id)}
                  divider
                  sx={{ alignItems: 'flex-start', flexDirection: 'column', gap: 0.5, py: 1 }}
                >
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ width: '100%' }}>
                    {approval.riskClass && (
                      <Chip
                        label={approval.riskClass}
                        size="small"
                        color={RISK_COLOR[approval.riskClass] ?? 'default'}
                      />
                    )}
                    <Typography variant="body2" sx={{ flex: 1 }}>
                      {approval.approvalType}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {relativeAge(approval.requestedAt)}
                    </Typography>
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    requested by {approval.requestedBy}
                  </Typography>
                </ListItemButton>
              ))}
              {visibleApprovals.length === 0 && (
                <ListItemButton disabled sx={{ py: 2 }}>
                  <ListItemText primary="No approvals match this filter." />
                </ListItemButton>
              )}
            </List>
          </Paper>

          <Paper variant="outlined" sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {!selected && (
              <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                Select an approval to see its detail.
              </Typography>
            )}
            {selected && (
              <Box sx={{ overflow: 'auto', flex: 1, p: 2 }}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <Typography variant="h6">{selected.approvalType}</Typography>
                  <StatusChip status={selected.status} />
                  {selected.riskClass && (
                    <Chip
                      label={selected.riskClass}
                      size="small"
                      color={RISK_COLOR[selected.riskClass] ?? 'default'}
                    />
                  )}
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Requested by {selected.requestedBy} at {selected.requestedAt}
                  {selected.decidedBy && ` — decided by ${selected.decidedBy}`}
                  {selected.decisionReason && ` ("${selected.decisionReason}")`}
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  Run <code>{selected.workflowRunId}</code> —{' '}
                  <RouterLink to="/runs">view runs</RouterLink>
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  Requires {selected.requiredApprovers} approver
                  {selected.requiredApprovers === 1 ? '' : 's'}
                  {selected.reliabilityEvidence && (
                    <>
                      {' — reliability check: '}
                      {selected.reliabilityEvidence.signal}
                      {' (agent version '}
                      {selected.reliabilityEvidence.agentVersionId}
                      {')'}
                      {selected.reliabilityEvidence.appliedReducedRequiredApprovers !== undefined &&
                        ` — reduced to ${selected.reliabilityEvidence.appliedReducedRequiredApprovers}`}
                    </>
                  )}
                </Typography>

                <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
                  Evidence
                </Typography>
                <List dense disablePadding>
                  {selected.evidenceReference.artifactVersionIds.map((artifactVersionId) => {
                    const detail = evidenceDetails[artifactVersionId];
                    return (
                      <ListItemText
                        key={artifactVersionId}
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
                    );
                  })}
                  {selected.evidenceReference.artifactVersionIds.length === 0 && (
                    <ListItemText primary="No evidence attached." />
                  )}
                </List>

                {selected.status === 'PENDING' && (
                  <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 2 }}>
                    <TextField
                      label="Comment"
                      size="small"
                      value={comments[selected.id] ?? ''}
                      onChange={(event) =>
                        setComments((current) => ({
                          ...current,
                          [selected.id]: event.target.value,
                        }))
                      }
                      sx={{ flexGrow: 1 }}
                    />
                    <Button
                      variant="contained"
                      color="success"
                      disabled={decidingId === selected.id}
                      onClick={() => handleDecide(selected, 'approve')}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="outlined"
                      color="error"
                      disabled={decidingId === selected.id}
                      onClick={() => handleDecide(selected, 'reject')}
                    >
                      Reject
                    </Button>
                  </Stack>
                )}
              </Box>
            )}
          </Paper>
        </Box>
      )}
    </section>
  );
}
