import { useEffect, useState } from 'react';
import {
  listApprovalsForProject,
  listArtifacts,
  listAuditRecordsForProject,
  listIntegrations,
  listWorkItems,
  listWorkflowRunsForDefinition,
  listWorkflows,
  RUN_TERMINAL_STATUSES,
  type Approval,
  type AuditRecord,
  type WorkflowRun,
} from '../../api-client.js';

export interface ActiveRun extends WorkflowRun {
  workflowName: string;
}

export interface HomeDashboardData {
  workItemCount: number;
  artifactCount: number;
  /** DEVOS-242: count of `ACTIVE`-status integrations — the one real
   * "health" signal that exists (no connectivity check anywhere in this
   * codebase). Tolerant of a failed fetch, like every other tile source. */
  activeIntegrationCount: number;
  pendingApprovals: Approval[];
  activeRuns: ActiveRun[];
  recentActivity: AuditRecord[];
  loading: boolean;
  error: string | null;
}

const RECENT_ACTIVITY_LIMIT = 10;

/**
 * Every field here comes from an already-existing route — see
 * specs/sprints/sprint-30/DEVOS-208.md for the full grounding, including
 * why there is no project-wide "list runs" route to call directly (none
 * exists anywhere in this codebase) and why work item count is a plain
 * total rather than an "active" subset (WorkItemStatus is deliberately
 * open-ended, per packages/contracts/src/status.ts).
 */
export function useHomeDashboardData(projectId: string | null): HomeDashboardData {
  const [workItemCount, setWorkItemCount] = useState(0);
  const [artifactCount, setArtifactCount] = useState(0);
  const [activeIntegrationCount, setActiveIntegrationCount] = useState(0);
  const [pendingApprovals, setPendingApprovals] = useState<Approval[]>([]);
  const [activeRuns, setActiveRuns] = useState<ActiveRun[]>([]);
  const [recentActivity, setRecentActivity] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) {
      setWorkItemCount(0);
      setArtifactCount(0);
      setActiveIntegrationCount(0);
      setPendingApprovals([]);
      setActiveRuns([]);
      setRecentActivity([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      listWorkItems(projectId),
      listApprovalsForProject(projectId),
      listArtifacts(projectId),
      listAuditRecordsForProject(projectId),
      listWorkflows(projectId),
      listIntegrations(projectId),
    ]).then(async ([
      workItemsResult,
      approvalsResult,
      artifactsResult,
      auditResult,
      workflowsResult,
      integrationsResult,
    ]) => {
      if (cancelled) return;

      if (!workItemsResult.ok) {
        setError(workItemsResult.error.message);
        setLoading(false);
        return;
      }
      setWorkItemCount(workItemsResult.data.length);

      if (approvalsResult.ok) {
        setPendingApprovals(approvalsResult.data.filter((approval) => approval.status === 'PENDING'));
      }

      if (artifactsResult.ok) {
        setArtifactCount(artifactsResult.data.length);
      }

      if (integrationsResult.ok) {
        setActiveIntegrationCount(
          integrationsResult.data.filter((integration) => integration.status === 'ACTIVE').length,
        );
      }

      if (auditResult.ok) {
        const sorted = [...auditResult.data].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        setRecentActivity(sorted.slice(0, RECENT_ACTIVITY_LIMIT));
      }

      if (workflowsResult.ok) {
        const runsByDefinition = await Promise.all(
          workflowsResult.data.map(async (workflow) => {
            const result = await listWorkflowRunsForDefinition(workflow.id);
            if (!result.ok) return [];
            return result.data.map((run): ActiveRun => ({ ...run, workflowName: workflow.name }));
          }),
        );
        if (cancelled) return;
        const inProgress = runsByDefinition
          .flat()
          .filter((run) => !RUN_TERMINAL_STATUSES.has(run.status))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setActiveRuns(inProgress);
      }

      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return {
    workItemCount,
    artifactCount,
    activeIntegrationCount,
    pendingApprovals,
    activeRuns,
    recentActivity,
    loading,
    error,
  };
}
