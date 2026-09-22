import { useParams } from 'react-router-dom';
import { Typography } from '@mui/material';
import { DetailPageLayout } from '../../components/DetailPageLayout.js';

/**
 * Scaffolding-only proof of concept for DEVOS-206's `/{area}/:id` detail
 * routing convention (specs/sprints/sprint-29/DEVOS-206.md) — proves the
 * route/layout mechanism works end-to-end in this app's router. Sprint 31's
 * DEVOS-213 replaces this with the real work item detail/edit view; this
 * component renders only the raw route param, no real data fetch.
 */
export function WorkItemDetailPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <DetailPageLayout title="Work Item" backTo="/work-items">
      <Typography variant="body2" color="text.secondary">
        Scaffolding proof of concept (DEVOS-206) — routed id: <strong>{id}</strong>. Real work
        item detail/edit content lands in Sprint 31 (DEVOS-213).
      </Typography>
    </DetailPageLayout>
  );
}
