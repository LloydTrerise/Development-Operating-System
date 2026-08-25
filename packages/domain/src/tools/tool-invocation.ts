import type {
  ToolCapabilityId,
  ToolInvocationId,
  ToolInvocationStatus,
  WorkflowTaskId,
} from '@devos/contracts';

/**
 * "Stores material tool execution history" (specs/database/poc-database-schema.md
 * §14.2). Recorded once, at chain completion, rather than as a
 * PENDING-then-updated row: nothing in Sprint 4 needs to observe an
 * in-flight state, and a single `create` keeps this repository's shape
 * symmetric with `ToolCapabilityRepository`'s (DEVOS-052's own decision,
 * logged in `DEVOS-SPRINT4-DECISIONS.md`).
 *
 * `outputMetadata` is optional despite the schema not marking that column
 * "Nullable" — a `REJECTED` invocation (stopped before the provider
 * adapter, specs/api/poc-api-contracts.md §56) has no result to report.
 */
export interface ToolInvocation {
  id: ToolInvocationId;
  workflowTaskId: WorkflowTaskId;
  toolCapabilityId: ToolCapabilityId;
  status: ToolInvocationStatus;
  inputMetadata: Record<string, unknown>;
  outputMetadata?: Record<string, unknown>;
  providerReference?: string;
  /** Not in specs/database/poc-database-schema.md §14.2's documented column
   * list — added by DEVOS-059 (migration `0025`) so a repeated request can
   * actually be looked up and matched against what it was originally
   * authorised for ("mutation safety controls"), rather than only being
   * recoverable by parsing `inputMetadata`. */
  idempotencyKey?: string;
  startedAt?: string;
  completedAt?: string;
  errorCode?: string;
  createdAt: string;
}

export interface ToolInvocationRepository {
  getById: (id: ToolInvocationId) => Promise<ToolInvocation | null>;
  getByCapabilityAndIdempotencyKey: (
    toolCapabilityId: ToolCapabilityId,
    idempotencyKey: string,
  ) => Promise<ToolInvocation | null>;
  /** DEVOS-060: the read side the Development UI needs — every invocation
   * a development task produced, in creation order. */
  listForTask: (workflowTaskId: WorkflowTaskId) => Promise<ToolInvocation[]>;
  create: (invocation: ToolInvocation) => Promise<void>;
}
