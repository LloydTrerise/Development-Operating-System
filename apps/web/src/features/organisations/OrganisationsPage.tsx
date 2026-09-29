import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  Box,
  Button,
  Chip,
  Collapse,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ChecklistIcon from '@mui/icons-material/Checklist';
import DeleteIcon from '@mui/icons-material/Delete';
import PeopleIcon from '@mui/icons-material/People';
import SettingsIcon from '@mui/icons-material/Settings';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import {
  addOrganisationMember,
  createOrganisationLlmProvider,
  deleteOrganisationLlmProvider,
  listOrganisationLlmProviders,
  listOrganisationMembers,
  removeOrganisationMember,
  reorderOrganisationLlmProviders,
  transferOrganisationOwnership,
  updateOrganisation,
  updateOrganisationLlmProvider,
  type Membership,
  type OrganisationLlmProvider,
} from '../../api-client.js';
import { ErrorAlert } from '../../components/ErrorAlert.js';
import { LoadingState } from '../../components/LoadingState.js';
import { StatusChip } from '../../components/StatusChip.js';
import { useOrganisationContext } from '../../organisation-context.js';
import { useSession } from '../../session.js';
import { CreateOrganisationWizard } from './CreateOrganisationWizard.js';
import { OrganisationSetupChecklist } from './OrganisationSetupChecklist.js';

/**
 * DEVOS-321 (Sprint 54): mirrors `@devos/agents`'s own `LLM_PROVIDER_KEYS`
 * (`packages/agents/src/providers/registry.ts`) — duplicated here rather
 * than fetched from a new route, since no route exposes "which providers
 * does this deployment's registry know about" and adding one is out of this
 * sprint's own scope; a mismatch would only ever surface as a real,
 * server-side `ValidationError` on create (DEVOS-320's own registered-key
 * check), never a silent failure.
 */
const LLM_PROVIDER_OPTIONS = ['gemini', 'anthropic'] as const;

function PanelHeader({ title }: { title: string }) {
  return (
    <Typography variant="subtitle1" sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
      {title}
    </Typography>
  );
}

/**
 * DEVOS-255/DEVOS-293: reuses `ProjectDetailPage.tsx`'s Members panel
 * interactions (DEVOS-226) — list, add by principal ID, remove — but as a
 * second inline-expand toggle on `OrganisationRow`, matching that row's own
 * existing Settings-toggle pattern (DEVOS-227) rather than a route-based
 * detail page, since `OrganisationsPage.tsx` has no `/organisations/:id`
 * route (deliberately deferred — see this file's own DEVOS-227 grounding).
 *
 * DEVOS-290/293: there is only one org-level role now (`ORGANISATION_ADMIN`,
 * decision §9.3 drops org-level `MEMBER`), so the role picker is gone —
 * every add is an `ORGANISATION_ADMIN`. The single transferable
 * `ownerPrincipalId` gets its own "Owner" chip, and only the current owner
 * sees a "Transfer ownership" action on the other co-admin rows.
 */
