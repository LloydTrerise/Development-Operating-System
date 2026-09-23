import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Typography } from '@mui/material';
import { getRun, listArtifacts, type Artifact, type WorkflowRun } from '../../api-client.js';
import { DetailPageLayout } from '../../components/DetailPageLayout.js';
import { ErrorAlert } from '../../components/ErrorAlert.js';
import { LoadingState } from '../../components/LoadingState.js';
import { RunCard } from './RunCard.js';

/**
 * Sprint 41 gap closure: a real `/runs/:id` route — `GET /runs/:runId`
 * (`getRun`) and its supporting routes/wrappers (tasks, agent-execution and
 * tool-invocation summaries, approvals) all already existed, fully wired,
 * with zero UI ever addressing one specific run directly (confirmed by
 * grep — every existing reference to a run id, in `ApprovalsPage.tsx` and
 * `ArtifactViewerPage.tsx`, rendered it as plain text next to a generic
 * "view runs" link to the whole list). `RunCard.tsx` (Sprint 31's DEVOS-214)
 * already renders a run's complete detail (pipeline, task drill-down,
 * approvals, artifacts, evidence, release readiness) — this page only
 * resolves `:id` to a real `WorkflowRun` and its project's artifacts, then
 * reuses that component unchanged.
 */
export function RunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [run, setRun] = useState<WorkflowRun | null>(null);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    if (!id) return;
    setLoading(true);
    getRun(id).then((result) => {
      setLoading(false);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setError(null);
      setRun(result.data);
      listArtifacts(result.data.projectId).then((artifactsResult) => {
        if (artifactsResult.ok) setArtifacts(artifactsResult.data);
      });
    });
  }

  useEffect(refresh, [id]);

  return (
    <DetailPageLayout title={run ? `Run ${run.id}` : 'Run'} backTo="/runs">
      {loading && <LoadingState label="Loading run…" />}
      {error && <ErrorAlert message={`Failed to load run: ${error}`} />}
      {!loading && !error && !run && <Typography color="text.secondary">Run not found.</Typography>}
      {run && (
        <RunCard run={run} projectId={run.projectId} artifacts={artifacts} onCompleted={refresh} />
      )}
    </DetailPageLayout>
  );
}
