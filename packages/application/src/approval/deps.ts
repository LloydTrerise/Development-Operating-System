import type {
  ApprovalRepository,
  ArtifactVersionRepository,
  MembershipRepository,
  ProjectRepository,
  WorkflowRunRepository,
} from '@devos/domain';

/**
 * DEVOS-047: records the decision itself as an audit event, then — only if
 * the approval's run is still `AWAITING_APPROVAL` — completes or fails that
 * run. Implemented in `packages/database` (`createApprovalRunTransition`),
 * matching the shape here structurally rather than importing it, mirroring
 * `RecordContextManifest`'s established pattern (`tasks/deps.ts`).
 */
export type TransitionAfterApprovalDecision = (
  approvalId: string,
  workflowRunId: string,
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
  transitionAfterApprovalDecision: TransitionAfterApprovalDecision;
}
