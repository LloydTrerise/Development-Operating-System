import type {
  AgentVersionRepository,
  AuditRecordRepository,
  MembershipRepository,
  PolicyRepository,
  ProjectRepository,
  ToolCapabilityRepository,
  ToolInvocationRepository,
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
   * Capability key -> adapter. Empty until DEVOS-054/058 register the real
   * Git/PR-creation adapters; invoking a capability with no registered
   * adapter is itself a valid, recorded `FAILED` outcome
   * (`DEVOS_NO_PROVIDER_ADAPTER`), not an error hidden from the caller.
   */
  adapters: Record<string, ProviderAdapter>;
}
