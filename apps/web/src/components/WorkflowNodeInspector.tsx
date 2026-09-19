import {
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { WorkflowNode } from '../api-client.js';

/**
 * DEVOS-130: real per-node-type `config` fields, grounded in the real task
 * handlers/`validateWorkflowGraph` (`packages/application/src/tasks/run-condition-task.ts`,
 * `run-wait-task.ts`, `run-approval-task.ts`, `packages/domain/src/workflows/validation.ts`)
 * — not the Designer spec's own richer aspirational shape. Closes today's
 * real gap: the pre-canvas table editor has no UI at all for any node's
 * `config`.
 */

const CONDITION_OPERATORS = ['equals', 'notEquals', 'exists'] as const;
const CONDITION_SOURCES = ['task', 'variable', 'artifact'] as const;
const JOIN_POLICIES = ['strict', 'tolerant'] as const;
const WAIT_TYPES = ['duration', 'dependency'] as const;
/** The taskKeys `apps/worker/src/tool-task-router.ts`'s real `routeToolTask`
 * switch already recognizes — a discoverability aid only; a `TOOL_TASK`
 * node's `id` remains free text (`specs/sprints/sprint-13/README.md`'s own
 * flagged decision: no per-node capability-reference field exists). */
const KNOWN_TOOL_TASK_IDS = [
  'validation',
  'security-scan',
  'release-readiness-check',
  'release',
  'rollback',
  'closure',
  'diagnose',
  'notify',
  'log-only',
] as const;

type ConditionOperator = (typeof CONDITION_OPERATORS)[number];
type ConditionSource = (typeof CONDITION_SOURCES)[number];

interface ConditionRule {
  source?: ConditionSource;
  taskKey?: string;
  path?: string;
  field?: string;
  operator?: ConditionOperator;
  value?: unknown;
}

function inferValueType(value: unknown): 'string' | 'number' | 'boolean' {
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  return 'string';
}

function coerceValue(raw: string, type: 'string' | 'number' | 'boolean'): unknown {
  if (type === 'number') return Number(raw);
  if (type === 'boolean') return raw === 'true';
  return raw;
}

export interface WorkflowNodeInspectorProps {
  node: WorkflowNode;
  /** Every other node's own `id` in the same graph — populates a `WAIT`
   * (dependency variant) or `CONDITION` (task/artifact source) taskKey
   * dropdown, so an author picks a real node rather than mistyping one. */
  otherNodeIds: string[];
  /** Real, published `ProjectTypeAgent` keys for this project type — the
   * same list `agentRef` already, correctly, uses today. */
  agentKeys: string[];
  onChange: (changes: Partial<WorkflowNode>) => void;
}

export function WorkflowNodeInspector({
  node,
  otherNodeIds,
  agentKeys,
  onChange,
}: WorkflowNodeInspectorProps) {
  const config = node.config ?? {};

  function setConfig(changes: Record<string, unknown>) {
    onChange({ config: { ...config, ...changes } });
  }

  return (
    <Paper variant="outlined" sx={{ p: 2, mt: 1 }}>
      <Typography variant="subtitle2" gutterBottom>
        Properties — {node.id || '(unnamed)'} ({node.type})
      </Typography>
      <Stack spacing={2} sx={{ maxWidth: 480 }}>
        <TextField
          label="Name"
          size="small"
          value={node.name ?? ''}
          onChange={(event) => onChange({ name: event.target.value })}
        />

        {node.type === 'AGENT_TASK' && (
          <AgentTaskTargetFields node={node} agentKeys={agentKeys} onChange={onChange} />
        )}

        {node.type === 'TOOL_TASK' && (
          <FormControl size="small">
            <InputLabel id="inspector-tool-task-known-id">Known task kind (optional)</InputLabel>
            <Select
              labelId="inspector-tool-task-known-id"
              label="Known task kind (optional)"
              value={
                KNOWN_TOOL_TASK_IDS.includes(node.id as (typeof KNOWN_TOOL_TASK_IDS)[number])
                  ? node.id
                  : ''
              }
              onChange={(event) => onChange({ id: event.target.value })}
            >
              <MenuItem value="">
                <em>Custom (edit the ID field directly)</em>
              </MenuItem>
              {KNOWN_TOOL_TASK_IDS.map((id) => (
                <MenuItem key={id} value={id}>
                  {id}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        {node.type === 'JOIN' &&
          (() => {
            const branchFailurePolicyValue: 'strict' | 'tolerant' | '' =
              config.branchFailurePolicy === 'strict' || config.branchFailurePolicy === 'tolerant'
                ? config.branchFailurePolicy
                : '';
            return (
              <FormControl size="small">
                <InputLabel id="inspector-join-policy">Branch failure policy</InputLabel>
                <Select<'strict' | 'tolerant' | ''>
                  labelId="inspector-join-policy"
                  label="Branch failure policy"
                  value={branchFailurePolicyValue}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value === '') {
                      const rest = { ...config };
                      delete rest.branchFailurePolicy;
                      onChange({ config: rest });
                      return;
                    }
                    setConfig({ branchFailurePolicy: value });
                  }}
                >
                  <MenuItem value="">
                    <em>Not set (strict default)</em>
                  </MenuItem>
                  {JOIN_POLICIES.map((policy) => (
                    <MenuItem key={policy} value={policy}>
                      {policy}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            );
          })()}

        {node.type === 'WAIT' && (
          <>
            <FormControl size="small">
              <InputLabel id="inspector-wait-type">Wait type</InputLabel>
              <Select
                labelId="inspector-wait-type"
                label="Wait type"
                value={
                  config.waitType === 'duration' || config.waitType === 'dependency'
                    ? config.waitType
                    : ''
                }
                onChange={(event) => setConfig({ waitType: event.target.value })}
              >
                <MenuItem value="">
                  <em>Choose one</em>
                </MenuItem>
                {WAIT_TYPES.map((waitType) => (
                  <MenuItem key={waitType} value={waitType}>
                    {waitType}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {config.waitType === 'duration' && (
              <TextField
                label="Duration (seconds)"
                size="small"
                type="number"
                value={typeof config.durationSeconds === 'number' ? config.durationSeconds : ''}
                onChange={(event) => setConfig({ durationSeconds: Number(event.target.value) })}
              />
            )}
            {config.waitType === 'dependency' && (
              <>
                <FormControl size="small">
                  <InputLabel id="inspector-wait-taskkey">Depends on node</InputLabel>
                  <Select
                    labelId="inspector-wait-taskkey"
                    label="Depends on node"
                    value={typeof config.taskKey === 'string' ? config.taskKey : ''}
                    onChange={(event) => setConfig({ taskKey: event.target.value })}
                  >
                    <MenuItem value="">
                      <em>Choose a node</em>
                    </MenuItem>
                    {otherNodeIds.map((id) => (
                      <MenuItem key={id} value={id}>
                        {id}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  label="Poll interval (seconds, optional)"
                  size="small"
                  type="number"
                  value={
                    typeof config.pollIntervalSeconds === 'number' ? config.pollIntervalSeconds : ''
                  }
                  onChange={(event) =>
                    setConfig({
                      pollIntervalSeconds:
                        event.target.value === '' ? undefined : Number(event.target.value),
                    })
                  }
                />
              </>
            )}
          </>
        )}

        {node.type === 'APPROVAL' && (
          <>
            <TextField
              label="Approval type (optional)"
              size="small"
              value={typeof config.approvalType === 'string' ? config.approvalType : ''}
              onChange={(event) => setConfig({ approvalType: event.target.value || undefined })}
            />
            <TextField
              label="Poll interval (seconds, optional)"
              size="small"
              type="number"
              value={
                typeof config.pollIntervalSeconds === 'number' ? config.pollIntervalSeconds : ''
              }
              onChange={(event) =>
                setConfig({
                  pollIntervalSeconds:
                    event.target.value === '' ? undefined : Number(event.target.value),
                })
              }
            />
          </>
        )}

        {node.type === 'CONDITION' && (
          <ConditionRuleFields
            rule={(config.rule as ConditionRule | undefined) ?? {}}
            whenTrue={typeof config.whenTrue === 'string' ? config.whenTrue : ''}
            whenFalse={typeof config.whenFalse === 'string' ? config.whenFalse : ''}
            otherNodeIds={otherNodeIds}
            onRuleChange={(rule) => setConfig({ rule })}
            onBranchChange={(changes) => setConfig(changes)}
          />
        )}
      </Stack>
    </Paper>
  );
}

type AgentTargetMode = 'specific' | 'role';

interface AgentTaskTargetFieldsProps {
  node: WorkflowNode;
  agentKeys: string[];
  onChange: (changes: Partial<WorkflowNode>) => void;
}

/**
 * DEVOS-160: an AGENT_TASK node targets an agent one of two mutually
 * exclusive ways (DEVOS-158) — a literal agentRef ("Specific agent") or a
 * requiredRole/requiredCapabilities pair resolved at run time by DEVOS-159's
 * real selection algorithm ("By role/capability"). Mode is inferred from
 * which fields the node already has set (requiredRole present ⇒ role mode),
 * defaulting to the existing "specific agent" behavior for every node
 * authored before this task. Switching modes clears the other mode's
 * fields, matching validateWorkflowGraph's own mutual-exclusivity rule
 * (packages/domain/src/workflows/validation.ts).
 */
function AgentTaskTargetFields({ node, agentKeys, onChange }: AgentTaskTargetFieldsProps) {
  const mode: AgentTargetMode =
    node.requiredRole !== undefined && node.requiredRole.trim().length > 0 ? 'role' : 'specific';

  function setMode(next: AgentTargetMode) {
    if (next === 'specific') {
      onChange({
        agentRef: node.agentRef ?? '',
        requiredRole: undefined,
        requiredCapabilities: undefined,
      });
    } else {
      onChange({ agentRef: undefined, requiredRole: node.requiredRole ?? '' });
    }
  }

  return (
    <Stack spacing={2}>
      <FormControl size="small">
        <InputLabel id="inspector-agent-target-mode">Target by</InputLabel>
        <Select
          labelId="inspector-agent-target-mode"
          label="Target by"
          value={mode}
          onChange={(event) => setMode(event.target.value as AgentTargetMode)}
        >
          <MenuItem value="specific">Specific agent</MenuItem>
          <MenuItem value="role">Role &amp; capabilities</MenuItem>
        </Select>
      </FormControl>

      {mode === 'specific' && (
        <FormControl size="small">
          <InputLabel id="inspector-agent-ref">Agent</InputLabel>
          <Select
            labelId="inspector-agent-ref"
            label="Agent"
            value={node.agentRef ?? ''}
            onChange={(event) => onChange({ agentRef: event.target.value })}
          >
            <MenuItem value="">
              <em>None</em>
            </MenuItem>
            {agentKeys.map((key) => (
              <MenuItem key={key} value={key}>
                {key}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}

      {mode === 'role' && (
        <>
          <TextField
            label="Required role"
            size="small"
            placeholder="e.g. DEVELOPMENT"
            value={node.requiredRole ?? ''}
            onChange={(event) => onChange({ requiredRole: event.target.value })}
          />
          <TextField
            label="Required capabilities (comma-separated, optional)"
            size="small"
            placeholder="e.g. repo-read, repo-write"
            value={(node.requiredCapabilities ?? []).join(', ')}
            onChange={(event) => {
              const capabilities = event.target.value
                .split(',')
                .map((capability) => capability.trim())
                .filter((capability) => capability.length > 0);
              onChange({
                requiredCapabilities: capabilities.length > 0 ? capabilities : undefined,
              });
            }}
          />
        </>
      )}
    </Stack>
  );
}

interface ConditionRuleFieldsProps {
  rule: ConditionRule;
  whenTrue: string;
  whenFalse: string;
  otherNodeIds: string[];
  onRuleChange: (rule: ConditionRule) => void;
  onBranchChange: (changes: { whenTrue?: string; whenFalse?: string }) => void;
}

function ConditionRuleFields({
  rule,
  whenTrue,
  whenFalse,
  otherNodeIds,
  onRuleChange,
  onBranchChange,
}: ConditionRuleFieldsProps) {
  const valueType = inferValueType(rule.value);

  return (
    <Stack spacing={2}>
      <FormControl size="small">
        <InputLabel id="inspector-condition-source">Rule source</InputLabel>
        <Select
          labelId="inspector-condition-source"
          label="Rule source"
          value={rule.source ?? ''}
          onChange={(event) =>
            onRuleChange({ ...rule, source: event.target.value as ConditionSource })
          }
        >
          <MenuItem value="">
            <em>Choose one</em>
          </MenuItem>
          {CONDITION_SOURCES.map((source) => (
            <MenuItem key={source} value={source}>
              {source}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {rule.source === 'variable' && (
        <TextField
          label="Run input path"
          size="small"
          placeholder="e.g. severity"
          value={rule.path ?? ''}
          onChange={(event) => onRuleChange({ ...rule, path: event.target.value })}
        />
      )}

      {(rule.source === 'task' || rule.source === 'artifact') && (
        <FormControl size="small">
          <InputLabel id="inspector-condition-taskkey">Upstream node</InputLabel>
          <Select
            labelId="inspector-condition-taskkey"
            label="Upstream node"
            value={rule.taskKey ?? ''}
            onChange={(event) => onRuleChange({ ...rule, taskKey: event.target.value })}
          >
            <MenuItem value="">
              <em>Choose a node</em>
            </MenuItem>
            {otherNodeIds.map((id) => (
              <MenuItem key={id} value={id}>
                {id}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}

      {rule.source === 'task' && (
        <TextField
          label="Output field"
          size="small"
          placeholder="e.g. passed"
          value={rule.field ?? ''}
          onChange={(event) => onRuleChange({ ...rule, field: event.target.value })}
        />
      )}

      <FormControl size="small">
        <InputLabel id="inspector-condition-operator">Operator</InputLabel>
        <Select
          labelId="inspector-condition-operator"
          label="Operator"
          value={rule.operator ?? ''}
          onChange={(event) =>
            onRuleChange({ ...rule, operator: event.target.value as ConditionOperator })
          }
        >
          <MenuItem value="">
            <em>Choose one</em>
          </MenuItem>
          {CONDITION_OPERATORS.map((operator) => (
            <MenuItem key={operator} value={operator}>
              {operator}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {rule.operator !== 'exists' && (
        <Stack direction="row" spacing={1}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel id="inspector-condition-value-type">Value type</InputLabel>
            <Select
              labelId="inspector-condition-value-type"
              label="Value type"
              value={valueType}
              onChange={(event) =>
                onRuleChange({
                  ...rule,
                  value: coerceValue(
                    String(rule.value ?? ''),
                    event.target.value as typeof valueType,
                  ),
                })
              }
            >
              <MenuItem value="string">string</MenuItem>
              <MenuItem value="number">number</MenuItem>
              <MenuItem value="boolean">boolean</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label="Value"
            size="small"
            fullWidth
            value={rule.value === undefined ? '' : String(rule.value)}
            onChange={(event) =>
              onRuleChange({ ...rule, value: coerceValue(event.target.value, valueType) })
            }
          />
        </Stack>
      )}

      <TextField
        label="Branch key when true"
        size="small"
        placeholder="true"
        value={whenTrue}
        onChange={(event) => onBranchChange({ whenTrue: event.target.value })}
      />
      <TextField
        label="Branch key when false"
        size="small"
        placeholder="false"
        value={whenFalse}
        onChange={(event) => onBranchChange({ whenFalse: event.target.value })}
      />
    </Stack>
  );
}
