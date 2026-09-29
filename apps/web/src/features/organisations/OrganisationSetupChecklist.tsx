import { useCallback, useEffect, useState } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import { useNavigate } from 'react-router-dom';
import {
  getOrganisationInitialisationStatus,
  type OrganisationInitialisationStatus,
} from '../../api-client.js';
import { ErrorAlert } from '../../components/ErrorAlert.js';
import { LoadingState } from '../../components/LoadingState.js';

interface ChecklistItemProps {
  done: boolean;
  label: string;
  actionLabel: string;
  onAction: () => void;
}

function ChecklistItem({ done, label, actionLabel, onAction }: ChecklistItemProps) {
  return (
    <Stack direction="row" alignItems="center" spacing={1.5} sx={{ py: 0.5 }}>
      {done ? (
        <CheckCircleIcon fontSize="small" color="success" />
      ) : (
        <RadioButtonUncheckedIcon fontSize="small" color="disabled" />
      )}
      <Typography variant="body2" sx={{ flex: 1 }}>
        {label}
      </Typography>
      {!done && (
        <Button size="small" variant="outlined" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </Stack>
  );
}

/**
 * DEVOS-342 (Sprint 60, candidate epic E31 part 5): surfaces Sprint 58's
 * three real, live-computed requirements as an explicit, required checklist
 * — each unmet item links to its own real, already-existing creation surface
 * (`ProjectsPage`, this same row's own `AiProvidersPanel`,
 * `GovernancePage`'s `PolicyAuthoringForm`). Introduces no new requirement
 * and no new persistence — read-only against the unchanged
 * `getOrganisationInitialisationStatus` route.
 */
export function OrganisationSetupChecklist({
  organisationId,
  onOpenAiProviders,
  onStatusChange,
}: {
  organisationId: string;
  onOpenAiProviders: () => void;
  onStatusChange?: (initialised: boolean) => void;
}) {
  const navigate = useNavigate();
  const [status, setStatus] = useState<OrganisationInitialisationStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    getOrganisationInitialisationStatus(organisationId).then((result) => {
      setLoading(false);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setError(null);
      setStatus(result.data);
      onStatusChange?.(result.data.initialised);
    });
  }, [organisationId, onStatusChange]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <Box sx={{ pl: 2, pb: 1.5, pt: 0.5, pr: 2 }}>
      {loading && <LoadingState label="Loading setup status…" />}
      {error && <ErrorAlert message={`Failed to load setup status: ${error}`} />}

      {!loading && !error && status && (
        <>
          {status.initialised ? (
            <Typography variant="body2" color="success.main">
              Setup complete.
            </Typography>
          ) : (
            <Stack spacing={0}>
              <ChecklistItem
                done={status.hasProjectType}
                label="Create your first project"
                actionLabel="Go to Projects"
                onAction={() => navigate('/projects')}
              />
              <ChecklistItem
                done={status.hasLlmProvider}
                label="Configure an AI provider"
                actionLabel="Configure"
                onAction={onOpenAiProviders}
              />
              <ChecklistItem
                done={status.hasPolicy}
                label="Author an organisation policy"
                actionLabel="Go to Governance"
                onAction={() => navigate('/governance')}
              />
            </Stack>
          )}
          <Button size="small" onClick={refresh} sx={{ mt: 1 }}>
            Refresh
          </Button>
        </>
      )}
    </Box>
  );
}
