import type {
  AgentVersionRepository,
  ApprovalRepository,
  AuditRecordRepository,
  MembershipRepository,
  PolicyRepository,
  ProjectRepository,
  ToolCapabilityRepository,
  ToolInvocationRepository,
  WorkflowTaskRepository,
  WorkflowVersionRepository,
} from '@devos/domain';
import type { ProviderAdapter } from './types.js';

export interface ToolGatewayDeps {
  projects: ProjectRepository;
  memberships: MembershipRepository;
  policies: PolicyRepository;
  toolCapabilities: ToolCapabilityRepository;
  toolInvocations: ToolInvocationRepository;
  /** DEVOS-059: "every tool invocation... produces an audit record." */
  auditRecords: AuditRecordRepository;
  /**
   * DEVOS-085: only required to resolve `InvokeToolInput.agentVersionId`
   * when a caller supplies one. Optional so every existing caller that
   * never passes an agent version (build/test/deploy task handlers, and
   * every test not exercising agent-capability enforcement) is unaffected.
   */
  agentVersions?: AgentVersionRepository;
  /**
   * DEVOS-138: only required to resolve `InvokeToolInput.workflowVersionId`
   * when a caller supplies one — mirrors `agentVersions` exactly.
   */
  workflowVersions?: WorkflowVersionRepository;
  /**
   * Gap revisit (post-Sprint-16): only required to act on a policy's own
   * `REQUIRE_APPROVAL` decision for real — creating/resolving a real
   * `Approval` bound to the invoking task's own run — instead of the
   * pre-existing behaviour of rejecting it identically to `DENY`. Optional:
   * omitted entirely (or supplied without `workflowTasks`), the gateway
   * falls back to that exact pre-existing behaviour, so no caller is forced
   * to opt in.
   */
  approvals?: ApprovalRepository;
  /** Gap revisit: resolves the invoking task's own `workflowRunId` — see `approvals` above. */
  workflowTasks?: WorkflowTaskRepository;
  /**
   * Capability key -> adapter. Empty until DEVOS-054/058 register the real
   * Git/PR-creation adapters; invoking a capability with no registered
   * adapter is itself a valid, recorded `FAILED` outcome
   * (`DEVOS_NO_PROVIDER_ADAPTER`), not an error hidden from the caller.
   */
  adapters: Record<string, ProviderAdapter>;
}
