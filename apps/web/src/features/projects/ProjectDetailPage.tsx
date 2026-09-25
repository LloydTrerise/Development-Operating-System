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
  assignPrincipalJobRole,
  assignProjectMemberJobRole,
  changeMemberRole,
  getProjectJobRolesOverview,
  listMembers,
  listToolCapabilities,
  removeMember,
  removePrincipalJobRole,
  removeProjectMemberJobRole,
  setToolCapabilityStatus,
  updateProject,
  type Membership,
  type ProjectJobRolesOverview,
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

  const [jobRolesOverview, setJobRolesOverview] = useState<ProjectJobRolesOverview | null>(null);
  const [jobRolesError, setJobRolesError] = useState<string | null>(null);
  const [jobRoleActionError, setJobRoleActionError] = useState<string | null>(null);
  const [jobRoleBusyKey, setJobRoleBusyKey] = useState<string | null>(null);

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

  /** DEVOS-301: one aggregate call for every member row's job-role UI —
   * see `getProjectJobRolesOverview`'s own doc comment for why this is a
   * single fetch rather than one per member. */
  function refreshJobRoles() {
    if (!id) return;
    getProjectJobRolesOverview(id).then((result) => {
      if (!result.ok) {
        setJobRolesError(result.error.message);
        return;
      }
      setJobRolesError(null);
      setJobRolesOverview(result.data);
    });
  }

  useEffect(() => {
    refreshJobRoles();
  }, [id]);

  /** DEVOS-299/301: grants a job role at organisation scope — the org the
   * job role catalogue is scoped to is the project's own `organisationId`,
   * since this panel is this sprint's own single UI anchor for both the
   * org-wide grant and the per-project subset (no separate organisation-wide
   * job-role management page exists — see `specs/sprints/sprint-49/
   * DEVOS-301.md`). */
  async function handleGrantJobRole(principalId: string, jobRoleId: string) {
    if (!project) return;
    setJobRoleBusyKey(`${principalId}:${jobRoleId}`);
    setJobRoleActionError(null);
    const result = await assignPrincipalJobRole(project.organisationId, principalId, jobRoleId);
    setJobRoleBusyKey(null);
    if (!result.ok) {
      setJobRoleActionError(result.error.message);
      return;
    }
    refreshJobRoles();
  }

  async function handleRevokeJobRole(principalId: string, jobRoleId: string) {
    if (!project) return;
    setJobRoleBusyKey(`${principalId}:${jobRoleId}`);
    setJobRoleActionError(null);
    const result = await removePrincipalJobRole(project.organisationId, principalId, jobRoleId);
    setJobRoleBusyKey(null);
    if (!result.ok) {
      setJobRoleActionError(result.error.message);
      return;
    }
    refreshJobRoles();
  }

  /** DEVOS-300: the per-project subset picker — toggles whether a job role
   * the principal already holds (DEVOS-299) is active on this project. */
  async function handleToggleActiveJobRole(
    principalId: string,
    jobRoleId: string,
    active: boolean,
  ) {
    if (!id) return;
    setJobRoleBusyKey(`${principalId}:${jobRoleId}`);
    setJobRoleActionError(null);
    const result = active
      ? await removeProjectMemberJobRole(id, principalId, jobRoleId)
      : await assignProjectMemberJobRole(id, principalId, jobRoleId);
    setJobRoleBusyKey(null);
    if (!result.ok) {
      setJobRoleActionError(result.error.message);
      return;
    }
    refreshJobRoles();
  }

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
              {jobRolesError && (
                <ErrorAlert message={`Failed to load job roles: ${jobRolesError}`} />
              )}
              {jobRoleActionError && <ErrorAlert message={jobRoleActionError} />}

              {!membersLoading && !membersError && (
                <Stack spacing={1}>
                  {members.map((member) => {
                    const memberJobRoles = jobRolesOverview?.members.find(
                      (candidate) => candidate.principalId === member.userId,
                    );
                    const catalogue = jobRolesOverview?.catalogue ?? [];
                    const heldIds = memberJobRoles?.heldJobRoleIds ?? [];
                    const activeIds = memberJobRoles?.activeJobRoleIds ?? [];
                    const heldJobRoles = catalogue.filter((jobRole) =>
                      heldIds.includes(jobRole.id),
                    );
                    const grantableJobRoles = catalogue.filter(
                      (jobRole) => !heldIds.includes(jobRole.id),
                    );

                    return (
                      <Stack
                        key={member.id}
                        spacing={0.5}
                        sx={{ py: 0.5, borderBottom: 1, borderColor: 'divider' }}
                      >
                        <Stack direction="row" alignItems="center" spacing={2}>
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

                        {/* DEVOS-299/300/301: job roles held at organisation scope
                            (click a chip's × to revoke; the chip body toggles
                            whether it's active on this project) plus a "grant"
                            picker limited to the org's own seeded catalogue. */}
                        <Stack
                          direction="row"
                          alignItems="center"
                          spacing={1}
                          flexWrap="wrap"
                          useFlexGap
                          sx={{ pl: 0.5 }}
                        >
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ minWidth: 68 }}
                          >
                            Job roles:
                          </Typography>
                          {heldJobRoles.map((jobRole) => {
                            const active = activeIds.includes(jobRole.id);
                            const busy = jobRoleBusyKey === `${member.userId}:${jobRole.id}`;
                            return (
                              <Chip
                                key={jobRole.id}
                                label={jobRole.key}
                                size="small"
                                color={active ? 'primary' : 'default'}
                                variant={active ? 'filled' : 'outlined'}
                                disabled={busy}
                                title={
                                  active
                                    ? 'Active on this project — click to deactivate'
                                    : 'Held, not active on this project — click to activate'
                                }
                                onClick={() =>
                                  handleToggleActiveJobRole(member.userId, jobRole.id, active)
                                }
                                onDelete={() => handleRevokeJobRole(member.userId, jobRole.id)}
                              />
                            );
                          })}
                          {heldJobRoles.length === 0 && (
                            <Typography variant="caption" color="text.secondary">
                              None held.
                            </Typography>
                          )}
                          {grantableJobRoles.length > 0 && (
                            <FormControl size="small" sx={{ minWidth: 140 }}>
                              <Select
                                displayEmpty
                                value=""
                                onChange={(event) =>
                                  handleGrantJobRole(member.userId, event.target.value)
                                }
                              >
                                <MenuItem value="" disabled>
                                  + Grant job role
                                </MenuItem>
                                {grantableJobRoles.map((jobRole) => (
                                  <MenuItem key={jobRole.id} value={jobRole.id}>
                                    {jobRole.key}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          )}
                        </Stack>
                      </Stack>
                    );
                  })}
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
