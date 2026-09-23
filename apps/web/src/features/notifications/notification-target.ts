import type { EventType } from '@devos/contracts';

/**
 * DEVOS-271: a human-readable label per real `EventType`. Covers the full
 * union (a `Record` forces exhaustiveness at compile time) even though only
 * four are ever actually produced today (see `README.md`'s grounding) — a
 * future real trigger for one of the others is rendered correctly, not
 * silently mislabeled.
 */
const TYPE_LABELS: Record<EventType, string> = {
  WorkflowRunStarted: 'Workflow run started',
  WorkflowTaskStarted: 'Workflow task started',
  WorkflowTaskCompleted: 'Workflow task completed',
  WorkflowTaskFailed: 'Workflow task failed',
  AgentExecutionStarted: 'Agent execution started',
  AgentExecutionCompleted: 'Agent execution completed',
  ArtifactCreated: 'Artifact created',
  ArtifactPublished: 'Artifact published',
  ApprovalRequested: 'Approval requested',
  ApprovalGranted: 'Approval granted',
  ApprovalRejected: 'Approval rejected',
  ToolInvocationStarted: 'Tool invocation started',
  ToolInvocationCompleted: 'Tool invocation completed',
  ValidationFailed: 'Validation failed',
  WorkflowRunCompleted: 'Workflow completed',
  WorkflowRunFailed: 'Workflow failed',
};

export function describeNotificationType(type: EventType): string {
  return TYPE_LABELS[type];
}

/**
 * DEVOS-271: real deep-link targets only — see `README.md`'s grounding for
 * which `referenceType` values are ever actually produced. `'WorkflowTask'`
 * has no resolvable target (its `referenceId` is a task id; no route
 * resolves a bare task id back to its owning run) and deliberately returns
 * `null`, same as any unrecognised `referenceType`. `'Integration'` has no
 * per-id route (Sprint 36) and no real trigger reaches it today, but is
 * mapped to the list page for defensiveness, mirroring Sprint 36's own
 * "list only" precedent rather than inventing a detail route.
 */
export function getNotificationLink(referenceType: string, referenceId: string): string | null {
  switch (referenceType) {
    case 'Approval':
      return `/approvals?approvalId=${encodeURIComponent(referenceId)}`;
    case 'WorkflowRun':
      return `/runs/${encodeURIComponent(referenceId)}`;
    case 'Artifact':
      return `/artifacts/${encodeURIComponent(referenceId)}`;
    case 'Integration':
      return '/integrations';
    default:
      return null;
  }
}
