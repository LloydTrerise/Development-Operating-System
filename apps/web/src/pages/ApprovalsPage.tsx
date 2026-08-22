import { useEffect, useState } from 'react';
import {
  approveApproval,
  listApprovalsForProject,
  rejectApproval,
  type Approval,
} from '../api-client.js';
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
 * Evidence is shown as the raw `artifactVersionIds` the approval is scoped
 * to (DEVOS-045) — resolving those into full artifact names/content would
 * need a new artifact-version lookup endpoint this task doesn't add;
 * flagged as a real, if minor, gap rather than fabricated detail.
 */
export function ApprovalsPage() {
  const { selectedProjectId } = useProjectContext();
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [decisionError, setDecisionError] = useState<string | null>(null);

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
        <h2>Approvals</h2>
        <p>Select a project to review approvals.</p>
      </section>
    );
  }

  const pending = approvals.filter((approval) => approval.status === 'PENDING');
  const decided = approvals.filter((approval) => approval.status !== 'PENDING');

  return (
    <section>
      <h2>Approvals</h2>

      {loadError && <p role="alert">Failed to load approvals: {loadError}</p>}
      {decisionError && <p role="alert">{decisionError}</p>}

      <h3>Pending</h3>
      <ul>
        {pending.map((approval) => (
          <li key={approval.id}>
            <p>
              <strong>{approval.approvalType}</strong> for run <code>{approval.workflowRunId}</code>{' '}
              — requested by {approval.requestedBy} at {approval.requestedAt}
            </p>

            <h4>Evidence</h4>
            <ul>
              {approval.evidenceReference.artifactVersionIds.map((artifactVersionId) => (
                <li key={artifactVersionId}>
                  <code>{artifactVersionId}</code>
                </li>
              ))}
            </ul>

            <label>
              Comment
              <input
                type="text"
                value={comments[approval.id] ?? ''}
                onChange={(event) =>
                  setComments((current) => ({ ...current, [approval.id]: event.target.value }))
                }
              />
            </label>
            <button
              type="button"
              disabled={decidingId === approval.id}
              onClick={() => handleDecide(approval, 'approve')}
            >
              Approve
            </button>
            <button
              type="button"
              disabled={decidingId === approval.id}
              onClick={() => handleDecide(approval, 'reject')}
            >
              Reject
            </button>
          </li>
        ))}
        {pending.length === 0 && <li>No pending approvals.</li>}
      </ul>

      <h3>Decided</h3>
      <ul>
        {decided.map((approval) => (
          <li key={approval.id}>
            {approval.approvalType} — <strong>{approval.status}</strong>
            {approval.decidedBy && ` by ${approval.decidedBy}`}
            {approval.decisionReason && ` — "${approval.decisionReason}"`}
          </li>
        ))}
        {decided.length === 0 && <li>No decided approvals yet.</li>}
      </ul>
    </section>
  );
}
