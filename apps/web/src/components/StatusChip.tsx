import { Chip } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { statusTokens } from '../theme-tokens.js';

type StatusBucket = 'ok' | 'run' | 'warn' | 'fail' | 'idle';

/**
 * Bucket mapping for every status string used across the app, built from the
 * full enum set in packages/contracts/src/status.ts (workflow run/task,
 * artifact, agent version, policy, approval, agent execution, tool
 * capability/invocation, integration statuses). The 'idle' fallback is
 * load-bearing, not defensive boilerplate — several status types
 * (WorkItemStatus and others) are explicitly open-ended/opaque strings per
 * status.ts's own comments, so an unrecognized value is expected, not a bug.
 * Bucket grouping is unchanged from the prior MUI-color mapping this
 * replaces: success->ok, error->fail, warning->warn, info->run, default->idle.
 */
const STATUS_BUCKET: Record<string, StatusBucket> = {
  // ok (formerly success)
  COMPLETED: 'ok',
  SUCCEEDED: 'ok',
  APPROVED: 'ok',
  PUBLISHED: 'ok',
  ACTIVE: 'ok',
  // fail (formerly error)
  FAILED: 'fail',
  REJECTED: 'fail',
  CANCELLED: 'fail',
  DISABLED: 'fail',
  RETIRED: 'fail',
  ARCHIVED: 'fail',
  SUPERSEDED: 'fail',
  CHANGES_REQUESTED: 'fail',
  // run (formerly info)
  RUNNING: 'run',
  // warn (formerly warning)
  PENDING: 'warn',
  WAITING: 'warn',
  AWAITING_APPROVAL: 'warn',
  PAUSED: 'warn',
  QUEUED: 'warn',
  READY: 'warn',
  DRAFT: 'warn',
  VALIDATING: 'warn',
  REVIEW: 'warn',
  GENERATED: 'warn',
  DEPRECATED: 'warn',
};

export function StatusChip({ status }: { status: string }) {
  const theme = useTheme();
  const bucket = STATUS_BUCKET[status] ?? 'idle';
  const { fg, bg } = statusTokens[theme.palette.mode][bucket];
  return (
    <Chip label={status} size="small" sx={{ color: fg, backgroundColor: bg, fontWeight: 500 }} />
  );
}
