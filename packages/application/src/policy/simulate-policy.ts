import type { AgentVersionId, PolicyId } from '@devos/contracts';
import type { AuditRecord, Policy } from '@devos/domain';
import { evaluatePoliciesWithPrecedence, type PolicyEvaluationResult } from '@devos/policy';
import { NotFoundError } from '../errors.js';
import type { PolicyUseCaseDeps } from './deps.js';
import { resolveMembershipForPolicy } from './resolve-policy-membership.js';

const DEFAULT_LIMIT = 50;

export interface SimulatedDecision {
  auditRecordId: string;
  action: string;
  actualOutcome: AuditRecord['outcome'];
  decision: PolicyEvaluationResult;
}

export interface SimulatePolicyOptions {
  limit?: number;
}

/**
 * DEVOS-141: Security spec §53's "policy simulation before deployment,"
 * deliberately narrowed to real historical data (no synthetic what-if
 * request builder). A `tool_invocation.*` `AuditRecord`'s own `metadata`
 * (`invoke-tool.ts`'s `audit()` closure) carries a reliable policy `action`
 * (`metadata.capability`, the real capability key `evaluatePolicies` was
 * originally keyed on); an `approval.approved`/`approval.rejected` record
 * (`approval-run-transition.ts`) likewise now carries `metadata.approvalType`
 * (a gap revisit closed post-Sprint-16 — this record previously stored only
 * `decisionReason`, with no reliable action to replay at all). Every other
 * audit category (`policy.*`/`membership.*`/`workflow.*`/etc.) still has no
 * equivalent stored attribute and is silently skipped, not fabricated into
 * an approximate request.
 *
 * The draft policy under simulation is evaluated as if it were already
 * published (its own `status` is not itself changed anywhere — only a
 * throwaway copy passed to the evaluator), prepended to whatever policies of
 * its own scope already apply, through the same real, unmodified
 * `evaluatePoliciesWithPrecedence` the real `invoke-tool.ts`/`decide-approval.ts`
 * call sites use — so a simulated decision genuinely shows what publishing
 * this draft would do, including DEVOS-139's own organisation/project
 * precedence rule.
 */
export async function simulatePolicy(
  deps: PolicyUseCaseDeps,
  principalId: string,
  policyId: PolicyId,
  options: SimulatePolicyOptions = {},
): Promise<SimulatedDecision[]> {
  const policy = await deps.policies.getById(policyId);
  if (!policy) throw new NotFoundError('Policy');

  const resolved = await resolveMembershipForPolicy(deps, principalId, policy);
  if (!resolved) throw new NotFoundError('Policy');

  const limit = options.limit ?? DEFAULT_LIMIT;
  const records =
    policy.projectId !== undefined
      ? await deps.auditRecords.listForProject(policy.projectId, limit)
      : await deps.auditRecords.listForOrganisation(policy.organisationId, limit);

  const draftAsPublished: Policy = { ...policy, status: 'PUBLISHED' };
  let organisationPolicies: Policy[];
  let projectPolicies: Policy[];
  if (policy.projectId !== undefined) {
    const [existingOrganisationPolicies, existingProjectPolicies] = await Promise.all([
      deps.policies.listForOrganisation(policy.organisationId),
      deps.policies.listForProject(policy.projectId),
    ]);
    organisationPolicies = existingOrganisationPolicies;
    projectPolicies = [...existingProjectPolicies, draftAsPublished];
  } else {
    const existingOrganisationPolicies = await deps.policies.listForOrganisation(
      policy.organisationId,
    );
    organisationPolicies = [...existingOrganisationPolicies, draftAsPublished];
    projectPolicies = [];
  }

  const results: SimulatedDecision[] = [];
  for (const record of records) {
    const metadata = record.metadata as
      | { capability?: unknown; agentVersionId?: unknown; approvalType?: unknown }
      | undefined;

    let action: string | null = null;
    let resourceType: string | undefined;
    if (typeof metadata?.capability === 'string' && metadata.capability.trim().length > 0) {
      action = metadata.capability;
      resourceType = 'TOOL_CAPABILITY';
    } else if (
      typeof metadata?.approvalType === 'string' &&
      metadata.approvalType.trim().length > 0
    ) {
      action = metadata.approvalType;
      resourceType = 'APPROVAL';
    }
    if (action === null) continue;

    let agentContext: { agentId?: string; agentVersion?: number } = {};
    if (typeof metadata?.agentVersionId === 'string' && deps.agentVersions) {
      const agentVersion = await deps.agentVersions.getById(
        metadata.agentVersionId as AgentVersionId,
      );
      if (agentVersion) {
        agentContext = { agentId: agentVersion.agentId, agentVersion: agentVersion.version };
      }
    }

    const decision = evaluatePoliciesWithPrecedence(organisationPolicies, projectPolicies, {
      action,
      ...(resourceType !== undefined ? { resourceType } : {}),
      ...agentContext,
    });

    results.push({
      auditRecordId: record.id,
      action,
      actualOutcome: record.outcome,
      decision,
    });
  }

  return results;
}
