import type {
  ApprovalRepository,
  ArtifactVersionRepository,
  MembershipRepository,
  PolicyRepository,
  ProjectRepository,
  WorkflowDefinitionRepository,
  WorkflowRunRepository,
  WorkflowTaskRepository,
  WorkflowVersionRepository,
  WorkItemRepository,
} from '@devos/domain';
import type { CreateWorkflowDraft, StartWorkflowRun } from '../workflows/deps.js';

/**
 * DEVOS-047/DEVOS-111: records the decision itself as an audit event, then
 * — only if the approval's run is still `AWAITING_APPROVAL` — completes or
 * fails that run, in the *same* transaction as the decision write itself
 * (previously two separate operations — see DEVOS-111's own decision-log
 * entry for the real crash window this closes). Implemented in
 * `packages/database` (`createDecideApprovalAndTransition`), matching the
 * shape here structurally rather than importing it, mirroring
 * `RecordContextManifest`'s established pattern (`tasks/deps.ts`).
 */
export type DecideApprovalAndTransition = (
  approvalId: string,
  workflowRunId: string,
  approvalType: string,
  decision: 'APPROVED' | 'REJECTED',
  decidedBy: string,
  decisionReason: string | undefined,
  decidedAt: string,
) => Promise<void>;

export interface ApprovalUseCaseDeps {
  projects: ProjectRepository;
  memberships: MembershipRepository;
  workflowRuns: WorkflowRunRepository;
  artifactVersions: ArtifactVersionRepository;
  approvals: ApprovalRepository;
  /** DEVOS-110: a published policy can now block or condition an approval
   * decision, the same evaluator (DEVOS-044) the Tool Gateway already
   * consults for tool invocations. */
  policies: PolicyRepository;
  decideApprovalAndTransition: DecideApprovalAndTransition;
  /**
   * DEVOS-112: a rejected `PLANNING` approval starts a new planning-path
   * run for the same work item (the re-planning loop) — exactly
   * `@devos/application`'s own `WorkflowUseCaseDeps` shape, so
   * `startRunForVersion` (`workflows/run-creation.ts`) can be called
   * directly with this same `deps` object, mirroring `ReviewAgentTaskHandlerDeps`'s
   * identical structural-satisfaction approach for its own rework loop.
   */
  workItems: WorkItemRepository;
  workflowDefinitions: WorkflowDefinitionRepository;
  workflowVersions: WorkflowVersionRepository;
  workflowTasks: WorkflowTaskRepository;
  createDraft: CreateWorkflowDraft;
  startRun: StartWorkflowRun;
}
