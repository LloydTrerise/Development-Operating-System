import { useState } from 'react';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import {
  Button,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  createOrganisationPolicy,
  createPolicy,
  type CreatePolicyInput,
  type Policy,
} from '../api-client.js';
import { ErrorAlert } from './ErrorAlert.js';

/**
 * DEVOS-140: a real create-policy form, reusing the exact `PolicyRule`/
 * `PolicyRuleCondition` shape `packages/policy/src/evaluator/policy-evaluation.ts`
 * already defines (see DEVOS-138 for the ABAC fields) — a structured form,
 * not a raw JSON textarea, matching `WorkflowNodeInspector.tsx`'s own
 * established precedent for authoring a structured domain value.
 */

const EFFECTS = ['ALLOW', 'DENY', 'REQUIRE_APPROVAL'] as const;
const RISK_CLASSES = ['R0', 'R1', 'R2', 'R3', 'R4'] as const;

interface RuleRow {
  action: string;
  effect: (typeof EFFECTS)[number];
  actorRole: string;
  resourceType: string;
  environment: string;
  riskClass: string;
  agentId: string;
  agentVersion: string;
  workflowId: string;
  workflowVersion: string;
}

function emptyRule(): RuleRow {
  return {
    action: '',
    effect: 'ALLOW',
    actorRole: '',
    resourceType: '',
    environment: '',
    riskClass: '',
    agentId: '',
    agentVersion: '',
    workflowId: '',
    workflowVersion: '',
  };
}

function buildDefinition(rules: RuleRow[], defaultEffect: string): Record<string, unknown> {
  const builtRules = rules
    .filter((rule) => rule.action.trim().length > 0)
    .map((rule) => {
      const condition: Record<string, unknown> = {};
      if (rule.actorRole.trim()) condition.actorRole = rule.actorRole.trim();
      if (rule.resourceType.trim()) condition.resourceType = rule.resourceType.trim();
      if (rule.environment.trim()) condition.environment = rule.environment.trim();
      if (rule.riskClass) condition.riskClass = rule.riskClass;
      if (rule.agentId.trim()) condition.agentId = rule.agentId.trim();
      if (rule.agentVersion.trim()) condition.agentVersion = Number(rule.agentVersion);
      if (rule.workflowId.trim()) condition.workflowId = rule.workflowId.trim();
      if (rule.workflowVersion.trim()) condition.workflowVersion = Number(rule.workflowVersion);

      return {
        action: rule.action.trim(),
        effect: rule.effect,
        ...(Object.keys(condition).length > 0 ? { condition } : {}),
      };
    });

  return { rules: builtRules, ...(defaultEffect ? { defaultEffect } : {}) };
}

export interface PolicyAuthoringFormProps {
  projectId: string | null;
  organisationId: string | null;
  onCreated: (policy: Policy) => void;
}