function MembersPanel({
  organisationId,
  ownerPrincipalId,
  currentPrincipalId,
  onOwnershipChanged,
}: {
  organisationId: string;
  ownerPrincipalId: string | undefined;
  currentPrincipalId: string;
  onOwnershipChanged: () => void;
}) {
  const [members, setMembers] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const [newUserId, setNewUserId] = useState('');
  const [adding, setAdding] = useState(false);

  const isCurrentUserOwner =
    ownerPrincipalId !== undefined && ownerPrincipalId === currentPrincipalId;

  function refresh() {
    setLoading(true);
    listOrganisationMembers(organisationId).then((result) => {
      setLoading(false);
      if (!result.ok) {
        setListError(result.error.message);
        return;
      }
      setListError(null);
      setMembers(result.data);
    });
  }

  useEffect(() => {
    refresh();
  }, [organisationId]);

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    if (!newUserId.trim()) return;
    setAdding(true);
    setActionError(null);
    const result = await addOrganisationMember(organisationId, {
      userId: newUserId.trim(),
      role: 'ORGANISATION_ADMIN',
    });
    setAdding(false);
    if (!result.ok) {
      setActionError(result.error.message);
      return;
    }
    setNewUserId('');
    refresh();
  }

  async function handleTransferOwnership(userId: string) {
    setBusyUserId(userId);
    setActionError(null);
    const result = await transferOrganisationOwnership(organisationId, userId);
    setBusyUserId(null);
    if (!result.ok) {
      setActionError(result.error.message);
      return;
    }
    onOwnershipChanged();
  }

  async function handleRemove(userId: string) {
    setBusyUserId(userId);
    setActionError(null);
    const result = await removeOrganisationMember(organisationId, userId);
    setBusyUserId(null);
    if (!result.ok) {
      setActionError(result.error.message);
      return;
    }
    refresh();
  }

  return (
    <Box sx={{ pl: 2, pb: 1.5, pt: 0.5, pr: 2 }}>
      {loading && <LoadingState label="Loading members…" />}
      {listError && <ErrorAlert message={`Failed to load members: ${listError}`} />}
      {actionError && <ErrorAlert message={actionError} />}

      {!loading && !listError && (
        <Stack spacing={0.5} sx={{ mb: 1.5 }}>
          {members.map((member) => {
            const isOwner = member.userId === ownerPrincipalId;
            return (
              <Stack
                key={member.id}
                direction="row"
                alignItems="center"
                spacing={2}
                sx={{ py: 0.5, borderBottom: 1, borderColor: 'divider' }}
              >
                <Typography variant="body2" sx={{ flex: 1, fontFamily: 'monospace' }}>
                  {member.userId}
                </Typography>
                {isOwner && <Chip label="Owner" size="small" color="primary" variant="outlined" />}
                <Typography variant="caption" color="text.secondary">
                  {member.status}
                </Typography>
                {isCurrentUserOwner && !isOwner && (
                  <IconButton
                    aria-label={`Transfer ownership to ${member.userId}`}
                    size="small"
                    disabled={busyUserId === member.userId}
                    onClick={() => handleTransferOwnership(member.userId)}
                  >
                    <SwapHorizIcon fontSize="small" />
                  </IconButton>
                )}
                <IconButton
                  aria-label={`Remove ${member.userId}`}
                  size="small"
                  disabled={isOwner || busyUserId === member.userId}
                  onClick={() => handleRemove(member.userId)}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Stack>
            );
          })}
          {members.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              No organisation-level members yet.
            </Typography>
          )}
        </Stack>
      )}

      <Stack component="form" direction="row" spacing={1} alignItems="center" onSubmit={handleAdd}>
        <TextField
          label="Principal ID"
          size="small"
          value={newUserId}
          onChange={(event) => setNewUserId(event.target.value)}
          helperText="No user directory exists — add by exact principal id, as an admin."
          sx={{ minWidth: 260 }}
        />
        <Button
          type="submit"
          variant="outlined"
          size="small"
          disabled={adding || !newUserId.trim()}
        >
          {adding ? 'Adding…' : 'Add admin'}
        </Button>
      </Stack>
    </Box>
  );
}

/**
 * DEVOS-321 (Sprint 54): mirrors `MembersPanel` immediately above exactly —
 * list/add/remove, loading/error state, a `busyId` guard — plus a status
 * toggle chip per row and move-up/move-down reordering. Every write action
 * (`createOrganisationLlmProvider`/`updateOrganisationLlmProvider`/
 * `deleteOrganisationLlmProvider`/`reorderOrganisationLlmProviders`) is
 * server-gated to an organisation admin (DEVOS-320); this panel renders its
 * controls unconditionally for every viewer and surfaces a rejection via
 * `actionError`, the same client/server split `MembersPanel`'s own
 * Add/Remove controls already establish (only "Transfer ownership" is
 * client-hidden there, and only because it needs to know who the single
 * transferable owner is, not because of the access gate itself).
 */
