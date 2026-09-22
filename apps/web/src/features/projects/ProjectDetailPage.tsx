import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Button,
  Chip,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import {
  addMember,
  changeMemberRole,
  listMembers,
  listToolCapabilities,
  removeMember,
  setToolCapabilityStatus,
  updateProject,
  type Membership,
  type ToolCapability,
} from '../../api-client.js';
import { DetailPageLayout } from '../../components/DetailPageLayout.js';
import { ErrorAlert } from '../../components/ErrorAlert.js';
import { LoadingState } from '../../components/LoadingState.js';
import { StatusChip } from '../../components/StatusChip.js';
import { useProjectContext } from '../../project-context.js';

const ROLES = ['OWNER', 'MEMBER'] as const;

function PanelHeader({ title }: { title: string }) {
  return (
    <Typography variant="subtitle1" sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
      {title}
    </Typography>
  );
}

/**
 * DEVOS-225/226/227: the `/projects/:id` detail page — a real shell
 * (project identity), a Members panel closing the real, disclosed 4-route
 * client-wrapper/UI gap (`GET`/`POST /projects/:id/members`,
 * `PATCH`/`DELETE /projects/:id/members/:userId`), and a rename-only
 * Settings panel closing the `PATCH /projects/:id` gap — all three routes
 * already existed, unmodified, OWNER-gated, before this sprint. See
 * specs/sprints/sprint-33/README.md's own grounding for why "add member" is
 * scoped to a raw principal-id field: no user-directory/search capability
 * exists anywhere in this codebase.
 */
