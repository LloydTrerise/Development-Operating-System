import { Fragment, useCallback, useEffect, useState } from 'react';
import {
  Box,
  Button,
  List,
  ListItem,
  ListItemText,
  MenuItem,
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
  listApprovalsForProject,
  listAuditRecordsForOrganisation,
  listAuditRecordsForProject,
  listPoliciesForOrganisation,
  listPoliciesForProject,
  publishPolicy,
  simulatePolicy,
  type Approval,
  type AuditRecord,
  type Policy,
  type SimulatedPolicyDecision,
} from '../../api-client.js';
import { ErrorAlert } from '../../components/ErrorAlert.js';
import { PolicyAuthoringForm } from '../../components/PolicyAuthoringForm.js';
import { StatusChip } from '../../components/StatusChip.js';
import { useOrganisationContext } from '../../organisation-context.js';
import { useProjectContext } from '../../project-context.js';

/**
 * DEVOS-219: restyled into the mockup's 3-panel Governance layout (Policies,
 * Risk activity, Audit trail — `Design/DevOS.dc.html` lines 650-713), plus a
 * fourth Reliability-reduction-evidence panel the backlog's own acceptance
 * text explicitly requires preserving ("already real, per §2.3... preserved
 * and restyled, not rebuilt") even though the mockup's own Governance screen
 * has no Approvals section at all — see specs/sprints/sprint-32/README.md.
 * The generic full-approvals list DEVOS-090 originally put here is dropped,
 * since DEVOS-218 now gives Approvals its own dedicated, richer page; only
 * the narrow, real, backlog-mandated reliability-evidence subset remains.
 */
function PanelHeader({ title, meta }: { title: string; meta?: string }) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1}
      sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}
    >
      <Typography variant="subtitle1" sx={{ flex: 1 }}>
        {title}
      </Typography>
      {meta && (
        <Typography variant="caption" color="text.secondary">
          {meta}
        </Typography>
      )}
    </Stack>
  );
}

