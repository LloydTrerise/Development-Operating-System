import type { OrganisationId, ProjectId } from '@devos/contracts';

/**
 * DEVOS-299 (Sprint 49, `specs/DEVOS-ACCESS-CONTROL-MODEL-BACKLOG.md` §6.4,
 * decision §9.5): a "job role" is a job-function label (Product Owner,
 * Business Analyst, Developer, QA) held by a principal within an
 * organisation — explicitly distinct from, and never renamed to match, the
 * existing agent workflow-role dispatch key (`DISCOVERY`/`REQUIREMENTS`/
 * `TECHNICAL_DESIGN`/`PLANNING`/`DEVELOPMENT`/`REVIEW`,
 * `packages/domain/src/agents/agent.ts` and friends). UI/API language always
 * says "job role," never bare "role" (that word is already taken by
 * `MembershipRole`, `packages/domain/src/projects/membership.ts`).
 *
 * Seeded per-organisation (migration `0051`) with the four default keys
 * below, mirroring the source document's own PO/BA/DEV/QA example set. Each
 * organisation could in principle define its own equivalent set in the
 * future — this sprint only ever seeds the default four; no route to
 * create/rename/retire a `JobRole` is built here (out of scope, see
 * `specs/sprints/sprint-49/README.md`).
 */
export const defaultJobRoleKeys = ['PO', 'BA', 'DEV', 'QA'] as const;
export type DefaultJobRoleKey = (typeof defaultJobRoleKeys)[number];

export interface JobRole {
  id: string;
  organisationId: OrganisationId;
  key: string;
  name: string;
  createdAt: string;
}

export interface JobRoleRepository {
  listForOrganisation: (organisationId: OrganisationId) => Promise<JobRole[]>;
  getById: (id: string) => Promise<JobRole | null>;
  create: (jobRole: JobRole) => Promise<void>;
}

/**
 * DEVOS-299: `PRINCIPAL_JOB_ROLE` — a principal "holds" a job role at
 * organisation scope (can be a `HUMAN` or `AGENT` principal, decision §9.5's
 * own dependency on Sprint 48). This is the set DEVOS-300's per-project
 * subset is drawn from.
 */
export interface PrincipalJobRole {
  principalId: string;
  jobRoleId: string;
  createdAt: string;
}

export interface PrincipalJobRoleRepository {
  listForPrincipal: (principalId: string) => Promise<PrincipalJobRole[]>;
  /** DEVOS-301: batches the Project Members panel's own job-role overview
   * in one query instead of one per member — avoiding the N+1 shape
   * `ApprovalsPage.tsx`'s own long-disclosed, still-unfixed evidence-fetch
   * loop already demonstrates the cost of (Sprint 35 §DEVOS-238, carried
   * across Sprints 39/43/44 undecided). Optional, matching this codebase's
   * established "additive method, real implementation only where wired"
   * convention — every existing `PrincipalJobRoleRepository` test fake that
   * omits it is unaffected. */
  listForPrincipals?: (principalIds: string[]) => Promise<PrincipalJobRole[]>;
  create: (row: PrincipalJobRole) => Promise<void>;
  remove: (principalId: string, jobRoleId: string) => Promise<void>;
}

/**
 * DEVOS-300: `PROJECT_MEMBER_JOB_ROLE` — the per-project *active* subset of
 * job roles a principal already holds. Enforced at the database layer
 * (migration `0052`'s composite FK to `principal_job_roles`), not just in
 * application code, matching the source document's rule exactly: a
 * Dev+BA can only ever be activated as Dev on a project that never granted
 * them the BA job role at organisation scope, and Postgres itself rejects
 * any attempt to activate a job role the principal doesn't already hold.
 */
export interface ProjectMemberJobRole {
  projectId: ProjectId;
  principalId: string;
  jobRoleId: string;
  createdAt: string;
}

export interface ProjectMemberJobRoleRepository {
  listForProject: (projectId: ProjectId) => Promise<ProjectMemberJobRole[]>;
  create: (row: ProjectMemberJobRole) => Promise<void>;
  remove: (projectId: ProjectId, principalId: string, jobRoleId: string) => Promise<void>;
}