export function PolicyAuthoringForm({
  projectId,
  organisationId,
  onCreated,
}: PolicyAuthoringFormProps) {
  const [scope, setScope] = useState<'project' | 'organisation'>('project');
  const [key, setKey] = useState('');
  const [rules, setRules] = useState<RuleRow[]>([emptyRule()]);
  const [defaultEffect, setDefaultEffect] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function updateRule(index: number, changes: Partial<RuleRow>): void {
    setRules((current) => current.map((rule, i) => (i === index ? { ...rule, ...changes } : rule)));
  }

  function addRule(): void {
    setRules((current) => [...current, emptyRule()]);
  }

  function removeRule(index: number): void {
    setRules((current) => current.filter((_, i) => i !== index));
  }

  async function handleSubmit(): Promise<void> {
    setError(null);

    if (key.trim().length === 0) {
      setError('key is required.');
      return;
    }

    const definition = buildDefinition(rules, defaultEffect);
    if (!Array.isArray(definition.rules) || definition.rules.length === 0) {
      setError('At least one rule with an action is required.');
      return;
    }

    const input: CreatePolicyInput = { key: key.trim(), definition };

    setSubmitting(true);
    const result =
      scope === 'organisation'
        ? organisationId
          ? await createOrganisationPolicy(organisationId, input)
          : null
        : projectId
          ? await createPolicy(projectId, input)
          : null;
    setSubmitting(false);

    if (!result) {
      setError(scope === 'organisation' ? 'No organisation selected.' : 'No project selected.');
      return;
    }
    if (!result.ok) {
      setError(result.error.message);
      return;
    }

    setKey('');
    setRules([emptyRule()]);
    setDefaultEffect('');
    onCreated(result.data);
  }

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="subtitle1" gutterBottom>
        Author a new policy
      </Typography>

      {error && <ErrorAlert message={error} />}

      <Stack spacing={2} sx={{ maxWidth: 720 }}>
        <FormControl size="small">
          <InputLabel id="policy-scope-label">Scope</InputLabel>
          <Select
            labelId="policy-scope-label"
            label="Scope"
            value={scope}
            onChange={(event) => setScope(event.target.value as 'project' | 'organisation')}
          >
            <MenuItem value="project" disabled={!projectId}>
              This project
            </MenuItem>
            <MenuItem value="organisation" disabled={!organisationId}>
              This project&apos;s organisation
            </MenuItem>
          </Select>
        </FormControl>

        <TextField
          label="Key"
          size="small"
          value={key}
          onChange={(event) => setKey(event.target.value)}
        />

        <Typography variant="subtitle2">Rules</Typography>
        {rules.map((rule, index) => (
          <Paper key={index} variant="outlined" sx={{ p: 1.5 }}>
            <Stack spacing={1}>
              <Stack direction="row" spacing={1} alignItems="center">
                <TextField
                  label="Action"
                  size="small"
                  value={rule.action}
                  onChange={(event) => updateRule(index, { action: event.target.value })}
                  sx={{ flex: 1 }}
                />
                <FormControl size="small" sx={{ minWidth: 170 }}>
                  <InputLabel id={`policy-rule-effect-${index}`}>Effect</InputLabel>
                  <Select
                    labelId={`policy-rule-effect-${index}`}
                    label="Effect"
                    value={rule.effect}
                    onChange={(event) =>
                      updateRule(index, { effect: event.target.value as RuleRow['effect'] })
                    }
                  >
                    {EFFECTS.map((effect) => (
                      <MenuItem key={effect} value={effect}>
                        {effect}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <IconButton
                  aria-label="Remove rule"
                  size="small"
                  onClick={() => removeRule(index)}
                  disabled={rules.length === 1}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Stack>

              <Typography variant="caption" color="text.secondary">
                Condition (optional — a blank field is not checked)
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <TextField
                  label="Actor role"
                  size="small"
                  value={rule.actorRole}
                  onChange={(event) => updateRule(index, { actorRole: event.target.value })}
                />
                <TextField
                  label="Resource type"
                  size="small"
                  value={rule.resourceType}
                  onChange={(event) => updateRule(index, { resourceType: event.target.value })}
                />
                <TextField
                  label="Environment"
                  size="small"
                  value={rule.environment}
                  onChange={(event) => updateRule(index, { environment: event.target.value })}
                />
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel id={`policy-rule-risk-${index}`}>Risk class</InputLabel>
                  <Select
                    labelId={`policy-rule-risk-${index}`}
                    label="Risk class"
                    value={rule.riskClass}
                    onChange={(event) => updateRule(index, { riskClass: event.target.value })}
                  >
                    <MenuItem value="">
                      <em>Any</em>
                    </MenuItem>
                    {RISK_CLASSES.map((riskClass) => (
                      <MenuItem key={riskClass} value={riskClass}>
                        {riskClass}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  label="Agent id"
                  size="small"
                  value={rule.agentId}
                  onChange={(event) => updateRule(index, { agentId: event.target.value })}
                />
                <TextField
                  label="Agent version"
                  size="small"
                  type="number"
                  value={rule.agentVersion}
                  onChange={(event) => updateRule(index, { agentVersion: event.target.value })}
                />
                <TextField
                  label="Workflow id"
                  size="small"
                  value={rule.workflowId}
                  onChange={(event) => updateRule(index, { workflowId: event.target.value })}
                />
                <TextField
                  label="Workflow version"
                  size="small"
                  type="number"
                  value={rule.workflowVersion}
                  onChange={(event) => updateRule(index, { workflowVersion: event.target.value })}
                />
              </Stack>
            </Stack>
          </Paper>
        ))}
        <Button
          startIcon={<AddIcon />}
          onClick={addRule}
          size="small"
          sx={{ alignSelf: 'flex-start' }}
        >
          Add rule
        </Button>

        <FormControl size="small">
          <InputLabel id="policy-default-effect-label">Default effect (optional)</InputLabel>
          <Select
            labelId="policy-default-effect-label"
            label="Default effect (optional)"
            value={defaultEffect}
            onChange={(event) => setDefaultEffect(event.target.value)}
          >
            <MenuItem value="">
              <em>None</em>
            </MenuItem>
            {EFFECTS.map((effect) => (
              <MenuItem key={effect} value={effect}>
                {effect}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Button variant="contained" onClick={() => void handleSubmit()} disabled={submitting}>
          Create draft
        </Button>
      </Stack>
    </Paper>
  );
}
