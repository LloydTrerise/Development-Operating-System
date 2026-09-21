import { Fragment, useCallback, useEffect, useState } from 'react';
import {
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
} from '../api-client.js';
import { ErrorAlert } from '../components/ErrorAlert.js';
import { PolicyAuthoringForm } from '../components/PolicyAuthoringForm.js';
import { StatusChip } from '../components/StatusChip.js';
import { useOrganisationContext } from '../organisation-context.js';
import { useProjectContext } from '../project-context.js';

/**
 * DEVOS-090 — no wireframe exists anywhere in the spec corpus for this page
 * (the same "build to the task's own acceptance criterion" precedent
 * DEVOS-046/060/070/080 already established for un-wireframed UI work).
 * Three sections, each backed by a real, already-existing endpoint — no new
 * API surface was added beyond two new read-only client functions
 * (`listPoliciesForProject`, `listAuditRecordsForProject`) wrapping routes
 * that already existed and were already isolation-tested (DEVOS-084):
 *
 *  - Policies: every policy registered for the project, published or draft.
 *  - Approvals: reuses ApprovalsPage's own data source, summarised rather
 *    than duplicating its full decide-approval workflow.
 *  - Risk activity: `outcome === 'FAILURE'` audit records — a real, already
 *    -recorded signal (every policy denial, capability denial, and failed
 *    tool invocation writes exactly this), not a fabricated risk score.
 */
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

  return (
    <section>
      <Typography variant="h4" component="h2" gutterBottom>
        Governance
      </Typography>

      {loadError && <ErrorAlert message={`Failed to load governance data: ${loadError}`} />}

      <Stack spacing={4}>
        <PolicyAuthoringForm
          projectId={selectedProjectId}
          organisationId={projectOrganisationId ?? null}
          onCreated={refresh}
        />

        <div>
          <Typography variant="h6" component="h3" gutterBottom>
            Policies — this project
          </Typography>
          <List dense>
            {policies.map((policy) => (
              <Fragment key={policy.id}>
                <ListItem disableGutters>
                  <ListItemText
                    primary={
                      <>
                        <strong>{policy.key}</strong> v{policy.version}
                        {policy.publishedAt && ` — published ${policy.publishedAt}`}
                      </>
                    }
                  />
                  <StatusChip status={policy.status} />
                  {policy.status === 'DRAFT' && (
                    <>
                      <Button
                        size="small"
                        onClick={() => void handlePreview(policy.id)}
                        sx={{ ml: 1 }}
                      >
                        {previewingId === policy.id
                          ? 'Hide preview'
                          : 'Preview against recent activity'}
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
        </div>

        <div>
          <Typography variant="h6" component="h3" gutterBottom>
            Policies — this project&apos;s organisation
          </Typography>
          <List dense>
            {organisationPolicies.map((policy) => (
              <Fragment key={policy.id}>
                <ListItem disableGutters>
                  <ListItemText
                    primary={
                      <>
                        <strong>{policy.key}</strong> v{policy.version}
                        {policy.publishedAt && ` — published ${policy.publishedAt}`}
                      </>
                    }
                    secondary="Organisation-wide — takes precedence over this project's own policies"
                  />
                  <StatusChip status={policy.status} />
                  {policy.status === 'DRAFT' && (
                    <>
                      <Button
                        size="small"
                        onClick={() => void handlePreview(policy.id)}
                        sx={{ ml: 1 }}
                      >
                        {previewingId === policy.id
                          ? 'Hide preview'
                          : 'Preview against recent activity'}
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
        </div>

        <div>
          <Typography variant="h6" component="h3" gutterBottom>
            Approvals
          </Typography>
          <List dense>
            {approvals.map((approval) => (
              <ListItem key={approval.id} disableGutters>
                <ListItemText
                  primary={
                    <>
                      {approval.approvalType} — requires {approval.requiredApprovers} approver
                      {approval.requiredApprovers === 1 ? '' : 's'}
                    </>
                  }
                  secondary={
                    <>
                      {approval.decidedBy
                        ? `decided by ${approval.decidedBy}`
                        : `requested by ${approval.requestedBy}`}
                      {approval.reliabilityEvidence && (
                        <>
                          {' — reliability check: '}
                          {approval.reliabilityEvidence.signal}
                          {' (agent version '}
                          {approval.reliabilityEvidence.agentVersionId}
                          {')'}
                          {approval.reliabilityEvidence.appliedReducedRequiredApprovers !==
                            undefined &&
                            ` — reduced to ${approval.reliabilityEvidence.appliedReducedRequiredApprovers} required approver${approval.reliabilityEvidence.appliedReducedRequiredApprovers === 1 ? '' : 's'}`}
                        </>
                      )}
                    </>
                  }
                />
                <StatusChip status={approval.status} />
              </ListItem>
            ))}
            {approvals.length === 0 && (
              <ListItem disableGutters>
                <ListItemText primary="No approvals recorded for this project." />
              </ListItem>
            )}
          </List>
        </div>

        <div>
          <Typography variant="h6" component="h3" gutterBottom>
            Risk activity
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Denied or failed security-significant actions, most recent first.
          </Typography>
          <List dense>
            {riskActivity.map((record) => (
              <ListItem key={record.id} disableGutters>
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
              <ListItem disableGutters>
                <ListItemText primary="No denied or failed activity recorded." />
              </ListItem>
            )}
          </List>
        </div>

        <div>
          <Typography variant="h6" component="h3" gutterBottom>
            Compliance report — this project&apos;s organisation
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Every real audit record across this organisation&apos;s own projects (tenant-isolated —
            never crosses organisations).
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
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
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Project</TableCell>
                <TableCell>Actor</TableCell>
                <TableCell>Action</TableCell>
                <TableCell>Outcome</TableCell>
                <TableCell>When</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredComplianceRecords.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>
                    {projects.find((project) => project.id === record.projectId)?.name ??
                      record.projectId}
                  </TableCell>
                  <TableCell>{record.actorId}</TableCell>
                  <TableCell>{record.action}</TableCell>
                  <TableCell>{record.outcome}</TableCell>
                  <TableCell>{record.createdAt}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filteredComplianceRecords.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              No audit records match the current filters.
            </Typography>
          )}
        </div>
      </Stack>
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