export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { projects, refresh: refreshProjects } = useProjectContext();
  const project = projects.find((candidate) => candidate.id === id);

  const [members, setMembers] = useState<Membership[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [memberActionError, setMemberActionError] = useState<string | null>(null);
  const [memberBusyUserId, setMemberBusyUserId] = useState<string | null>(null);

  const [newMemberUserId, setNewMemberUserId] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<(typeof ROLES)[number]>('MEMBER');
  const [addingMember, setAddingMember] = useState(false);

  const [settingsName, setSettingsName] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsSavedAt, setSettingsSavedAt] = useState<number | null>(null);

  const [capabilities, setCapabilities] = useState<ToolCapability[]>([]);
  const [capabilitiesLoading, setCapabilitiesLoading] = useState(false);
  const [capabilitiesError, setCapabilitiesError] = useState<string | null>(null);
  const [capabilityActionError, setCapabilityActionError] = useState<string | null>(null);
  const [capabilityBusyId, setCapabilityBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (project) setSettingsName(project.name);
  }, [project]);

  function refreshMembers() {
    if (!id) return;
    setMembersLoading(true);
    listMembers(id).then((result) => {
      setMembersLoading(false);
      if (!result.ok) {
        setMembersError(result.error.message);
        return;
      }
      setMembersError(null);
      setMembers(result.data);
    });
  }

  useEffect(() => {
    refreshMembers();
  }, [id]);

  function refreshCapabilities() {
    if (!id) return;
    setCapabilitiesLoading(true);
    listToolCapabilities(id).then((result) => {
      setCapabilitiesLoading(false);
      if (!result.ok) {
        setCapabilitiesError(result.error.message);
        return;
      }
      setCapabilitiesError(null);
      setCapabilities(result.data);
    });
  }

  useEffect(() => {
    refreshCapabilities();
  }, [id]);

  async function handleToggleCapability(capability: ToolCapability) {
    if (!id) return;
    setCapabilityBusyId(capability.id);
    setCapabilityActionError(null);
    const nextStatus = capability.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    const result = await setToolCapabilityStatus(id, capability.id, nextStatus);
    setCapabilityBusyId(null);
    if (!result.ok) {
      setCapabilityActionError(result.error.message);
      return;
    }
    refreshCapabilities();
  }

  async function handleAddMember(event: FormEvent) {
    event.preventDefault();
    if (!id || !newMemberUserId.trim()) return;
    setAddingMember(true);
    setMemberActionError(null);
    const result = await addMember(id, { userId: newMemberUserId.trim(), role: newMemberRole });
    setAddingMember(false);
    if (!result.ok) {
      setMemberActionError(result.error.message);
      return;
    }
    setNewMemberUserId('');
    refreshMembers();
  }

  async function handleChangeRole(userId: string, role: (typeof ROLES)[number]) {
    if (!id) return;
    setMemberBusyUserId(userId);
    setMemberActionError(null);
    const result = await changeMemberRole(id, userId, role);
    setMemberBusyUserId(null);
    if (!result.ok) {
      setMemberActionError(result.error.message);
      return;
    }
    refreshMembers();
  }

  async function handleRemoveMember(userId: string) {
    if (!id) return;
    setMemberBusyUserId(userId);
    setMemberActionError(null);
    const result = await removeMember(id, userId);
    setMemberBusyUserId(null);
    if (!result.ok) {
      setMemberActionError(result.error.message);
      return;
    }
    refreshMembers();
  }

  async function handleSaveSettings(event: FormEvent) {
    event.preventDefault();
    if (!id || !settingsName.trim()) return;
    setSavingSettings(true);
    setSettingsError(null);
    setSettingsSavedAt(null);
    const result = await updateProject(id, { name: settingsName.trim() });
    setSavingSettings(false);
    if (!result.ok) {
      setSettingsError(result.error.message);
      return;
    }
    refreshProjects();
    setSettingsSavedAt(Date.now());
  }

  return (
    <DetailPageLayout title={project?.name ?? 'Project'} backTo="/projects">
      {!project && (
        <Typography variant="body2" color="text.secondary">
          This project isn't in the currently-selected organisation's list, or hasn't loaded yet.
        </Typography>
      )}

      {project && (
        <Stack spacing={3}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack direction="row" spacing={3} flexWrap="wrap" useFlexGap>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Slug
                </Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                  {project.slug}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Status
                </Typography>
                <Box sx={{ mt: 0.25 }}>
                  <StatusChip status={project.status} />
                </Box>
              </Box>
              {project.description && (
                <Box sx={{ minWidth: 240 }}>
                  <Typography variant="caption" color="text.secondary">
                    Description
                  </Typography>
                  <Typography variant="body2">{project.description}</Typography>
                </Box>
              )}
            </Stack>
          </Paper>

          <Paper variant="outlined">
            <PanelHeader title="Members" />
            <Box sx={{ p: 2 }}>
              {membersLoading && <LoadingState label="Loading members…" />}
              {membersError && <ErrorAlert message={`Failed to load members: ${membersError}`} />}
              {memberActionError && <ErrorAlert message={memberActionError} />}

              {!membersLoading && !membersError && (
                <Stack spacing={1}>
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
                          disabled={memberBusyUserId === member.userId}
                          onChange={(event) =>
                            handleChangeRole(
                              member.userId,
                              event.target.value as 'OWNER' | 'MEMBER',
                            )
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
                        disabled={memberBusyUserId === member.userId}
                        onClick={() => handleRemoveMember(member.userId)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  ))}
                  {members.length === 0 && (
                    <Typography variant="body2" color="text.secondary">
                      No members yet.
                    </Typography>
                  )}
                </Stack>
              )}

              <Stack
                component="form"
                direction="row"
                spacing={1}
                alignItems="center"
                onSubmit={handleAddMember}
                sx={{ mt: 2 }}
              >
                <TextField
                  label="Principal ID"
                  size="small"
                  value={newMemberUserId}
                  onChange={(event) => setNewMemberUserId(event.target.value)}
                  helperText="No user directory exists — add by exact principal id."
                  sx={{ minWidth: 260 }}
                />
                <FormControl size="small" sx={{ minWidth: 110 }}>
                  <InputLabel id="new-member-role">Role</InputLabel>
                  <Select
                    labelId="new-member-role"
                    label="Role"
                    value={newMemberRole}
                    onChange={(event) => setNewMemberRole(event.target.value as 'OWNER' | 'MEMBER')}
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
                  disabled={addingMember || !newMemberUserId.trim()}
                >
                  {addingMember ? 'Adding…' : 'Add member'}
                </Button>
              </Stack>
            </Box>
          </Paper>

          <Paper variant="outlined">
            <PanelHeader title="Settings" />
            <Stack
              component="form"
              direction="row"
              spacing={1}
              alignItems="center"
              onSubmit={handleSaveSettings}
              sx={{ p: 2 }}
            >
              <TextField
                label="Name"
                size="small"
                value={settingsName}
                onChange={(event) => setSettingsName(event.target.value)}
                sx={{ minWidth: 260 }}
              />
              <Button
                type="submit"
                variant="contained"
                size="small"
                disabled={savingSettings || !settingsName.trim()}
              >
                {savingSettings ? 'Saving…' : 'Save'}
              </Button>
              {settingsSavedAt && (
                <Typography variant="caption" color="success.main">
                  Saved.
                </Typography>
              )}
            </Stack>
            {settingsError && (
              <Box sx={{ px: 2, pb: 2 }}>
                <ErrorAlert message={settingsError} />
              </Box>
            )}
          </Paper>

          <Paper variant="outlined">
            <PanelHeader title="Tool Capabilities" />
            <Box sx={{ p: 2 }}>
              {capabilitiesLoading && <LoadingState label="Loading capabilities…" />}
              {capabilitiesError && (
                <ErrorAlert message={`Failed to load capabilities: ${capabilitiesError}`} />
              )}
              {capabilityActionError && <ErrorAlert message={capabilityActionError} />}

              {!capabilitiesLoading && !capabilitiesError && (
                <Stack spacing={1}>
                  {capabilities.map((capability) => (
                    <Stack
                      key={capability.id}
                      direction="row"
                      alignItems="center"
                      spacing={2}
                      sx={{ py: 0.5, borderBottom: 1, borderColor: 'divider' }}
                    >
                      <Typography variant="body2" sx={{ flex: 1, fontFamily: 'monospace' }}>
                        {capability.key}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
                        {capability.name}
                      </Typography>
                      <Chip label={capability.riskClass} size="small" variant="outlined" />
                      <StatusChip status={capability.status} />
                      <Switch
                        size="small"
                        checked={capability.status === 'ACTIVE'}
                        disabled={capabilityBusyId === capability.id}
                        onChange={() => handleToggleCapability(capability)}
                        slotProps={{ input: { 'aria-label': `Toggle ${capability.key}` } }}
                      />
                    </Stack>
                  ))}
                  {capabilities.length === 0 && (
                    <Typography variant="body2" color="text.secondary">
                      No tool capabilities registered for this project.
                    </Typography>
                  )}
                </Stack>
              )}
            </Box>
          </Paper>
        </Stack>
      )}
    </DetailPageLayout>
  );
}
