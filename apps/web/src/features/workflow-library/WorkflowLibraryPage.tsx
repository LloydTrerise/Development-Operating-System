import { Fragment, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Button,
  Collapse,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  RUN_TERMINAL_STATUSES,
  createWorkflow,
  getWorkflowVersionByNumber,
  listProjectTypes,
  listWorkflowVersions,
  listWorkflowsForOrganisation,
  listWorkItems,
  startRunFromVersion,
  type Project,
  type ProjectType,
  type WorkflowDefinitionSummary,
  type WorkflowVersionDto,
  type WorkItem,
} from '../../api-client.js';
import { ErrorAlert } from '../../components/ErrorAlert.js';
import { LoadingState } from '../../components/LoadingState.js';
import { StatusChip } from '../../components/StatusChip.js';
import { useOrganisationContext } from '../../organisation-context.js';
import { useProjectContext } from '../../project-context.js';

/** DEVOS-223: the same local panel-header convention `GovernancePage.tsx`'s
 * own DEVOS-219 restyle already established (a title + right-aligned meta
 * caption, bordered below) — restyle-only, no behavior change. */
function PanelHeader({ title, meta }: { title: string; meta?: string }) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1}
      sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}
    >
      <Typography variant="subtitle1" sx={{ flex: 1 }}>
        {title}
      </Typography>
      {meta && (
        <Typography variant="caption" color="text.secondary">
          {meta}
        </Typography>
      )}
    </Stack>
  );
}

interface LibraryRow {
  project: Project;
  definition: WorkflowDefinitionSummary;
}

interface RunHealth {
  total: number;
  succeeded: number;
  failed: number;
  inProgress: number;
}

/** Sprint 41 gap closure: classification into succeeded/failed/in-progress
 * stays a frontend concern (`RUN_TERMINAL_STATUSES`, the same set
 * `RunsPage.tsx` already established) — the backend's new aggregate route
 * returns only raw per-status counts, not a pre-classified verdict. */
function summarizeRunHealthFromCounts(counts: Record<string, number>): RunHealth {
  let total = 0;
  let succeeded = 0;
  let failed = 0;
  let inProgress = 0;
  for (const [status, count] of Object.entries(counts)) {
    total += count;
    if (!RUN_TERMINAL_STATUSES.has(status)) {
      inProgress += count;
    } else if (status === 'COMPLETED') {
      succeeded += count;
    } else {
      failed += count;
    }
  }
  return { total, succeeded, failed, inProgress };
}

/**
 * DEVOS-135 (Sprint 14): the library page the sprint's own grounding
 * confirmed did not exist — search/filter across every project's real
 * workflows, a real run-health summary, version history, and a "clone into
 * new draft" action built on the existing, unmodified
 * `createWorkflowDefinition` use case (via the new `createWorkflow` client
 * wrapper). Sprint 41 gap closure: both the workflow list and the run-health
 * summary are now sourced from one real, org-scoped aggregate route
 * (`listWorkflowsForOrganisation`) instead of this page's own former
 * `Promise.all(projects.map(...))`/`Promise.all(rows.map(...))` fan-outs,
 * which never resolved against the real seeded organisation's thousands of
 * accumulated projects — see `specs/sprints/sprint-41/README.md`'s gap-
 * closure addendum.
 */
