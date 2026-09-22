import { Fragment, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Collapse,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
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
  listWorkflowRunsForDefinition,
  listWorkflowVersions,
  listWorkflows,
  type Project,
  type ProjectType,
  type WorkflowDefinitionSummary,
  type WorkflowRun,
  type WorkflowVersionDto,
} from '../../api-client.js';
import { ErrorAlert } from '../../components/ErrorAlert.js';
import { LoadingState } from '../../components/LoadingState.js';
import { StatusChip } from '../../components/StatusChip.js';
import { useProjectContext } from '../../project-context.js';

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

function summarizeRunHealth(runs: WorkflowRun[]): RunHealth {
  let succeeded = 0;
  let failed = 0;
  let inProgress = 0;
  for (const run of runs) {
    if (!RUN_TERMINAL_STATUSES.has(run.status)) {
      inProgress += 1;
    } else if (run.status === 'COMPLETED') {
      succeeded += 1;
    } else {
      failed += 1;
    }
  }
  return { total: runs.length, succeeded, failed, inProgress };
}

/**
 * DEVOS-135 (Sprint 14): the library page the sprint's own grounding
 * confirmed did not exist — search/filter across every project's real
 * workflows, a real run-health summary (`listWorkflowRunsForDefinition` +
 * `RUN_TERMINAL_STATUSES`, the same terminal-status set `RunsPage.tsx`
 * already established), version history, and a "clone into new draft"
 * action built on the existing, unmodified `createWorkflowDefinition` use
 * case (via the new `createWorkflow` client wrapper).
 */
export function WorkflowLibraryPage() {
  const { projects } = useProjectContext();
  const navigate = useNavigate();
  const { selectProject } = useProjectContext();

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

  useEffect(() => {
    listProjectTypes().then((result) => {
      if (result.ok) setProjectTypes(result.data);
    });
  }, []);

  useEffect(() => {
    if (projects.length === 0) {
      setRows([]);
      return;
    }
    let cancelled = false;
    setLoading(true);

    Promise.all(projects.map((project) => listWorkflows(project.id))).then((results) => {
      if (cancelled) return;
      setLoading(false);

      const firstError = results.find((result) => !result.ok);
      if (firstError && !firstError.ok) {
        setError(firstError.error.message);
        return;
      }
      setError(null);

      const nextRows: LibraryRow[] = [];
      results.forEach((result, index) => {
        if (!result.ok) return;
        const project = projects[index]!;
        for (const definition of result.data) {
          nextRows.push({ project, definition });
        }
      });
      setRows(nextRows);
    });

    return () => {
      cancelled = true;
    };
  }, [projects, refreshToken]);

  useEffect(() => {
    if (rows.length === 0) return;
    let cancelled = false;

    Promise.all(
      rows.map((row) =>
        listWorkflowRunsForDefinition(row.definition.id).then((result) => ({
          id: row.definition.id,
          health: result.ok ? summarizeRunHealth(result.data) : null,
        })),
      ),
    ).then((results) => {
      if (cancelled) return;
      const next: Record<string, RunHealth> = {};
      for (const { id, health } of results) {
        if (health) next[id] = health;
      }
      setRunHealth(next);
    });

    return () => {
      cancelled = true;
    };
  }, [rows]);

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

  return (
    <Stack spacing={2}>
      <Typography variant="h5">Workflow Library</Typography>
      <Typography variant="body2" color="text.secondary">
        Every real workflow across your projects, with its real status, version count, and run
        health.
      </Typography>

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

      {!loading && !error && (
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
            {filteredRows.map((row) => {
              const health = runHealth[row.definition.id];
              const isExpanded = expandedId === row.definition.id;
              return (
                <Fragment key={row.definition.id}>
                  <TableRow>
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
                              <Typography key={version.id} variant="body2">
                                v{version.version} — <StatusChip status={version.status} /> —{' '}
                                created {version.createdAt}
                                {version.publishedAt ? ` — published ${version.publishedAt}` : ''}
                              </Typography>
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
      )}
    </Stack>
  );
}
