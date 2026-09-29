import { useEffect, useState, type FormEvent } from 'react';
import { Box, Button, Chip, IconButton, Stack, TextField, Typography } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import {
  grantPlatformOperator,
  listPlatformOperators,
  revokePlatformOperator,
  type PlatformOperator,
} from '../../api-client.js';
import { ErrorAlert } from '../../components/ErrorAlert.js';
import { LoadingState } from '../../components/LoadingState.js';
import { useSession } from '../../session.js';

/**
 * DEVOS-327 (Sprint 56, candidate epic E31): the platform-operator tier's
 * own minimal management UI — reachable only by an already-known platform
 * operator (every route 403s otherwise, mirroring `MembersPanel`'s identical
 * grant/revoke shape in `OrganisationsPage.tsx`, at platform scope instead
 * of organisation scope, so no `organisationId` is threaded anywhere here).
 */
export function PlatformOperatorsPage() {
  const session = useSession();
  const currentPrincipalId = 'principalId' in session ? session.principalId : undefined;
  const [operators, setOperators] = useState<PlatformOperator[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyPrincipalId, setBusyPrincipalId] = useState<string | null>(null);

  const [newPrincipalId, setNewPrincipalId] = useState('');
  const [granting, setGranting] = useState(false);

  function refresh() {
    setLoading(true);
    listPlatformOperators().then((result) => {
      setLoading(false);
      if (!result.ok) {
        setListError(result.error.message);
        return;
      }
      setListError(null);
      setOperators(result.data);
    });
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleGrant(event: FormEvent) {
    event.preventDefault();
    if (!newPrincipalId.trim()) return;
    setGranting(true);
    setActionError(null);
    const result = await grantPlatformOperator(newPrincipalId.trim());
    setGranting(false);
    if (!result.ok) {
      setActionError(result.error.message);
      return;
    }
    setNewPrincipalId('');
    refresh();
  }

  async function handleRevoke(principalId: string) {
    setBusyPrincipalId(principalId);
    setActionError(null);
    const result = await revokePlatformOperator(principalId);
    setBusyPrincipalId(null);
    if (!result.ok) {
      setActionError(result.error.message);
      return;
    }
    refresh();
  }

  return (
    <Box sx={{ maxWidth: 640 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Platform Operators
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Platform operators sit above and outside every organisation. This page only manages who
        holds that tier — it grants no access to any organisation's own data.
      </Typography>

      {loading && <LoadingState label="Loading platform operators…" />}
      {listError && <ErrorAlert message={`Failed to load platform operators: ${listError}`} />}
      {actionError && <ErrorAlert message={actionError} />}

      {!loading && !listError && (
        <Stack spacing={0.5} sx={{ mb: 2 }}>
          {operators.map((operator) => {
            const isCurrentUser = operator.principalId === currentPrincipalId;
            const isSoleOperator = operators.length === 1;
            return (
              <Stack
                key={operator.principalId}
                direction="row"
                alignItems="center"
                spacing={2}
                sx={{ py: 0.5, borderBottom: 1, borderColor: 'divider' }}
              >
                <Typography variant="body2" sx={{ flex: 1, fontFamily: 'monospace' }}>
                  {operator.principalId}
                </Typography>
                {isCurrentUser && (
                  <Chip label="You" size="small" color="primary" variant="outlined" />
                )}
                {operator.grantedByPrincipalId === undefined ? (
                  <Chip label="Bootstrap grant" size="small" variant="outlined" />
                ) : (
                  <Typography variant="caption" color="text.secondary">
                    granted by {operator.grantedByPrincipalId}
                  </Typography>
                )}
                <IconButton
                  aria-label={`Revoke ${operator.principalId}`}
                  size="small"
                  disabled={isSoleOperator || busyPrincipalId === operator.principalId}
                  onClick={() => handleRevoke(operator.principalId)}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Stack>
            );
          })}
          {operators.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              No platform operators found.
            </Typography>
          )}
        </Stack>
      )}

      <Stack
        component="form"
        direction="row"
        spacing={1}
        alignItems="center"
        onSubmit={handleGrant}
      >
        <TextField
          label="Principal ID"
          size="small"
          value={newPrincipalId}
          onChange={(event) => setNewPrincipalId(event.target.value)}
          helperText="Grant platform-operator status by exact principal id."
          sx={{ minWidth: 260 }}
        />
        <Button
          type="submit"
          variant="outlined"
          size="small"
          disabled={granting || !newPrincipalId.trim()}
        >
          {granting ? 'Granting…' : 'Grant operator'}
        </Button>
      </Stack>
    </Box>
  );
}
