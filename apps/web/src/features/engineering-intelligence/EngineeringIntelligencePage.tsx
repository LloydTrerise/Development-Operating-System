import { useEffect, useState } from 'react';
import {
  LinearProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import {
  getOrganisationEngineeringReport,
  getProjectEngineeringReport,
  getSlowestWorkflows,
  type OrganisationEngineeringReport,
  type ProjectEngineeringReport,
  type QualityReport,
  type RecoveryProxySummary,
  type SlowestWorkflowRow,
} from '../../api-client.js';
import { ErrorAlert } from '../../components/ErrorAlert.js';
import { useOrganisationContext } from '../../organisation-context.js';
import { useProjectContext } from '../../project-context.js';

function formatRate(rate: number): string {
  return `${(rate * 100).toFixed(0)}%`;
}

function rateColor(rate: number, count: number): 'success' | 'warning' | 'error' | 'inherit' {
  if (count === 0) return 'inherit';
  if (rate >= 0.9) return 'success';
  if (rate >= 0.7) return 'warning';
  return 'error';
}

function formatMs(ms: number): string {
  if (ms <= 0) return '0s';
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = minutes / 60;
  return `${hours.toFixed(1)}h`;
}

function QualitySummary({
  report,
  emptyMessage,
}: {
  report: QualityReport | null;
  emptyMessage: string;
}) {
  if (!report) {
    return (
      <Typography variant="body2" color="text.secondary">
        {emptyMessage}
      </Typography>
    );
  }

  return (
    <Stack spacing={2}>
      <div>
        <Typography variant="body2" data-testid="review-pass-rate">
          Review pass rate: {formatRate(report.reviewPassRate)} ({report.reviewCount} reviewed)
        </Typography>
        {report.reviewCount > 0 && (
          <LinearProgress
            variant="determinate"
            value={report.reviewPassRate * 100}
            color={rateColor(report.reviewPassRate, report.reviewCount)}
            sx={{ mt: 0.5, height: 6, borderRadius: 3 }}
          />
        )}
      </div>
      <div>
        <Typography variant="body2" data-testid="test-pass-rate">
          Test pass rate: {formatRate(report.testPassRate)} ({report.testCount} runs)
        </Typography>
        {report.testCount > 0 && (
          <LinearProgress
            variant="determinate"
            value={report.testPassRate * 100}
            color={rateColor(report.testPassRate, report.testCount)}
            sx={{ mt: 0.5, height: 6, borderRadius: 3 }}
          />
        )}
      </div>
      <div>
        <Typography variant="body2" data-testid="security-scan-pass-rate">
          Security scan pass rate: {formatRate(report.securityScanPassRate)} (
          {report.securityScanCount} scans)
        </Typography>
        {report.securityScanCount > 0 && (
          <LinearProgress
            variant="determinate"
            value={report.securityScanPassRate * 100}
            color={rateColor(report.securityScanPassRate, report.securityScanCount)}
            sx={{ mt: 0.5, height: 6, borderRadius: 3 }}
          />
        )}
      </div>
      <Typography variant="body2" data-testid="deploy-rollback-counts">
        Deploys: {report.deployCount} · Rollbacks: {report.rollbackCount}
      </Typography>
      <Typography variant="body2" data-testid="rework-cycle-count">
        Rework cycles: {report.reworkCycleCount}
      </Typography>
    </Stack>
  );
}

function RecoveryProxyLine({ proxy }: { proxy: RecoveryProxySummary }) {
  return (
    <Typography variant="body2" color="text.secondary">
      {proxy.label}: {proxy.sampleCount > 0 ? formatMs(proxy.meanMs) : 'no samples yet'} (
      {proxy.sampleCount} sample{proxy.sampleCount === 1 ? '' : 's'})
    </Typography>
  );
}

/**
 * DEVOS-171: the DORA section — deployment frequency, change failure rate,
 * lead time (p50/mean), and both real, separately-labelled time-to-restore
 * proxies (DEVOS-167/168/169). Every figure is real; the recovery-proxy
 * labels are shown verbatim, per DEVOS-169's own disclosure requirement —
 * never presented as a single unqualified "MTTR."
 */
function DoraSummary({
  report,
  incidentRecoveryProxy,
}: {
  report: QualityReport | null;
  incidentRecoveryProxy?: RecoveryProxySummary;
}) {
  if (!report) {
    return (
      <Typography variant="body2" color="text.secondary">
        No DORA data yet.
      </Typography>
    );
  }

  return (
    <Stack spacing={1}>
      <Typography variant="body2" data-testid="dora-deployment-frequency">
        Deployment frequency: {report.dora.deploymentsPerDay.toFixed(2)}/day (
        {report.dora.deploymentCount} deploys)
      </Typography>
      <Typography variant="body2" data-testid="dora-change-failure-rate">
        Change failure rate: {formatRate(report.dora.changeFailureRate)} (
        {report.dora.changeFailureCount} failures)
      </Typography>
      <Typography variant="body2" data-testid="dora-lead-time">
        Lead time for changes: p50 {formatMs(report.leadTime.leadTimeMsP50)}, mean{' '}
        {formatMs(report.leadTime.leadTimeMsMean)} ({report.leadTime.sampleCount} samples)
      </Typography>
      <RecoveryProxyLine proxy={report.releaseRecoveryProxy} />
      {incidentRecoveryProxy && <RecoveryProxyLine proxy={incidentRecoveryProxy} />}
    </Stack>
  );
}

/**
 * DEVOS-171: the bottleneck section — a real ranking sourced from the
 * worker's own live metrics registry (DEVOS-170), proxied through
 * `apps/api`. See `getSlowestWorkflows`'s own doc comment: this returns an
 * empty, not fabricated, list when the worker metrics bridge isn't
 * configured for this deployment.
 */
function BottleneckSummary({ rows }: { rows: SlowestWorkflowRow[] }) {
  if (rows.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No bottleneck data available (the worker metrics bridge may not be configured for this
        deployment).
      </Typography>
    );
  }

  return (
    <Table size="small" data-testid="slowest-workflows-table">
      <TableHead>
        <TableRow>
          <TableCell>Workflow</TableCell>
          <TableCell align="right">Mean duration</TableCell>
          <TableCell align="right">Tasks</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.workflowVersionId}>
            <TableCell>{row.workflowDefinitionName}</TableCell>
            <TableCell align="right">{formatMs(row.meanDurationMs)}</TableCell>
            <TableCell align="right">{row.taskCount}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/**
 * DEVOS-165/171: the first place a human can see any review/test/security-scan/
 * release evidence data, DORA metrics, or bottleneck data anywhere in the
 * product — real project and organisation pass rates, deploy/rollback/rework
 * counts (DEVOS-163/164), and real DORA/bottleneck figures (DEVOS-167–170),
 * closing the "no reporting surface at all" gap
 * `specs/DEVOS-ENGINEERING-INTELLIGENCE-BACKLOG.md` §2 found. A dedicated
 * page alongside `CostPage.tsx`/`GovernancePage.tsx`, not a section bolted
 * onto either — this sprint's own `README.md` records the same choice each
 * of those prior epics already made.
 */
export function EngineeringIntelligencePage() {
  const { selectedProjectId, projects } = useProjectContext();
  const { selectedOrganisationId } = useOrganisationContext();
  const [projectReport, setProjectReport] = useState<ProjectEngineeringReport | null>(null);
  const [organisationReport, setOrganisationReport] =
    useState<OrganisationEngineeringReport | null>(null);
  const [slowestWorkflows, setSlowestWorkflows] = useState<SlowestWorkflowRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const projectOrganisationId =
    projects.find((project) => project.id === selectedProjectId)?.organisationId ??
    selectedOrganisationId;

  useEffect(() => {
    if (!selectedProjectId) {
      setProjectReport(null);
      setOrganisationReport(null);
      setSlowestWorkflows([]);
      return;
    }

    let cancelled = false;

    Promise.all([
      getProjectEngineeringReport(selectedProjectId),
      projectOrganisationId
        ? getOrganisationEngineeringReport(projectOrganisationId)
        : Promise.resolve(null),
      getSlowestWorkflows(selectedProjectId),
    ]).then(([projectResult, organisationResult, slowestResult]) => {
      if (cancelled) return;

      const errors: string[] = [];
      if (!projectResult.ok) errors.push(projectResult.error.message);
      if (organisationResult && !organisationResult.ok)
        errors.push(organisationResult.error.message);
      if (!slowestResult.ok) errors.push(slowestResult.error.message);
      setLoadError(errors.length > 0 ? errors.join('; ') : null);

      if (projectResult.ok) setProjectReport(projectResult.data);
      if (organisationResult && organisationResult.ok) {
        setOrganisationReport(organisationResult.data);
      }
      if (slowestResult.ok) setSlowestWorkflows(slowestResult.data);
    });

    return () => {
      cancelled = true;
    };
  }, [selectedProjectId, projectOrganisationId]);

  if (!selectedProjectId) {
    return (
      <section>
        <Typography variant="h4" component="h2" gutterBottom>
          Engineering Intelligence
        </Typography>
        <Typography color="text.secondary">
          Select a project to view its engineering-intelligence data.
        </Typography>
      </section>
    );
  }

  return (
    <section>
      <Typography variant="h4" component="h2" gutterBottom>
        Engineering Intelligence
      </Typography>

      {loadError && <ErrorAlert message={`Failed to load engineering-report data: ${loadError}`} />}

      <Stack spacing={4}>
        <div>
          <Typography variant="h6" component="h3" gutterBottom>
            This project
          </Typography>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <QualitySummary
              report={projectReport}
              emptyMessage="No engineering-intelligence data recorded for this project yet."
            />
          </Paper>
        </div>

        <div>
          <Typography variant="h6" component="h3" gutterBottom>
            DORA metrics
          </Typography>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <DoraSummary
              report={projectReport}
              {...(projectReport?.incidentRecoveryProxy !== undefined
                ? { incidentRecoveryProxy: projectReport.incidentRecoveryProxy }
                : {})}
            />
          </Paper>
        </div>

        <div>
          <Typography variant="h6" component="h3" gutterBottom>
            Slowest workflows
          </Typography>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <BottleneckSummary rows={slowestWorkflows} />
          </Paper>
        </div>

        <div>
          <Typography variant="h6" component="h3" gutterBottom>
            This project&apos;s organisation
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            A real rollup across every project in this organisation (tenant-isolated — never crosses
            organisations). Rework-cycle count is not yet aggregated at organisation scope, always
            shown as 0 here — a real, disclosed limitation.
          </Typography>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <QualitySummary
              report={organisationReport}
              emptyMessage="No engineering-intelligence data recorded for this organisation yet."
            />
            {organisationReport && (
              <Typography variant="caption" color="text.secondary">
                Across {organisationReport.projectCount} project(s)
              </Typography>
            )}
          </Paper>
        </div>
      </Stack>
    </section>
  );
}
