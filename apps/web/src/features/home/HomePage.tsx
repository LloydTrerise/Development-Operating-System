import { useNavigate } from 'react-router-dom';
import { Box, Card, Chip, Stack, Typography } from '@mui/material';
import { ErrorAlert } from '../../components/ErrorAlert.js';
import { LoadingState } from '../../components/LoadingState.js';
import { StatusChip } from '../../components/StatusChip.js';
import { useProjectContext } from '../../project-context.js';
import { useHomeDashboardData, type ActiveRun } from './use-home-dashboard-data.js';
import type { Approval, AuditRecord, SystemHealth } from '../../api-client.js';

function KpiTile({ label, value, to }: { label: string; value: number; to?: string }) {
  const navigate = useNavigate();
  return (
    <Card
      variant="outlined"
      onClick={to ? () => navigate(to) : undefined}
      sx={{ p: 2, cursor: to ? 'pointer' : 'default' }}
    >
      <Typography variant="overline" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h4" component="div" sx={{ mt: 0.5 }}>
        {value}
      </Typography>
    </Card>
  );
}

/**
 * DEVOS-259: not a reuse of `KpiTile` (numeric-only) — system health is a
 * status plus a real integration/capability breakdown, not a single count.
 * The chip is driven by `database` (DEVOS-258's own one signal with
 * genuine binary fault semantics); the breakdown text deliberately makes
 * no "ok/degraded" judgement about a `DISABLED` capability, which is a
 * real admin action (DEVOS-256), not a fault.
 */
function SystemHealthTile({ health, to }: { health: SystemHealth | null; to?: string }) {
  const navigate = useNavigate();
  return (
    <Card
      variant="outlined"
      onClick={to ? () => navigate(to) : undefined}
      sx={{ p: 2, cursor: to ? 'pointer' : 'default' }}
    >
      <Typography variant="overline" color="text.secondary">
        System Health
      </Typography>
      <Box sx={{ mt: 0.5 }}>
        <Chip
          label={health ? (health.database === 'ok' ? 'OK' : 'DEGRADED') : '—'}
          color={health ? (health.database === 'ok' ? 'success' : 'error') : 'default'}
          size="small"
        />
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
        {health
          ? `${health.integrations.active}/${health.integrations.total} integrations · ${health.capabilities.active}/${health.capabilities.total} capabilities`
          : 'No data'}
      </Typography>
    </Card>
  );
}

/** Home is an at-a-glance summary, not a full list view — every section
 * caps its rendered rows to this many and shows the real total count in
 * its own header, with a link to the real full list page for the rest. */
const HOME_LIST_LIMIT = 8;

function SectionCard({
  title,
  count,
  action,
  children,
}: {
  title: string;
  count?: number;
  action?: { label: string; to: string };
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <Card variant="outlined">
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}
      >
        <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
          {title}
        </Typography>
        {count !== undefined && (
          <Typography variant="caption" color="text.secondary">
            {count} {count === 1 ? 'item' : 'items'}
          </Typography>
        )}
        {action && (
          <Typography
            variant="body2"
            color="primary"
            onClick={() => navigate(action.to)}
            sx={{ cursor: 'pointer' }}
          >
            {action.label}
          </Typography>
        )}
      </Stack>
      <Box>{children}</Box>
    </Card>
  );
}

function NeedsAttentionRow({ approval }: { approval: Approval }) {
  const navigate = useNavigate();
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1.5}
      onClick={() => navigate('/approvals')}
      sx={{ px: 2, py: 1.25, borderTop: 1, borderColor: 'divider', cursor: 'pointer' }}
    >
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography variant="body2" noWrap>
          {approval.approvalType}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Requested {new Date(approval.requestedAt).toLocaleString()}
        </Typography>
      </Box>
      <StatusChip status={approval.status} />
    </Stack>
  );
}

