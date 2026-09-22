import { useEffect, useState, type FormEvent } from 'react';
import {
  Box,
  Button,
  Collapse,
  FormControl,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import PeopleIcon from '@mui/icons-material/People';
import SettingsIcon from '@mui/icons-material/Settings';
import {
  addOrganisationMember,
  changeOrganisationMemberRole,
  createOrganisation,
  listOrganisationMembers,
  removeOrganisationMember,
  updateOrganisation,
  type Membership,
} from '../../api-client.js';
import { ErrorAlert } from '../../components/ErrorAlert.js';
import { LoadingState } from '../../components/LoadingState.js';
import { StatusChip } from '../../components/StatusChip.js';
import { useOrganisationContext } from '../../organisation-context.js';

const ROLES = ['OWNER', 'MEMBER'] as const;

function PanelHeader({ title }: { title: string }) {
  return (
    <Typography variant="subtitle1" sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
      {title}
    </Typography>
  );
}

/**
 * DEVOS-255: reuses `ProjectDetailPage.tsx`'s Members panel interactions
 * (DEVOS-226) — list, add by principal ID, change role, remove — but as a
 * second inline-expand toggle on `OrganisationRow`, matching that row's own
 * existing Settings-toggle pattern (DEVOS-227) rather than a route-based
 * detail page, since `OrganisationsPage.tsx` has no `/organisations/:id`
 * route (deliberately deferred — see this file's own DEVOS-227 grounding).
 */
function MembersPanel({ organisationId }: { organisationId: string }) {
  const [members, setMembers] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const [newUserId, setNewUserId] = useState('');
  const [newRole, setNewRole] = useState<(typeof ROLES)[number]>('MEMBER');
  const [adding, setAdding] = useState(false);

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
      role: newRole,
    });
    setAdding(false);
    if (!result.ok) {
      setActionError(result.error.message);
      return;
    }
    setNewUserId('');
    refresh();
  }

  async function handleChangeRole(userId: string, role: (typeof ROLES)[number]) {
    setBusyUserId(userId);
    setActionError(null);
    const result = await changeOrganisationMemberRole(organisationId, userId, role);
    setBusyUserId(null);
    if (!result.ok) {
      setActionError(result.error.message);
      return;
    }
    refresh();
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
          {members.map((member) => (
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
              <Typography variant="caption" color="text.secondary">
                {member.status}
              </Typography>
              <FormControl size="small" sx={{ minWidth: 110 }}>
                <Select<string>
                  value={member.role}
                  disabled={busyUserId === member.userId}
                  onChange={(event) =>
                    handleChangeRole(member.userId, event.target.value as (typeof ROLES)[number])
                  }
                >
                  {ROLES.map((role) => (
                    <MenuItem key={role} value={role}>
                      {role}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <IconButton
                aria-label={`Remove ${member.userId}`}
                size="small"
                disabled={busyUserId === member.userId}
                onClick={() => handleRemove(member.userId)}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Stack>
          ))}
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
          helperText="No user directory exists — add by exact principal id."
          sx={{ minWidth: 260 }}
        />
        <FormControl size="small" sx={{ minWidth: 110 }}>
          <Select<string>
            value={newRole}
            onChange={(event) => setNewRole(event.target.value as (typeof ROLES)[number])}
          >
            {ROLES.map((role) => (
              <MenuItem key={role} value={role}>
                {role}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button
          type="submit"
          variant="outlined"
          size="small"
          disabled={adding || !newUserId.trim()}
        >
          {adding ? 'Adding…' : 'Add member'}
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
  selected,
  onSelect,
  onSaved,
}: {
  organisationId: string;
  currentName: string;
  slug: string;
  status: string;
  selected: boolean;
  onSelect: () => void;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

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
    <Box>
      <ListItemButton selected={selected} onClick={onSelect}>
        <ListItemText primary={`${currentName} (${slug})`} sx={{ flex: 1 }} />
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
        <MembersPanel organisationId={organisationId} />
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
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError(null);

    const result = await createOrganisation({ name, slug });
    setSubmitting(false);

    if (!result.ok) {
      setSubmitError(result.error.message);
      return;
    }

    setName('');
    setSlug('');
    refresh();
    selectOrganisation(result.data.id);
  }

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
                selected={organisation.id === selectedOrganisationId}
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
      <Stack component="form" onSubmit={handleSubmit} spacing={2} sx={{ maxWidth: 360 }}>
        <TextField
          label="Name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          size="small"
        />
        <TextField
          label="Slug"
          value={slug}
          onChange={(event) => setSlug(event.target.value)}
          required
          size="small"
        />
        <Button
          type="submit"
          variant="contained"
          disabled={submitting}
          sx={{ alignSelf: 'flex-start' }}
        >
          {submitting ? 'Creating…' : 'Create organisation'}
        </Button>
        {submitError && <ErrorAlert message={submitError} />}
      </Stack>
    </section>
  );
}
