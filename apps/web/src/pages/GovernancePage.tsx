import { useEffect, useState } from 'react';
import { List, ListItem, ListItemText, Stack, Typography } from '@mui/material';
import {
  listApprovalsForProject,
  listAuditRecordsForProject,
  listPoliciesForProject,
  type Approval,
  type AuditRecord,
  type Policy,
} from '../api-client.js';
import { ErrorAlert } from '../components/ErrorAlert.js';
import { StatusChip } from '../components/StatusChip.js';
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
  const { selectedProjectId } = useProjectContext();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [auditRecords, setAuditRecords] = useState<AuditRecord[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedProjectId) {
      setPolicies([]);
      setApprovals([]);
      setAuditRecords([]);
      return;
    }

    let cancelled = false;

    Promise.all([
      listPoliciesForProject(selectedProjectId),
      listApprovalsForProject(selectedProjectId),
      listAuditRecordsForProject(selectedProjectId),
    ]).then(([policiesResult, approvalsResult, auditResult]) => {
      if (cancelled) return;

      const errors = [policiesResult, approvalsResult, auditResult]
        .filter((result) => !result.ok)
        .map((result) => (result.ok ? '' : result.error.message));
      setLoadError(errors.length > 0 ? errors.join('; ') : null);

      if (policiesResult.ok) setPolicies(policiesResult.data);
      if (approvalsResult.ok) setApprovals(approvalsResult.data);
      if (auditResult.ok) setAuditRecords(auditResult.data);
    });

    return () => {
      cancelled = true;
    };
  }, [selectedProjectId]);

  if (!selectedProjectId) {
    return (
      <section>
        <Typography variant="h4" component="h2" gutterBottom>
          Governance
        </Typography>
        <Typography color="text.secondary">Select a project to view its governance information.</Typography>
      </section>
    );
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
        <div>
          <Typography variant="h6" component="h3" gutterBottom>
            Policies
          </Typography>
          <List dense>
            {policies.map((policy) => (
              <ListItem key={policy.id} disableGutters>
                <ListItemText
                  primary={
                    <>
                      <strong>{policy.key}</strong> v{policy.version}
                      {policy.publishedAt && ` — published ${policy.publishedAt}`}
                    </>
                  }
                />
                <StatusChip status={policy.status} />
              </ListItem>
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
            Approvals
          </Typography>
          <List dense>
            {approvals.map((approval) => (
              <ListItem key={approval.id} disableGutters>
                <ListItemText
                  primary={approval.approvalType}
                  secondary={
                    approval.decidedBy
                      ? `decided by ${approval.decidedBy}`
                      : `requested by ${approval.requestedBy}`
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
      </Stack>
    </section>
  );
}