function ActiveWorkRow({ run }: { run: ActiveRun }) {
  const navigate = useNavigate();
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1.5}
      onClick={() => navigate('/runs')}
      sx={{ px: 2, py: 1.25, borderTop: 1, borderColor: 'divider', cursor: 'pointer' }}
    >
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography variant="body2" noWrap>
          {run.workflowName}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Started {new Date(run.createdAt).toLocaleString()}
        </Typography>
      </Box>
      <StatusChip status={run.status} />
    </Stack>
  );
}

function ActivityRow({ record }: { record: AuditRecord }) {
  const navigate = useNavigate();
  return (
    <Stack
      direction="row"
      alignItems="flex-start"
      spacing={1.5}
      onClick={() => navigate('/governance')}
      sx={{ px: 2, py: 1.25, borderTop: 1, borderColor: 'divider', cursor: 'pointer' }}
    >
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography variant="body2" noWrap>
          {record.action} · {record.targetType}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {record.outcome} · {new Date(record.createdAt).toLocaleString()}
        </Typography>
      </Box>
    </Stack>
  );
}

function EmptyRow({ label }: { label: string }) {
  return (
    <Box sx={{ px: 2, py: 2 }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
    </Box>
  );
}

export function HomePage() {
  const { selectedProjectId } = useProjectContext();
  const {
    workItemCount,
    artifactCount,
    activeIntegrationCount,
    systemHealth,
    pendingApprovals,
    activeRuns,
    recentActivity,
    loading,
    error,
  } = useHomeDashboardData(selectedProjectId);

  return (
    <Box>
      <Typography variant="h5" component="h2" gutterBottom>
        Home
      </Typography>

      {!selectedProjectId && (
        <Typography variant="body2" color="text.secondary">
          Select a project to see its dashboard.
        </Typography>
      )}

      {selectedProjectId && (
        <>
          {error && <ErrorAlert message={error} />}
          {loading && <LoadingState label="Loading dashboard…" />}

          {!loading && !error && (
            <Stack spacing={2}>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(6, 1fr)',
                  gap: 1.5,
                }}
              >
                <KpiTile label="Work Items" value={workItemCount} to="/work-items" />
                <KpiTile label="Runs In Progress" value={activeRuns.length} to="/runs" />
                <KpiTile
                  label="Pending Approvals"
                  value={pendingApprovals.length}
                  to="/approvals"
                />
                <KpiTile label="Artifacts" value={artifactCount} to="/artifacts" />
                <KpiTile label="Integrations" value={activeIntegrationCount} to="/integrations" />
                <SystemHealthTile health={systemHealth} to="/integrations" />
              </Box>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1.55fr) minmax(0, 1fr)',
                  gap: 1.5,
                }}
              >
                <Stack spacing={1.5}>
                  <SectionCard
                    title="Needs attention"
                    count={pendingApprovals.length}
                    action={{ label: 'All approvals', to: '/approvals' }}
                  >
                    {pendingApprovals.length === 0 ? (
                      <EmptyRow label="No pending approvals." />
                    ) : (
                      pendingApprovals
                        .slice(0, HOME_LIST_LIMIT)
                        .map((approval) => (
                          <NeedsAttentionRow key={approval.id} approval={approval} />
                        ))
                    )}
                  </SectionCard>

                  <SectionCard
                    title="Active work"
                    count={activeRuns.length}
                    action={{ label: 'All runs', to: '/runs' }}
                  >
                    {activeRuns.length === 0 ? (
                      <EmptyRow label="No runs in progress." />
                    ) : (
                      activeRuns
                        .slice(0, HOME_LIST_LIMIT)
                        .map((run) => <ActiveWorkRow key={run.id} run={run} />)
                    )}
                  </SectionCard>
                </Stack>

                <SectionCard title="Recent activity">
                  {recentActivity.length === 0 ? (
                    <EmptyRow label="No recent activity." />
                  ) : (
                    recentActivity.map((record) => <ActivityRow key={record.id} record={record} />)
                  )}
                </SectionCard>
              </Box>
            </Stack>
          )}
        </>
      )}
    </Box>
  );
}
