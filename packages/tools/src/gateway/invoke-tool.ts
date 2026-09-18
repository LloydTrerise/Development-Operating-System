import { randomUUID } from 'node:crypto';
import type { AuditId, ProjectId, WorkflowTaskId } from '@devos/contracts';
import type { AuditOutcome, ToolInvocation } from '@devos/domain';
import { NotFoundError, ValidationError } from '@devos/domain';
import { evaluatePolicies } from '@devos/policy';
import { validateToolInput } from '../validation/validate-tool-input.js';
import type { ToolGatewayDeps } from './deps.js';
import { resolveProjectScope } from './resolve-project-scope.js';
import type { InvokeToolInput } from './types.js';

// Mirrors packages/database/src/repositories/publish-artifact.ts's
// identical set — the agent runtime acting without a human principal.
// Duplicated locally (not imported) for the same package-boundary reason
// `resolveProjectScope` is: packages/tools depends on domain, not database.
const SYSTEM_ACTOR_IDS = new Set(['devos-deterministic-stub', 'devos-agent-runtime']);

function outcomeFor(status: ToolInvocation['status']): AuditOutcome {
  return status === 'SUCCEEDED' ? 'SUCCESS' : 'FAILURE';
}

/**
 * A key-order-independent stand-in for `JSON.stringify` equality checks.
 * `existing.inputMetadata` has round-tripped through a Postgres `jsonb`
 * column, which does not preserve the original object's key insertion
 * order — plain `JSON.stringify` comparison would then report a spurious
 * mismatch (and reject a legitimately identical replay as a branch-binding
 * violation) purely because of key reordering, not a real value
 * difference.
 */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    return `{${keys
      .map(
        (key) =>
          `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`,
      )
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

/**
 * The Tool Gateway's full chain (specs/api/poc-api-contracts.md §56):
 * Typed Validation -> Project Scope -> Policy -> Capability Permission ->
 * Credential Resolution -> Provider Adapter. "The existence of an API
 * contract, workflow task, or agent instruction does not itself grant
 * permission to perform an external action" — every step here can reject
 * before the provider adapter is ever reached.
 *
 * Capability lookup happens immediately after Project Scope, ahead of the
 * named "Capability Permission" step: `tool_invocations.tool_capability_id`
 * is a required FK (specs/database/poc-database-schema.md §14.2), so no row
 * can be recorded at all — for a Policy rejection or anything after —
 * without the capability's `id` already resolved. Policy still evaluates
 * using the capability's own `key` as the action, exactly as the chain
 * names it; only the *row's* FK dependency is what forces the lookup
 * earlier than "Capability Permission" (which remains the step that
 * actually gates on the capability's `status`).
 *
 * DEVOS-044's policy evaluator is deliberately consulted here — this is
 * the "not yet wired into any real decision point" gap
 * `DEVOS-SPRINT3-DECISIONS.md` flagged for DEVOS-044, now closed.
 *
 * DEVOS-059's mutation safety controls sit right after capability
 * resolution: an existing invocation for the same `(capability,
 * idempotencyKey)` pair is looked up before anything else runs. If its
 * recorded `target`/`parameters` match exactly, this is a genuine retry —
 * the original invocation is returned unchanged, with no new row and no
 * second call to the provider adapter ("Prevent repeated external side
 * effects through idempotency," specs/workflows/software-change-workflow.md
 * §24). If they differ, the same key is being reused to authorise a
 * *different* mutation than it originally was — an implementation-level
 * "branch binding" check (DEVOS-059's own spec: neither "branch binding"
 * nor "mutation safety" is a named mechanism anywhere in the spec corpus)
 * rejects it as `DEVOS_TOOL_BRANCH_BINDING_VIOLATION` rather than silently
 * proceeding or silently replaying the wrong thing.
 *
 * Every outcome from here down — a genuine replay, a branch-binding
 * rejection, or any of the chain's other REJECTED/FAILED/SUCCEEDED
 * results — also writes an audit record ("every tool invocation...
 * produces an audit record").
 */
export async function invokeTool(
  deps: ToolGatewayDeps,
  principalId: string,
  projectId: ProjectId,
  workflowTaskId: WorkflowTaskId,
  input: InvokeToolInput,
): Promise<ToolInvocation> {
  if (input.capabilityKey.trim().length === 0) {
    throw new ValidationError('capabilityKey is required.');
  }
  if (input.idempotencyKey.trim().length === 0) {
    throw new ValidationError('idempotencyKey is required.');
  }

  const project = await deps.projects.getById(projectId);
  if (!project) throw new NotFoundError('Project');

  const membership = await resolveProjectScope(deps, principalId, project);
  if (!membership) throw new NotFoundError('Project');

  const capability = await deps.toolCapabilities.getByProjectAndKey(projectId, input.capabilityKey);
  if (!capability) throw new NotFoundError('ToolCapability');

  const inputMetadata = {
    capability: input.capabilityKey,
    target: input.target,
    parameters: input.parameters,
    idempotencyKey: input.idempotencyKey,
    ...(input.correlationId !== undefined ? { correlationId: input.correlationId } : {}),
    // DEVOS-116: `agentVersionId` was only ever used transiently, to decide
    // ALLOW/DENY against DEVOS-085's own capability-permission check below
    // — the persisted `ToolInvocation` (and its own audit record) never
    // actually recorded which agent version, if any, the invocation was
    // carrying out. Recorded here the same way `correlationId` already is,
    // so a real attribution trail survives past the gate check itself.
    ...(input.agentVersionId !== undefined ? { agentVersionId: input.agentVersionId } : {}),
  };
  const capabilityId = capability.id;

  const audit = async (invocation: ToolInvocation): Promise<void> => {
    await deps.auditRecords.create({
      id: randomUUID() as AuditId,
      organisationId: project.organisationId,
      projectId,
      actorType: SYSTEM_ACTOR_IDS.has(principalId) ? 'SYSTEM' : 'USER',
      actorId: principalId,
      action: `tool_invocation.${invocation.status.toLowerCase()}`,
      targetType: 'ToolInvocation',
      targetId: invocation.id,
      outcome: outcomeFor(invocation.status),
      metadata: {
        capability: capability.key,
        errorCode: invocation.errorCode ?? null,
        // DEVOS-116: the audit record's own durable attribution, mirroring
        // `inputMetadata` above.
        ...(input.agentVersionId !== undefined ? { agentVersionId: input.agentVersionId } : {}),
      },
      ...(input.correlationId !== undefined ? { correlationId: input.correlationId } : {}),
      createdAt: new Date().toISOString(),
    });
  };

  const recordAndAudit = async (invocation: ToolInvocation): Promise<ToolInvocation> => {
    await deps.toolInvocations.create(invocation);
    await audit(invocation);
    return invocation;
  };

  const existing = await deps.toolInvocations.getByCapabilityAndIdempotencyKey(
    capabilityId,
    input.idempotencyKey,
  );
  if (existing) {
    const existingInput = existing.inputMetadata as {
      target?: unknown;
      parameters?: unknown;
    };
    const matches =
      stableStringify(existingInput.target) === stableStringify(input.target) &&
      stableStringify(existingInput.parameters) === stableStringify(input.parameters);

    if (matches) {
      await audit(existing);
      return existing;
    }

    return recordAndAudit({
      id: randomUUID() as ToolInvocation['id'],
      workflowTaskId,
      toolCapabilityId: capabilityId,
      status: 'REJECTED',
      inputMetadata,
      idempotencyKey: input.idempotencyKey,
      errorCode: 'DEVOS_TOOL_BRANCH_BINDING_VIOLATION',
      createdAt: new Date().toISOString(),
    });
  }

  const reject = (errorCode: string): Promise<ToolInvocation> =>
    recordAndAudit({
      id: randomUUID() as ToolInvocation['id'],
      workflowTaskId,
      toolCapabilityId: capabilityId,
      status: 'REJECTED',
      inputMetadata,
      idempotencyKey: input.idempotencyKey,
      errorCode,
      createdAt: new Date().toISOString(),
    });

  const policies = await deps.policies.listForProject(projectId);
  const targetEnvironment = input.target['environment'];
  const decision = evaluatePolicies(policies, {
    action: capability.key,
    actorRole: membership.role,
    resourceType: 'TOOL_CAPABILITY',
    ...(typeof targetEnvironment === 'string' ? { environment: targetEnvironment } : {}),
  });
  if (decision.decision !== 'ALLOW') {
    return reject(`DEVOS_TOOL_POLICY_${decision.decision}`);
  }

  if (capability.status !== 'ACTIVE') {
    return reject('DEVOS_TOOL_CAPABILITY_DISABLED');
  }

  const issues = validateToolInput(input.parameters, capability.inputSchema);
  if (issues.length > 0) {
    return reject('DEVOS_TOOL_INPUT_INVALID');
  }

  // DEVOS-085: Agent Capability Permission — `AgentVersion.configuration
  // .allowedCapabilities` was validated on input and stored (DEVOS-025) but
  // never checked anywhere at runtime (confirmed by inspection before this
  // task). When this invocation is carrying out a specific agent version's
  // proposal, that version must actually be allowed to reach this
  // capability, independent of the project-level Policy/Capability
  // Permission steps above (which govern the project, not any one agent).
  if (input.agentVersionId !== undefined) {
    const agentVersion = await deps.agentVersions?.getById(input.agentVersionId);
    if (!agentVersion || !agentVersion.configuration.allowedCapabilities.includes(capability.key)) {
      return reject('DEVOS_AGENT_CAPABILITY_DENIED');
    }
  }

  // Credential Resolution: no integration/credential-broker mechanism
  // exists yet (DEVOS-053) — a deliberate no-op pass-through, flagged
  // rather than fabricated.

  const adapter = deps.adapters[capability.key];
  const startedAt = new Date().toISOString();

  if (!adapter) {
    return recordAndAudit({
      id: randomUUID() as ToolInvocation['id'],
      workflowTaskId,
      toolCapabilityId: capabilityId,
      status: 'FAILED',
      inputMetadata,
      idempotencyKey: input.idempotencyKey,
      outputMetadata: {},
      startedAt,
      completedAt: new Date().toISOString(),
      errorCode: 'DEVOS_NO_PROVIDER_ADAPTER',
      createdAt: new Date().toISOString(),
    });
  }

  try {
    const result = await adapter.invoke(input.target, input.parameters);
    return recordAndAudit({
      id: randomUUID() as ToolInvocation['id'],
      workflowTaskId,
      toolCapabilityId: capabilityId,
      status: 'SUCCEEDED',
      inputMetadata,
      idempotencyKey: input.idempotencyKey,
      outputMetadata: result.outputMetadata,
      ...(result.providerReference !== undefined
        ? { providerReference: result.providerReference }
        : {}),
      startedAt,
      completedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    return recordAndAudit({
      id: randomUUID() as ToolInvocation['id'],
      workflowTaskId,
      toolCapabilityId: capabilityId,
      status: 'FAILED',
      inputMetadata,
      idempotencyKey: input.idempotencyKey,
      outputMetadata: {},
      startedAt,
      completedAt: new Date().toISOString(),
      errorCode: error instanceof Error ? error.message : 'DEVOS_TOOL_INVOCATION_FAILED',
      createdAt: new Date().toISOString(),
    });
  }
}