function AiProvidersPanel({ organisationId }: { organisationId: string }) {
  const [providers, setProviders] = useState<OrganisationLlmProvider[]>([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [newProvider, setNewProvider] = useState<string>(LLM_PROVIDER_OPTIONS[0]);
  const [newCredentialReference, setNewCredentialReference] = useState('');
  const [adding, setAdding] = useState(false);

  function refresh() {
    setLoading(true);
    listOrganisationLlmProviders(organisationId).then((result) => {
      setLoading(false);
      if (!result.ok) {
        setListError(result.error.message);
        return;
      }
      setListError(null);
      setProviders(result.data);
    });
  }

  useEffect(() => {
    refresh();
  }, [organisationId]);

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    if (!newCredentialReference.trim()) return;
    setAdding(true);
    setActionError(null);
    const result = await createOrganisationLlmProvider(organisationId, {
      provider: newProvider,
      credentialReference: newCredentialReference.trim(),
    });
    setAdding(false);
    if (!result.ok) {
      setActionError(result.error.message);
      return;
    }
    setNewCredentialReference('');
    refresh();
  }

  async function handleToggleStatus(provider: OrganisationLlmProvider) {
    setBusyId(provider.id);
    setActionError(null);
    const result = await updateOrganisationLlmProvider(organisationId, provider.id, {
      status: provider.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE',
    });
    setBusyId(null);
    if (!result.ok) {
      setActionError(result.error.message);
      return;
    }
    refresh();
  }

  async function handleRemove(providerId: string) {
    setBusyId(providerId);
    setActionError(null);
    const result = await deleteOrganisationLlmProvider(organisationId, providerId);
    setBusyId(null);
    if (!result.ok) {
      setActionError(result.error.message);
      return;
    }
    refresh();
  }

  async function handleMove(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= providers.length) return;
    const reordered = [...providers];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(target, 0, moved!);
    setBusyId(providers[index]!.id);
    setActionError(null);
    const result = await reorderOrganisationLlmProviders(
      organisationId,
      reordered.map((provider) => provider.id),
    );
    setBusyId(null);
    if (!result.ok) {
      setActionError(result.error.message);
      return;
    }
    refresh();
  }

  return (
    <Box sx={{ pl: 2, pb: 1.5, pt: 0.5, pr: 2 }}>
      {loading && <LoadingState label="Loading AI providers…" />}
      {listError && <ErrorAlert message={`Failed to load AI providers: ${listError}`} />}
      {actionError && <ErrorAlert message={actionError} />}

      {!loading && !listError && (
        <Stack spacing={0.5} sx={{ mb: 1.5 }}>
          {providers.map((provider, index) => (
            <Stack
              key={provider.id}
              direction="row"
              alignItems="center"
              spacing={2}
              sx={{ py: 0.5, borderBottom: 1, borderColor: 'divider' }}
            >
              <Typography variant="body2" color="text.secondary" sx={{ width: 24 }}>
                {provider.priority}
              </Typography>
              <Typography variant="body2" sx={{ flex: 1 }}>
                {provider.provider}
              </Typography>
              <Typography
                variant="body2"
                sx={{ flex: 2, fontFamily: 'monospace' }}
                color="text.secondary"
              >
                {provider.credentialReference}
              </Typography>
              <Chip
                label={provider.status}
                size="small"
                color={provider.status === 'ACTIVE' ? 'success' : 'default'}
                variant="outlined"
                onClick={() => handleToggleStatus(provider)}
                disabled={busyId === provider.id}
              />
              <IconButton
                aria-label={`Move ${provider.provider} up`}
                size="small"
                disabled={index === 0 || busyId === provider.id}
                onClick={() => handleMove(index, -1)}
              >
                <ArrowUpwardIcon fontSize="small" />
              </IconButton>
              <IconButton
                aria-label={`Move ${provider.provider} down`}
                size="small"
                disabled={index === providers.length - 1 || busyId === provider.id}
                onClick={() => handleMove(index, 1)}
              >
                <ArrowDownwardIcon fontSize="small" />
              </IconButton>
              <IconButton
                aria-label={`Remove ${provider.provider}`}
                size="small"
                disabled={busyId === provider.id}
                onClick={() => handleRemove(provider.id)}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Stack>
          ))}
          {providers.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              No LLM providers configured — this organisation uses the platform default.
            </Typography>
          )}
        </Stack>
      )}

      <Stack component="form" direction="row" spacing={1} alignItems="center" onSubmit={handleAdd}>
        <TextField
          select
          label="Provider"
          size="small"
          value={newProvider}
          onChange={(event) => setNewProvider(event.target.value)}
          sx={{ minWidth: 140 }}
        >
          {LLM_PROVIDER_OPTIONS.map((option) => (
            <MenuItem key={option} value={option}>
              {option}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="Credential reference"
          size="small"
          value={newCredentialReference}
          onChange={(event) => setNewCredentialReference(event.target.value)}
          helperText="A reference name, resolved via the credential resolver — never the secret itself."
          sx={{ minWidth: 260 }}
        />
        <Button
          type="submit"
          variant="outlined"
          size="small"
          disabled={adding || !newCredentialReference.trim()}
        >
          {adding ? 'Adding…' : 'Add provider'}
        </Button>
      </Stack>
    </Box>
  );
}

/**
 * DEVOS-227: an inline, expand-in-place Settings affordance per row —
 * closes the real, disclosed `PATCH /organisations/:id` UI gap
 * (`updateOrganisation` already had a client wrapper; only the UI was
 * missing). This page itself is not restyled until Sprint 34
 * (specs/DEVOS-UI-UX-REDESIGN-BACKLOG.md §6.6, DEVOS-229) and has no detail
 * route yet, so a `/organisations/:id` route is deliberately not pre-built
 * this sprint — see specs/sprints/sprint-33/README.md's own grounding.
 * Owns the whole row (selectable button + settings trigger + collapsing
 * form below it) so the expanding panel renders as its own row, not
 * squeezed inside the flex-row `ListItemButton`.
 */
function OrganisationRow({
  organisationId,
  currentName,
  slug,
  status,
  ownerPrincipalId,
  currentPrincipalId,
  selected,
  autoOpenSetup,
  onSelect,
  onSaved,
}: {
  organisationId: string;
  currentName: string;
  slug: string;
  status: string;
  ownerPrincipalId: string | undefined;
  currentPrincipalId: string;
  selected: boolean;
  autoOpenSetup: boolean;
  onSelect: () => void;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [aiProvidersOpen, setAiProvidersOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(autoOpenSetup);
  const [setupIncomplete, setSetupIncomplete] = useState(false);
  // DEVOS-348 (Sprint 61, Epic E31 gap closure): scrolls this row into view
  // when its own setup checklist opens the AI Providers panel — otherwise a
  // row far down a long organisation list opens its panel off-screen with
  // no visible feedback.
  const rowRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (autoOpenSetup) setSetupOpen(true);
  }, [autoOpenSetup]);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    setSavedAt(null);
    const result = await updateOrganisation(organisationId, { name: name.trim() });
    setSaving(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    onSaved();
    setSavedAt(Date.now());
  }

  return (
    <Box ref={rowRef}>
      <ListItemButton selected={selected} onClick={onSelect}>
        <ListItemText primary={`${currentName} (${slug})`} sx={{ flex: 1 }} />
        {setupIncomplete && (
          <Chip label="Setup incomplete" size="small" color="warning" variant="outlined" />
        )}
        <StatusChip status={status} />
        <IconButton
          aria-label={`Members of ${currentName}`}
          size="small"
          onClick={(event) => {
            event.stopPropagation();
            setMembersOpen((current) => !current);
          }}
        >
          <PeopleIcon fontSize="small" />
        </IconButton>
        <IconButton
          aria-label={`AI providers for ${currentName}`}
          size="small"
          onClick={(event) => {
            event.stopPropagation();
            setAiProvidersOpen((current) => !current);
          }}
        >
          <SmartToyIcon fontSize="small" />
        </IconButton>
        <IconButton
          aria-label={`Setup checklist for ${currentName}`}
          size="small"
          onClick={(event) => {
            event.stopPropagation();
            setSetupOpen((current) => !current);
          }}
        >
          <ChecklistIcon fontSize="small" />
        </IconButton>
        <IconButton
          aria-label={`Settings for ${currentName}`}
          size="small"
          onClick={(event) => {
            event.stopPropagation();
            setOpen((current) => !current);
          }}
        >
          <SettingsIcon fontSize="small" />
        </IconButton>
      </ListItemButton>
      <Collapse in={membersOpen} unmountOnExit>
        <MembersPanel
          organisationId={organisationId}
          ownerPrincipalId={ownerPrincipalId}
          currentPrincipalId={currentPrincipalId}
          onOwnershipChanged={onSaved}
        />
      </Collapse>
      <Collapse in={aiProvidersOpen} unmountOnExit>
        <AiProvidersPanel organisationId={organisationId} />
      </Collapse>
      <Collapse in={setupOpen} unmountOnExit>
        <OrganisationSetupChecklist
          organisationId={organisationId}
          onOpenAiProviders={() => {
            setAiProvidersOpen(true);
            rowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }}
          onStatusChange={(initialised) => setSetupIncomplete(!initialised)}
        />
      </Collapse>
      <Collapse in={open} unmountOnExit>
        <Box
          component="form"
          onSubmit={handleSave}
          sx={{ display: 'flex', alignItems: 'center', gap: 1, pl: 2, pb: 1.5, pt: 0.5 }}
        >
          <TextField
            label="Name"
            size="small"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <Button type="submit" size="small" variant="outlined" disabled={saving || !name.trim()}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
          {savedAt && (
            <Typography variant="caption" color="success.main">
              Saved.
            </Typography>
          )}
          {error && <ErrorAlert message={error} />}
        </Box>
      </Collapse>
    </Box>
  );
}

export function OrganisationsPage() {
  const { organisations, selectedOrganisationId, selectOrganisation, loading, error, refresh } =
    useOrganisationContext();
  const session = useSession();
  const currentPrincipalId = 'principalId' in session ? session.principalId : '';
  const [justCreatedOrganisationId, setJustCreatedOrganisationId] = useState<string | null>(null);

  return (
    <section>
      <Typography variant="h4" component="h2" gutterBottom>
        Organisations
      </Typography>

      {loading && <LoadingState label="Loading organisations…" />}
      {error && <ErrorAlert message={`Failed to load organisations: ${error}`} />}

      {!loading && !error && (
        <Paper variant="outlined">
          <PanelHeader title="Organisations" />
          <List dense sx={{ py: 0 }}>
            {organisations.map((organisation) => (
              <OrganisationRow
                key={organisation.id}
                organisationId={organisation.id}
                currentName={organisation.name}
                slug={organisation.slug}
                status={organisation.status}
                ownerPrincipalId={organisation.ownerPrincipalId}
                currentPrincipalId={currentPrincipalId}
                selected={organisation.id === selectedOrganisationId}
                autoOpenSetup={organisation.id === justCreatedOrganisationId}
                onSelect={() => selectOrganisation(organisation.id)}
                onSaved={refresh}
              />
            ))}
            {organisations.length === 0 && (
              <ListItemText primary="No organisations yet." sx={{ px: 2, py: 1 }} />
            )}
          </List>
        </Paper>
      )}

      <Typography variant="h6" component="h3" sx={{ mt: 4 }} gutterBottom>
        New organisation
      </Typography>
      <CreateOrganisationWizard
        onCreated={(organisation) => {
          refresh();
          selectOrganisation(organisation.id);
          setJustCreatedOrganisationId(organisation.id);
        }}
      />
    </section>
  );
}
