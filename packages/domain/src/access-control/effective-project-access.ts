import type { ProjectId } from '@devos/contracts';

/**
 * DEVOS-291/292 (Sprint 47): backed by the real `effective_project_access`
 * Postgres view (migration `0049`) — every project a principal can reach
 * either directly (a project-level membership row) or organisation-wide (an
 * `ORGANISATION_ADMIN` membership row, or being the organisation's
 * `owner_principal_id`), per the source document's Option B rule applied at
 * organisation scope (no `DIVISION` tier exists in this codebase, backlog
 * §9.2). A standalone function type, not a widened `MembershipRepository`
 * method — mirrors `ListWorkflowRunsForDefinition`'s own established
 * precedent (Sprint 41) for a cross-table composed query no single
 * repository interface should own.
 */
export type ListEffectiveProjectIdsForPrincipal = (principalId: string) => Promise<ProjectId[]>;