export function GovernancePage() {
  const { selectedProjectId, projects } = useProjectContext();
  const { selectedOrganisationId } = useOrganisationContext();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [organisationPolicies, setOrganisationPolicies] = useState<Policy[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [auditRecords, setAuditRecords] = useState<AuditRecord[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [previewResults, setPreviewResults] = useState<SimulatedPolicyDecision[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [organisationAuditRecords, setOrganisationAuditRecords] = useState<AuditRecord[]>([]);
  const [reportProjectFilter, setReportProjectFilter] = useState('');
  const [reportActorFilter, setReportActorFilter] = useState('');
  const [reportActionCategoryFilter, setReportActionCategoryFilter] = useState('');
  const [reportDateFrom, setReportDateFrom] = useState('');
  const [reportDateTo, setReportDateTo] = useState('');

  // DEVOS-140: a project's own organisation, even before the organisation
  // picker elsewhere in the app selects one — matches the real project's
  // `organisationId` a policy authored here would actually be scoped to.
  const projectOrganisationId =
    projects.find((project) => project.id === selectedProjectId)?.organisationId ??
    selectedOrganisationId;

  const refresh = useCallback(() => setRefreshToken((token) => token + 1), []);

  useEffect(() => {
    if (!selectedProjectId) {
      setPolicies([]);
      setApprovals([]);
      setAuditRecords([]);
      setOrganisationPolicies([]);
      setOrganisationAuditRecords([]);
      return;
    }

    let cancelled = false;

    Promise.all([
      listPoliciesForProject(selectedProjectId),
      listApprovalsForProject(selectedProjectId),
      listAuditRecordsForProject(selectedProjectId),
      projectOrganisationId
        ? listPoliciesForOrganisation(projectOrganisationId)
        : Promise.resolve({ ok: true as const, data: [] as Policy[] }),
      projectOrganisationId
        ? listAuditRecordsForOrganisation(projectOrganisationId)
        : Promise.resolve({ ok: true as const, data: [] as AuditRecord[] }),
    ]).then(
      ([
        policiesResult,
        approvalsResult,
        auditResult,
        organisationPoliciesResult,
        organisationAuditResult,
      ]) => {
        if (cancelled) return;

        const errors = [
          policiesResult,
          approvalsResult,
          auditResult,
          organisationPoliciesResult,
          organisationAuditResult,
        ]
          .filter((result) => !result.ok)
          .map((result) => (result.ok ? '' : result.error.message));
        setLoadError(errors.length > 0 ? errors.join('; ') : null);

        if (policiesResult.ok) setPolicies(policiesResult.data);
        if (approvalsResult.ok) setApprovals(approvalsResult.data);
        if (auditResult.ok) setAuditRecords(auditResult.data);
        if (organisationPoliciesResult.ok) setOrganisationPolicies(organisationPoliciesResult.data);
        if (organisationAuditResult.ok) setOrganisationAuditRecords(organisationAuditResult.data);
      },
    );

    return () => {
      cancelled = true;
    };
  }, [selectedProjectId, projectOrganisationId, refreshToken]);

  async function handlePublish(policyId: string): Promise<void> {
    setPublishingId(policyId);
    const result = await publishPolicy(policyId);
    setPublishingId(null);
    if (!result.ok) {
      setLoadError(result.error.message);
      return;
    }
    refresh();
  }

  async function handlePreview(policyId: string): Promise<void> {
    if (previewingId === policyId) {
      setPreviewingId(null);
      return;
    }
    setPreviewingId(policyId);
    setPreviewLoading(true);
    setPreviewResults([]);
    const result = await simulatePolicy(policyId);
    setPreviewLoading(false);
    if (!result.ok) {
      setLoadError(result.error.message);
      return;
    }
    setPreviewResults(result.data);
  }

  if (!selectedProjectId) {
    return (
      <section>
        <Typography variant="h4" component="h2" gutterBottom>
          Governance
        </Typography>
        <Typography color="text.secondary">
          Select a project to view its governance information.
        </Typography>
      </section>
    );
  }

  const filteredComplianceRecords = organisationAuditRecords.filter((record) => {
    if (reportProjectFilter && record.projectId !== reportProjectFilter) return false;
    if (
      reportActorFilter &&
      !record.actorId.toLowerCase().includes(reportActorFilter.toLowerCase())
    ) {
      return false;
    }
    if (
      reportActionCategoryFilter &&
      !record.action.toLowerCase().startsWith(reportActionCategoryFilter.toLowerCase())
    ) {
      return false;
    }
    if (reportDateFrom && record.createdAt < reportDateFrom) return false;
    if (reportDateTo && record.createdAt > `${reportDateTo}T23:59:59.999Z`) return false;
    return true;
  });

  function exportComplianceCsv(): void {
    const header = [
      'id',
      'projectId',
      'actorType',
      'actorId',
      'action',
      'targetType',
      'targetId',
      'outcome',
      'correlationId',
      'createdAt',
    ];
    const rows = filteredComplianceRecords.map((record) =>
      [
        record.id,
        record.projectId ?? '',
        record.actorType,
        record.actorId,
        record.action,
        record.targetType,
        record.targetId,
        record.outcome,
        record.correlationId ?? '',
        record.createdAt,
      ]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(','),
    );
    const csv = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `compliance-report-${projectOrganisationId ?? 'organisation'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const riskActivity = auditRecords
    .filter((record) => record.outcome === 'FAILURE')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const reliabilityEvidenceApprovals = approvals.filter(
    (approval) => approval.reliabilityEvidence,
  );

  return (
    <section>
      <Typography variant="h4" component="h2" gutterBottom>
        Governance
      </Typography>

      {loadError && <ErrorAlert message={`Failed to load governance data: ${loadError}`} />}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.25fr) minmax(0, 1fr)' },
          gridAutoRows: 'min-content',
          gap: 1.5,
        }}
      >
        <Paper variant="outlined" sx={{ gridRow: { md: 'span 2' } }}>
          <PanelHeader
            title="Policies"
            meta={`${policies.length + organisationPolicies.length} total`}
          />
          <Box sx={{ p: 1.5 }}>
            <PolicyAuthoringForm
              projectId={selectedProjectId}
              organisationId={projectOrganisationId ?? null}
              onCreated={refresh}
            />

            <Typography variant="subtitle2" sx={{ mt: 3 }} gutterBottom>
              This project
            </Typography>
            <List dense disablePadding>
              {policies.map((policy) => (
                <Fragment key={policy.id}>
                  <ListItem disableGutters>
                    <ListItemText
                      primary={
                        <>
                          <code>{policy.key}</code> v{policy.version}
                        </>
                      }
                      secondary={policy.publishedAt && `published ${policy.publishedAt}`}
                    />
                    <StatusChip status={policy.status} />
                    {policy.status === 'DRAFT' && (
                      <>
                        <Button size="small" onClick={() => void handlePreview(policy.id)} sx={{ ml: 1 }}>
                          {previewingId === policy.id ? 'Hide preview' : 'Preview'}
                        </Button>
                        <Button
                          size="small"
                          onClick={() => void handlePublish(policy.id)}
                          disabled={publishingId === policy.id}
                          sx={{ ml: 1 }}
                        >
                          Publish
                        </Button>
                      </>
                    )}
                  </ListItem>
                  {previewingId === policy.id && (
                    <PolicySimulationPreview loading={previewLoading} results={previewResults} />
                  )}
                </Fragment>
              ))}
              {policies.length === 0 && (
                <ListItem disableGutters>
                  <ListItemText primary="No policies registered for this project." />
                </ListItem>
              )}
            </List>

            <Typography variant="subtitle2" sx={{ mt: 3 }} gutterBottom>
              This project&apos;s organisation
            </Typography>
            <List dense disablePadding>
              {organisationPolicies.map((policy) => (
                <Fragment key={policy.id}>
                  <ListItem disableGutters>
                    <ListItemText
                      primary={
                        <>
                          <code>{policy.key}</code> v{policy.version}
                        </>
                      }
                      secondary="Organisation-wide — takes precedence over project policies"
                    />
                    <StatusChip status={policy.status} />
                    {policy.status === 'DRAFT' && (
                      <>
                        <Button size="small" onClick={() => void handlePreview(policy.id)} sx={{ ml: 1 }}>
                          {previewingId === policy.id ? 'Hide preview' : 'Preview'}
                        </Button>
                        <Button
                          size="small"
                          onClick={() => void handlePublish(policy.id)}
                          disabled={publishingId === policy.id}
                          sx={{ ml: 1 }}
                        >
                          Publish
                        </Button>
                      </>
                    )}
                  </ListItem>
                  {previewingId === policy.id && (
                    <PolicySimulationPreview loading={previewLoading} results={previewResults} />
                  )}
                </Fragment>
              ))}
              {organisationPolicies.length === 0 && (
                <ListItem disableGutters>
                  <ListItemText primary="No organisation-scoped policies registered." />
                </ListItem>
              )}
            </List>
          </Box>
        </Paper>

        <Paper variant="outlined">
          <PanelHeader title="Risk activity" meta="denied/failed actions" />
          <List dense disablePadding sx={{ maxHeight: 320, overflow: 'auto' }}>
            {riskActivity.map((record) => (
              <ListItem key={record.id} disableGutters sx={{ px: 1.5 }}>
                <ListItemText
                  primary={
                    <>
                      <strong>{record.action}</strong> on {record.targetType}{' '}
                      <code>{record.targetId}</code>
                    </>
                  }
                  secondary={`by ${record.actorId} at ${record.createdAt}`}
                />
              </ListItem>
            ))}
            {riskActivity.length === 0 && (
              <ListItem disableGutters sx={{ px: 1.5 }}>
                <ListItemText primary="No denied or failed activity recorded." />
              </ListItem>
            )}
          </List>
        </Paper>

        <Paper variant="outlined">
          <PanelHeader
            title="Reliability-reduction evidence"
            meta={`${reliabilityEvidenceApprovals.length} checked`}
          />
          <List dense disablePadding sx={{ maxHeight: 320, overflow: 'auto' }}>
            {reliabilityEvidenceApprovals.map((approval) => (
              <ListItem key={approval.id} disableGutters sx={{ px: 1.5 }}>
                <ListItemText
                  primary={
                    <>
                      {approval.approvalType} — requires {approval.requiredApprovers} approver
                      {approval.requiredApprovers === 1 ? '' : 's'}
                    </>
                  }
                  secondary={
                    <>
                      {'reliability check: '}
                      {approval.reliabilityEvidence!.signal}
                      {' (agent version '}
                      {approval.reliabilityEvidence!.agentVersionId}
                      {')'}
                      {approval.reliabilityEvidence!.appliedReducedRequiredApprovers !==
                        undefined &&
                        ` — reduced to ${approval.reliabilityEvidence!.appliedReducedRequiredApprovers}`}
                    </>
                  }
                />
                <StatusChip status={approval.status} />
              </ListItem>
            ))}
            {reliabilityEvidenceApprovals.length === 0 && (
              <ListItem disableGutters sx={{ px: 1.5 }}>
                <ListItemText primary="No approval has checked a reliability reduction yet." />
              </ListItem>
            )}
          </List>
        </Paper>

        <Paper variant="outlined" sx={{ gridColumn: { md: '1 / -1' } }}>
          <PanelHeader title="Audit trail" meta="this project's organisation" />
          <Stack
            direction="row"
            spacing={1}
            flexWrap="wrap"
            useFlexGap
            sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}
          >
            <TextField
              select
              label="Project"
              size="small"
              value={reportProjectFilter}
              onChange={(event) => setReportProjectFilter(event.target.value)}
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="">
                <em>All projects</em>
              </MenuItem>
              {projects
                .filter((project) => project.organisationId === projectOrganisationId)
                .map((project) => (
                  <MenuItem key={project.id} value={project.id}>
                    {project.name}
                  </MenuItem>
                ))}
            </TextField>
            <TextField
              label="Actor"
              size="small"
              value={reportActorFilter}
              onChange={(event) => setReportActorFilter(event.target.value)}
            />
            <TextField
              label="Action starts with"
              size="small"
              placeholder="e.g. tool_invocation."
              value={reportActionCategoryFilter}
              onChange={(event) => setReportActionCategoryFilter(event.target.value)}
            />
            <TextField
              label="From"
              type="date"
              size="small"
              value={reportDateFrom}
              onChange={(event) => setReportDateFrom(event.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="To"
              type="date"
              size="small"
              value={reportDateTo}
              onChange={(event) => setReportDateTo(event.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <Button
              variant="outlined"
              onClick={exportComplianceCsv}
              disabled={filteredComplianceRecords.length === 0}
            >
              Export CSV
            </Button>
          </Stack>
          <Box sx={{ maxHeight: 420, overflow: 'auto' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Time</TableCell>
                  <TableCell>Actor</TableCell>
                  <TableCell>Action</TableCell>
                  <TableCell>Target</TableCell>
                  <TableCell>Outcome</TableCell>
                  <TableCell>Correlation</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredComplianceRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>{record.createdAt}</TableCell>
                    <TableCell>{record.actorId}</TableCell>
                    <TableCell>
                      <code>{record.action}</code>
                    </TableCell>
                    <TableCell>
                      {record.targetType} <code>{record.targetId}</code>
                    </TableCell>
                    <TableCell>{record.outcome}</TableCell>
                    <TableCell>
                      {record.correlationId ? <code>{record.correlationId}</code> : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {filteredComplianceRecords.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ p: 1.5 }}>
                No audit records match the current filters.
              </Typography>
            )}
          </Box>
        </Paper>
      </Box>
    </section>
  );
}

/** DEVOS-141: what this draft would decide for each real, recent historical
 * request that actually carried a recorded capability — next to what
 * actually happened, so an author can compare before publishing. */
function PolicySimulationPreview({
  loading,
  results,
}: {
  loading: boolean;
  results: SimulatedPolicyDecision[];
}) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, mb: 1, ml: 2 }}>
      {loading && <Typography variant="body2">Simulating against recent activity…</Typography>}
      {!loading && results.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          No recent activity with a recorded action to simulate against.
        </Typography>
      )}
      {!loading && results.length > 0 && (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Action</TableCell>
              <TableCell>Actual outcome</TableCell>
              <TableCell>Simulated decision</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {results.map((result) => (
              <TableRow key={result.auditRecordId}>
                <TableCell>{result.action}</TableCell>
                <TableCell>{result.actualOutcome}</TableCell>
                <TableCell>{result.decision.decision}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Paper>
  );
}
