import type { ApprovalId, ProjectId, WorkflowRunId } from '@devos/contracts';
import {
  approveApproval,
  getApprovalForPrincipal,
  listApprovalsForProject,
  listApprovalsForRun,
  rejectApproval,
  requestApproval,
  type ApprovalUseCaseDeps,
} from '@devos/application';
import {
  parseDecideApprovalBody,
  parseRequestApprovalBody,
  toApprovalDto,
} from '../dto/approval.js';
import { requirePrincipal, type Route } from '../http/router.js';

export function createApprovalRoutes(prefix: string, deps: ApprovalUseCaseDeps): Route[] {
  return [
    {
      method: 'GET',
      pattern: `${prefix}/projects/:projectId/approvals`,
      protected: true,
      handler: async ({ principal, params }) => {
        const user = requirePrincipal(principal);
        const approvals = await listApprovalsForProject(
          deps,
          user.id,
          params.projectId as ProjectId,
        );
        return approvals.map(toApprovalDto);
      },
    },
    {
      method: 'POST',
      pattern: `${prefix}/projects/:projectId/approvals`,
      protected: true,
      handler: async ({ principal, params, body }) => {
        const user = requirePrincipal(principal);
        const input = parseRequestApprovalBody(body);
        const approval = await requestApproval(deps, user.id, params.projectId as ProjectId, {
          workflowRunId: input.workflowRunId as WorkflowRunId,
          approvalType: input.approvalType,
          artifactVersionIds: input.artifactVersionIds,
        });
        return toApprovalDto(approval);
      },
    },
    {
      method: 'GET',
      pattern: `${prefix}/runs/:runId/approvals`,
      protected: true,
      handler: async ({ principal, params }) => {
        const user = requirePrincipal(principal);
        const approvals = await listApprovalsForRun(deps, user.id, params.runId as WorkflowRunId);
        return approvals.map(toApprovalDto);
      },
    },
    {
      method: 'GET',
      pattern: `${prefix}/approvals/:approvalId`,
      protected: true,
      handler: async ({ principal, params }) => {
        const user = requirePrincipal(principal);
        const approval = await getApprovalForPrincipal(
          deps,
          user.id,
          params.approvalId as ApprovalId,
        );
        return toApprovalDto(approval);
      },
    },
    {
      method: 'POST',
      pattern: `${prefix}/approvals/:approvalId/approve`,
      protected: true,
      handler: async ({ principal, params, body }) => {
        const user = requirePrincipal(principal);
        const input = parseDecideApprovalBody(body);
        const approval = await approveApproval(
          deps,
          user.id,
          params.approvalId as ApprovalId,
          input,
        );
        return toApprovalDto(approval);
      },
    },
    {
      method: 'POST',
      pattern: `${prefix}/approvals/:approvalId/reject`,
      protected: true,
      handler: async ({ principal, params, body }) => {
        const user = requirePrincipal(principal);
        const input = parseDecideApprovalBody(body);
        const approval = await rejectApproval(
          deps,
          user.id,
          params.approvalId as ApprovalId,
          input,
        );
        return toApprovalDto(approval);
      },
    },
  ];
}