export function WorkflowLibraryPage() {
  const { projects } = useProjectContext();
  const { selectedOrganisationId } = useOrganisationContext();
  const navigate = useNavigate();
  const { selectProject } = useProjectContext();
  const [searchParams] = useSearchParams();
  const linkedWorkflowId = searchParams.get('workflowId');

  const [projectTypes, setProjectTypes] = useState<ProjectType[]>([]);
  const [rows, setRows] = useState<LibraryRow[]>([]);
  const [runHealth, setRunHealth] = useState<Record<string, RunHealth>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const [searchText, setSearchText] = useState('');
  const [projectFilter, setProjectFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [versionsByDefinition, setVersionsByDefinition] = useState<
    Record<string, WorkflowVersionDto[]>
  >({});

  const [cloneTargetProjectId, setCloneTargetProjectId] = useState<Record<string, string>>({});
  const [cloneBusyId, setCloneBusyId] = useState<string | null>(null);
  const [cloneError, setCloneError] = useState<string | null>(null);

  // DEVOS-224: "Run this version" — per-version-history-row state for the
  // real `startRunFromVersion` action.
  const [workItemsByProject, setWorkItemsByProject] = useState<Record<string, WorkItem[]>>({});
  const [openRunVersionId, setOpenRunVersionId] = useState<string | null>(null);
  const [runWorkItemId, setRunWorkItemId] = useState<Record<string, string>>({});
  const [runBusyId, setRunBusyId] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [runSuccessId, setRunSuccessId] = useState<string | null>(null);

  useEffect(() => {
    listProjectTypes().then((result) => {
      if (result.ok) setProjectTypes(result.data);
    });
  }, []);

  useEffect(() => {
    if (!selectedOrganisationId) {
      setRows([]);
      setRunHealth({});
      return;
    }
    let cancelled = false;
    setLoading(true);

    listWorkflowsForOrganisation(selectedOrganisationId).then((result) => {
      if (cancelled) return;
      setLoading(false);

      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setError(null);

      const projectById = new Map(projects.map((project) => [project.id, project]));
      const nextRows: LibraryRow[] = [];
      const nextRunHealth: Record<string, RunHealth> = {};
      for (const entry of result.data) {
        const project = projectById.get(entry.projectId);
        // Every real entry's projectId belongs to an org project the
        // caller's already-loaded, org-filtered `projects` list also
        // carries — this only skips a genuinely transient render before
        // that list finishes its own separate fetch.
        if (!project) continue;
        nextRows.push({ project, definition: entry });
        nextRunHealth[entry.id] = summarizeRunHealthFromCounts(entry.runStatusCounts);
      }
      setRows(nextRows);
      setRunHealth(nextRunHealth);
    });

    return () => {
      cancelled = true;
    };
  }, [selectedOrganisationId, projects, refreshToken]);

  const projectTypeNameById = useMemo(
    () => new Map(projectTypes.map((type) => [type.id, type.name])),
    [projectTypes],
  );

  const filteredRows = useMemo(() => {
    const search = searchText.trim().toLowerCase();
    return rows.filter(({ project, definition }) => {
      if (projectFilter && project.id !== projectFilter) return false;
      if (typeFilter && project.projectTypeId !== typeFilter) return false;
      if (statusFilter && (definition.latestVersionStatus ?? '') !== statusFilter) return false;
      if (
        search &&
        !definition.name.toLowerCase().includes(search) &&
        !definition.key.toLowerCase().includes(search)
      ) {
        return false;
      }
      return true;
    });
  }, [rows, searchText, projectFilter, typeFilter, statusFilter]);

  // Sprint 41 gap closure: the real, org-scoped aggregate route this page
  // now uses can return thousands of real rows (16,021 against the real
  // seeded organisation) — confirmed by live verification that rendering
  // every one of them in this plain, un-virtualized `<Table>` (each row
  // also carrying its own "clone into new draft" project picker, itself up
  // to ~4,500 real `MenuItem`s) freezes the browser tab for minutes, a real
  // client-side consequence the backend fix alone didn't address. Capped
  // with a real total-count header, mirroring Sprint 30's own established
  // precedent for exactly this shape of problem (Home dashboard's unbounded
  // list). A `?workflowId=` deep link is always kept visible regardless of
  // the cap, so DEVOS-264's own scroll-to-highlight behavior still works.
  const MAX_VISIBLE_ROWS = 200;
  const visibleRows = useMemo(() => {
    if (filteredRows.length <= MAX_VISIBLE_ROWS) return filteredRows;
    const capped = filteredRows.slice(0, MAX_VISIBLE_ROWS);
    if (!linkedWorkflowId || capped.some((row) => row.definition.id === linkedWorkflowId)) {
      return capped;
    }
    const linkedRow = filteredRows.find((row) => row.definition.id === linkedWorkflowId);
    return linkedRow ? [linkedRow, ...capped.slice(0, MAX_VISIBLE_ROWS - 1)] : capped;
  }, [filteredRows, linkedWorkflowId]);

  async function toggleExpanded(definition: WorkflowDefinitionSummary) {
    if (expandedId === definition.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(definition.id);
    if (!versionsByDefinition[definition.id]) {
      const result = await listWorkflowVersions(definition.id);
      if (result.ok) {
        setVersionsByDefinition((current) => ({ ...current, [definition.id]: result.data }));
      }
    }
  }

  // DEVOS-264: a `?workflowId=` deep link (from the Search UI/Command
  // Palette, since a workflow definition has no dedicated `/{area}/:id`
  // route) expands and scrolls the matching row into view, mirroring
  // ApprovalsPage.tsx's `?approvalId=` convention adapted to this page's
  // plain-table shape.
  useEffect(() => {
    if (!linkedWorkflowId) return;
    const row = rows.find((candidate) => candidate.definition.id === linkedWorkflowId);
    if (!row) return;

    if (expandedId !== linkedWorkflowId) {
      void toggleExpanded(row.definition);
    }
    document
      .getElementById(`workflow-row-${linkedWorkflowId}`)
      ?.scrollIntoView({ block: 'center' });
  }, [linkedWorkflowId, rows]);

  function openInEditor(project: Project) {
    selectProject(project.id);
    navigate('/workflows');
  }

  async function handleClone(row: LibraryRow) {
    const targetProjectId = cloneTargetProjectId[row.definition.id] ?? row.project.id;
    setCloneBusyId(row.definition.id);
    setCloneError(null);

    const versions = await listWorkflowVersions(row.definition.id);
    if (!versions.ok || versions.data.length === 0) {
      setCloneBusyId(null);
      setCloneError('Source workflow has no version to clone.');
      return;
    }
    const latest = versions.data.reduce((max, candidate) =>
      candidate.version > max.version ? candidate : max,
    );
    const fullVersion = await getWorkflowVersionByNumber(row.definition.id, latest.version);
    if (!fullVersion.ok) {
      setCloneBusyId(null);
      setCloneError(fullVersion.error.message);
      return;
    }

    const clonedKey = `${row.definition.key}-copy-${Date.now()}`;
    const result = await createWorkflow(targetProjectId, {
      key: clonedKey,
      name: `${row.definition.name} (Copy)`,
      definition: fullVersion.data.definition,
    });
    setCloneBusyId(null);
    if (!result.ok) {
      setCloneError(result.error.message);
      return;
    }
    setRefreshToken((token) => token + 1);
  }

  async function toggleRunPicker(row: LibraryRow, version: WorkflowVersionDto) {
    setRunError(null);
    setRunSuccessId(null);
    if (openRunVersionId === version.id) {
      setOpenRunVersionId(null);
      return;
    }
    setOpenRunVersionId(version.id);
    if (!workItemsByProject[row.project.id]) {
      const result = await listWorkItems(row.project.id);
      if (result.ok) {
        setWorkItemsByProject((current) => ({ ...current, [row.project.id]: result.data }));
      }
    }
  }

  async function handleRunVersion(version: WorkflowVersionDto) {
    const workItemId = runWorkItemId[version.id];
    if (!workItemId) return;
    setRunBusyId(version.id);
    setRunError(null);
    const result = await startRunFromVersion(version.id, {
      workItemId,
      idempotencyKey: `web-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    });
    setRunBusyId(null);
    if (!result.ok) {
      setRunError(result.error.message);
      return;
    }
    setRunSuccessId(version.id);
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h5">Workflow Library</Typography>

      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
        <TextField
          size="small"
          label="Search"
          placeholder="Name or key"
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
        />
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel id="library-project-filter">Project</InputLabel>
          <Select<string>
            labelId="library-project-filter"
            label="Project"
            value={projectFilter}
            onChange={(event) => setProjectFilter(event.target.value)}
          >
            <MenuItem value="">All projects</MenuItem>
            {projects.map((project) => (
              <MenuItem key={project.id} value={project.id}>
                {project.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel id="library-type-filter">Project type</InputLabel>
          <Select<string>
            labelId="library-type-filter"
            label="Project type"
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
          >
            <MenuItem value="">All types</MenuItem>
            {projectTypes.map((type) => (
              <MenuItem key={type.id} value={type.id}>
                {type.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel id="library-status-filter">Status</InputLabel>
          <Select<string>
            labelId="library-status-filter"
            label="Status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <MenuItem value="">All statuses</MenuItem>
            <MenuItem value="DRAFT">DRAFT</MenuItem>
            <MenuItem value="PUBLISHED">PUBLISHED</MenuItem>
            <MenuItem value="DEPRECATED">DEPRECATED</MenuItem>
            <MenuItem value="ARCHIVED">ARCHIVED</MenuItem>
          </Select>
        </FormControl>
      </Stack>

      {loading && <LoadingState label="Loading workflow library…" />}
      {error && <ErrorAlert message={`Failed to load workflows: ${error}`} />}
      {cloneError && <ErrorAlert message={`Clone failed: ${cloneError}`} />}
      {runError && <ErrorAlert message={`Failed to start run: ${runError}`} />}

      {!loading && !error && (
        <Paper variant="outlined">
          <PanelHeader
            title="Every workflow"
            meta={
              visibleRows.length < filteredRows.length
                ? `Showing ${visibleRows.length} of ${filteredRows.length} matching (${rows.length} total) — refine filters to narrow results`
                : `${filteredRows.length} of ${rows.length} shown`
            }
          />
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell />
                <TableCell>Name</TableCell>
                <TableCell>Project</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Versions</TableCell>
                <TableCell>Run health</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visibleRows.map((row) => {
                const health = runHealth[row.definition.id];
                const isExpanded = expandedId === row.definition.id;
                return (
                  <Fragment key={row.definition.id}>
                    <TableRow
                      id={`workflow-row-${row.definition.id}`}
                      sx={
                        linkedWorkflowId === row.definition.id
                          ? { outline: '2px solid', outlineColor: 'primary.main' }
                          : undefined
                      }
                    >
                      <TableCell>
                        <IconButton size="small" onClick={() => toggleExpanded(row.definition)}>
                          {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </IconButton>
                      </TableCell>
                      <TableCell>
                        {row.definition.name} <code>({row.definition.key})</code>
                      </TableCell>
                      <TableCell>{row.project.name}</TableCell>
                      <TableCell>
                        {projectTypeNameById.get(row.project.projectTypeId) ??
                          row.project.projectTypeId}
                      </TableCell>
                      <TableCell>
                        {row.definition.latestVersionStatus ? (
                          <StatusChip status={row.definition.latestVersionStatus} />
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell>{row.definition.versionCount ?? '—'}</TableCell>
                      <TableCell>
                        {health
                          ? `${health.succeeded} succeeded / ${health.failed} failed / ${health.inProgress} in progress`
                          : '—'}
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Button size="small" onClick={() => openInEditor(row.project)}>
                            Open editor
                          </Button>
                          <FormControl size="small" sx={{ minWidth: 140 }}>
                            <Select<string>
                              value={cloneTargetProjectId[row.definition.id] ?? row.project.id}
                              onChange={(event) =>
                                setCloneTargetProjectId((current) => ({
                                  ...current,
                                  [row.definition.id]: event.target.value,
                                }))
                              }
                            >
                              {projects.map((project) => (
                                <MenuItem key={project.id} value={project.id}>
                                  {project.name}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                          <Button
                            size="small"
                            variant="outlined"
                            disabled={cloneBusyId === row.definition.id}
                            onClick={() => handleClone(row)}
                          >
                            Clone into new draft
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={8} sx={{ py: 0, border: isExpanded ? undefined : 0 }}>
                        <Collapse in={isExpanded} unmountOnExit>
                          <Box sx={{ py: 1 }}>
                            <Typography variant="subtitle2">Version history</Typography>
                            {(versionsByDefinition[row.definition.id] ?? [])
                              .slice()
                              .sort((a, b) => b.version - a.version)
                              .map((version) => (
                                <Box key={version.id} sx={{ mb: 0.5 }}>
                                  <Stack direction="row" spacing={1} alignItems="center">
                                    <Typography variant="body2" component="div">
                                      v{version.version} — <StatusChip status={version.status} /> —
                                      created {version.createdAt}
                                      {version.publishedAt
                                        ? ` — published ${version.publishedAt}`
                                        : ''}
                                    </Typography>
                                    <Button
                                      size="small"
                                      onClick={() => toggleRunPicker(row, version)}
                                    >
                                      Run this version
                                    </Button>
                                  </Stack>
                                  {openRunVersionId === version.id && (
                                    <Stack
                                      direction="row"
                                      spacing={1}
                                      alignItems="center"
                                      sx={{ mt: 0.5, ml: 2 }}
                                    >
                                      <FormControl size="small" sx={{ minWidth: 220 }}>
                                        <InputLabel id={`run-work-item-${version.id}`}>
                                          Work item
                                        </InputLabel>
                                        <Select<string>
                                          labelId={`run-work-item-${version.id}`}
                                          label="Work item"
                                          value={runWorkItemId[version.id] ?? ''}
                                          onChange={(event) =>
                                            setRunWorkItemId((current) => ({
                                              ...current,
                                              [version.id]: event.target.value,
                                            }))
                                          }
                                        >
                                          {(workItemsByProject[row.project.id] ?? []).map(
                                            (workItem) => (
                                              <MenuItem key={workItem.id} value={workItem.id}>
                                                {workItem.title}
                                              </MenuItem>
                                            ),
                                          )}
                                        </Select>
                                      </FormControl>
                                      <Button
                                        size="small"
                                        variant="outlined"
                                        disabled={
                                          runBusyId === version.id || !runWorkItemId[version.id]
                                        }
                                        onClick={() => handleRunVersion(version)}
                                      >
                                        Start run
                                      </Button>
                                      {runSuccessId === version.id && (
                                        <Typography variant="caption" color="success.main">
                                          Run started against v{version.version}. See the Runs page.
                                        </Typography>
                                      )}
                                    </Stack>
                                  )}
                                </Box>
                              ))}
                            {(versionsByDefinition[row.definition.id] ?? []).length === 0 && (
                              <Typography variant="body2" color="text.secondary">
                                No versions yet.
                              </Typography>
                            )}
                            <Typography variant="caption" color="text.secondary">
                              Open the workflow editor to compare any two versions in detail.
                            </Typography>
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </Fragment>
                );
              })}
              {filteredRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8}>
                    <Typography variant="body2" color="text.secondary">
                      No workflows match the current filters.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Paper>
      )}
    </Stack>
  );
}
