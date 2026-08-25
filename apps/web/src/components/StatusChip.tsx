import { Chip, type ChipProps } from '@mui/material';

/**
 * Color mapping for every status string used across the app, built from the
 * full enum set in packages/contracts/src/status.ts (workflow run/task,
 * artifact, agent version, policy, approval, agent execution, tool
 * capability/invocation, integration statuses). The 'default' fallback is
 * load-bearing, not defensive boilerplate — several status types
 * (WorkItemStatus and others) are explicitly open-ended/opaque strings per
 * status.ts's own comments, so an unrecognized value is expected, not a bug.
 */
const STATUS_COLOR: Record<string, ChipProps['color']> = {
  // success
  COMPLETED: 'success',
  SUCCEEDED: 'success',
  APPROVED: 'success',
  PUBLISHED: 'success',
  ACTIVE: 'success',
  // error
  FAILED: 'error',
  REJECTED: 'error',
  CANCELLED: 'error',
  DISABLED: 'error',
  RETIRED: 'error',
  ARCHIVED: 'error',
  SUPERSEDED: 'error',
  CHANGES_REQUESTED: 'error',
  // info
  RUNNING: 'info',
  // warning
  PENDING: 'warning',
  WAITING: 'warning',
  AWAITING_APPROVAL: 'warning',
  PAUSED: 'warning',
  QUEUED: 'warning',
  READY: 'warning',
  DRAFT: 'warning',
  VALIDATING: 'warning',
  REVIEW: 'warning',
  GENERATED: 'warning',
  DEPRECATED: 'warning',
};

export function StatusChip({ status }: { status: string }) {
  return <Chip label={status} color={STATUS_COLOR[status] ?? 'default'} size="small" />;
}
