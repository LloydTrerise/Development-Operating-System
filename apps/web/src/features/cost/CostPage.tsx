import { useEffect, useState } from 'react';
import {
  Box,
  LinearProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import {
  getOrganisationCostReport,
  getProjectCostSummary,
  type CostBreakdownRow,
  type OrganisationCostReport,
  type ProjectCostSummary,
} from '../../api-client.js';
import { ErrorAlert } from '../../components/ErrorAlert.js';
import { useOrganisationContext } from '../../organisation-context.js';
import { useProjectContext } from '../../project-context.js';

function formatUsd(value: number): string {
  return `$${value.toFixed(4)}`;
}

function PanelHeader({ title }: { title: string }) {
  return (
    <Typography variant="subtitle1" sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
      {title}
    </Typography>
  );
}

/** DEVOS-156: which attribution dimension the breakdown tables render. */
type BreakdownDimension = 'role' | 'workflow' | 'workItem';

const DIMENSION_LABELS: Record<BreakdownDimension, string> = {
  role: 'Agent role',
  workflow: 'Workflow',
  workItem: 'Work item',
};

function rowsForDimension(
  cost: {
    breakdownByRole: CostBreakdownRow[];
    breakdownByWorkflow: CostBreakdownRow[];
    breakdownByWorkItem: CostBreakdownRow[];
  } | null,
  dimension: BreakdownDimension,
): CostBreakdownRow[] {
  if (!cost) return [];
  switch (dimension) {
    case 'workflow':
      return cost.breakdownByWorkflow;
    case 'workItem':
      return cost.breakdownByWorkItem;
    case 'role':
    default:
      return cost.breakdownByRole;
  }
}

function BreakdownTable({
  rows,
  dimension,
  emptyMessage,
}: {
  rows: CostBreakdownRow[];
  dimension: BreakdownDimension;
  emptyMessage: string;
}) {
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>{DIMENSION_LABELS[dimension]}</TableCell>
          <TableCell align="right">Total (USD)</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.key}>
            <TableCell>{row.key}</TableCell>
            <TableCell align="right">{formatUsd(row.totalUsd)}</TableCell>
          </TableRow>
        ))}
        {rows.length === 0 && (
          <TableRow>
            <TableCell colSpan={2}>
              <Typography variant="body2" color="text.secondary">
                {emptyMessage}
              </Typography>
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

/**
 * DEVOS-152/DEVOS-156: the first place a human can see rollup cost data
 * anywhere in the product — real project and organisation totals
 * (DEVOS-098/DEVOS-150), a real budget-vs-actual indicator against
 * `budgetUsd` (DEVOS-098/DEVOS-155), and a real breakdown selectable by
 * agent role, workflow, or work item (DEVOS-150/DEVOS-156). A dedicated
 * page rather than a `GovernancePage.tsx` section — cost is a distinct
 * concern from governance/compliance, matching how `RunsPage.tsx`/
 * `WorkflowLibraryPage.tsx` are each their own page (this sprint's own
 * `README.md` grounding records the choice).
 */
export function CostPage() {
  const { selectedProjectId, projects } = useProjectContext();
  const { selectedOrganisationId } = useOrganisationContext();
  const [projectCost, setProjectCost] = useState<ProjectCostSummary | null>(null);
  const [organisationCost, setOrganisationCost] = useState<OrganisationCostReport | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dimension, setDimension] = useState<BreakdownDimension>('role');

  const projectOrganisationId =
    projects.find((project) => project.id === selectedProjectId)?.organisationId ??
    selectedOrganisationId;

  useEffect(() => {
    if (!selectedProjectId) {
      setProjectCost(null);
      setOrganisationCost(null);
      return;
    }

    let cancelled = false;

    Promise.all([
      getProjectCostSummary(selectedProjectId),
      projectOrganisationId
        ? getOrganisationCostReport(projectOrganisationId)
        : Promise.resolve(null),
    ]).then(([projectResult, organisationResult]) => {
      if (cancelled) return;

      const errors: string[] = [];
      if (!projectResult.ok) errors.push(projectResult.error.message);
      if (organisationResult && !organisationResult.ok)
        errors.push(organisationResult.error.message);
      setLoadError(errors.length > 0 ? errors.join('; ') : null);

      if (projectResult.ok) setProjectCost(projectResult.data);
      if (organisationResult && organisationResult.ok) {
        setOrganisationCost(organisationResult.data);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [selectedProjectId, projectOrganisationId]);

  if (!selectedProjectId) {
    return (
      <section>
        <Typography variant="h4" component="h2" gutterBottom>
          Cost
        </Typography>
        <Typography color="text.secondary">Select a project to view its cost data.</Typography>
      </section>
    );
  }

  const budgetFraction =
    projectCost?.budgetUsd !== undefined && projectCost.budgetUsd > 0
      ? Math.min(projectCost.totalUsd / projectCost.budgetUsd, 1)
      : undefined;
  const organisationBudgetFraction =
    organisationCost?.budgetUsd !== undefined && organisationCost.budgetUsd > 0
      ? Math.min(organisationCost.totalUsd / organisationCost.budgetUsd, 1)
      : undefined;

  return (
    <section>
      <Typography variant="h4" component="h2" gutterBottom>
        Cost
      </Typography>

      {loadError && <ErrorAlert message={`Failed to load cost data: ${loadError}`} />}

      <ToggleButtonGroup
        value={dimension}
        exclusive
        size="small"
        onChange={(_event, value: BreakdownDimension | null) => {
          if (value) setDimension(value);
        }}
        sx={{ mb: 3 }}
        data-testid="cost-breakdown-dimension"
      >
        <ToggleButton value="role">By role</ToggleButton>
        <ToggleButton value="workflow">By workflow</ToggleButton>
        <ToggleButton value="workItem">By work item</ToggleButton>
      </ToggleButtonGroup>

      <Stack spacing={4}>
        <Paper variant="outlined">
          <PanelHeader title="This project" />
          <Box sx={{ p: 2 }}>
            <Typography variant="body1" data-testid="project-cost-total">
              Total: {formatUsd(projectCost?.totalUsd ?? 0)}
              {projectCost?.budgetUsd !== undefined &&
                ` of ${formatUsd(projectCost.budgetUsd)} budget`}
            </Typography>
            {budgetFraction !== undefined && (
              <LinearProgress
                variant="determinate"
                value={budgetFraction * 100}
                color={
                  budgetFraction >= 1 ? 'error' : budgetFraction >= 0.8 ? 'warning' : 'primary'
                }
                sx={{ mt: 1, height: 8, borderRadius: 4 }}
                data-testid="project-budget-indicator"
              />
            )}

            <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
              Breakdown by {DIMENSION_LABELS[dimension].toLowerCase()}
            </Typography>
            <BreakdownTable
              rows={rowsForDimension(projectCost, dimension)}
              dimension={dimension}
              emptyMessage="No cost recorded for this project yet."
            />
          </Box>
        </Paper>

        <Paper variant="outlined">
          <PanelHeader title="This project's organisation" />
          <Box sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              A real rollup across every project in this organisation (tenant-isolated — never
              crosses organisations).
            </Typography>
            <Typography variant="body1" data-testid="organisation-cost-total">
              Total: {formatUsd(organisationCost?.totalUsd ?? 0)}
              {organisationCost?.budgetUsd !== undefined &&
                ` of ${formatUsd(organisationCost.budgetUsd)} budget`}{' '}
              across {organisationCost?.projectCount ?? 0} project(s)
            </Typography>
            {organisationBudgetFraction !== undefined && (
              <LinearProgress
                variant="determinate"
                value={organisationBudgetFraction * 100}
                color={
                  organisationBudgetFraction >= 1
                    ? 'error'
                    : organisationBudgetFraction >= 0.8
                      ? 'warning'
                      : 'primary'
                }
                sx={{ mt: 1, height: 8, borderRadius: 4 }}
                data-testid="organisation-budget-indicator"
              />
            )}

            <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
              Breakdown by {DIMENSION_LABELS[dimension].toLowerCase()}
            </Typography>
            <BreakdownTable
              rows={rowsForDimension(organisationCost, dimension)}
              dimension={dimension}
              emptyMessage="No cost recorded for this organisation yet."
            />
          </Box>
        </Paper>
      </Stack>
    </section>
  );
}
