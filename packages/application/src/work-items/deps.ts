import type {
  AuditRecordRepository,
  MembershipRepository,
  ProjectRepository,
  WorkItemAssignmentRepository,
  WorkItemCommentRepository,
  WorkItemRepository,
} from '@devos/domain';

export interface WorkItemUseCaseDeps {
  projects: ProjectRepository;
  memberships: MembershipRepository;
  workItems: WorkItemRepository;
  /** DEVOS-115: work-item creation/update are audited, extending DEVOS-086's
   * coverage. */
  auditRecords: AuditRecordRepository;
  /** DEVOS-304/305 (Sprint 50): backs `updateWorkItem`'s new
   * assignment-gated edit/transition check and the new assign/remove/list
   * use cases below. Required, not optional — unlike this codebase's usual
   * "optional additive dependency" convention (e.g.
   * `PrincipalJobRoleRepository.listForPrincipals?`), because exactly one
   * production call site (`apps/api/src/app.ts`) and one test-fake
   * constructor (`apps/api/tests/app.test.ts`'s `createInMemoryWorkItemDeps`)
   * build a full `WorkItemUseCaseDeps` object literal, so widening it
   * costs nothing here and leaving it optional would let the new
   * authorization check silently no-op wherever it's omitted — the wrong
   * default for a genuine access restriction, unlike `outboxEvents?`'s own
   * enhancement-only optional dependencies. */
  workItemAssignments: WorkItemAssignmentRepository;
  /** DEVOS-309 (Sprint 51 reconciliation): backs `addWorkItemComment`/
   * `listWorkItemComments` — required, matching `workItemAssignments`'s own
   * precedent above and its identical reasoning (only two real production/
   * test-fake construction sites, so widening costs nothing; leaving it
   * optional would let a genuinely new capability silently 404/no-op
   * wherever this deps object is built without it). */
  workItemComments: WorkItemCommentRepository;
}
