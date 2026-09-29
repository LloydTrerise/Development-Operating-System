import type { OrganisationId, ProjectId } from '@devos/contracts';
import type { ProjectRepository } from '@devos/domain';
import type { RouteContext } from './router.js';

type OrganisationIdResolver = (context: RouteContext) => Promise<OrganisationId | null>;

/**
 * DEVOS-338 (Sprint 59, candidate epic E31 part 4): the route surface is not
 * uniformly organisation-keyed (confirmed by direct inspection at conversion
 * time, `specs/sprints/sprint-59/README.md`'s own grounding) — these five
 * small, composable resolvers cover every real mechanism found across the
 * 62 mutating routes; there is no single generic resolver that fits all of
 * them.
 */

/** A route already keyed by `:organisationId` (or an equivalently-named
 * param) directly in its own pattern — no lookup needed. */
export function organisationIdFromParams(paramName = 'organisationId'): OrganisationIdResolver {
  return async (context) => {
    const value = context.params[paramName];
    return value !== undefined && value.length > 0 ? (value as OrganisationId) : null;
  };
}

/** A route keyed by `:projectId` (or an equivalently-named param) —
 * resolves the owning organisation via `ProjectRepository.getById`. Returns
 * `null` (never gated) if the project itself does not exist. */
export function organisationIdViaProjectParam(
  projects: Pick<ProjectRepository, 'getById'>,
  paramName = 'projectId',
): OrganisationIdResolver {
  return async (context) => {
    const projectId = context.params[paramName];
    if (projectId === undefined || projectId.length === 0) return null;
    const project = await projects.getById(projectId as ProjectId);
    return project ? project.organisationId : null;
  };
}

/** A route keyed by a project id supplied in the request body rather than
 * the URL — e.g. the agent/knowledge-source marketplace "install" routes,
 * which mutate `body.targetProjectId`, not the organisation named in the
 * route's own `:organisationId` param (that param names where the shared
 * resource is being browsed *from*, not what is actually being mutated). */
export function organisationIdViaProjectBodyField(
  projects: Pick<ProjectRepository, 'getById'>,
  fieldName: string,
): OrganisationIdResolver {
  return async (context) => {
    const body = context.body as Record<string, unknown> | undefined;
    const projectId = body?.[fieldName];
    if (typeof projectId !== 'string' || projectId.length === 0) return null;
    const project = await projects.getById(projectId as ProjectId);
    return project ? project.organisationId : null;
  };
}

/** A route keyed by an entity id one level removed from its owning project
 * (e.g. `/agents/:agentId/publish`, `/work-items/:workItemId`) — loads the
 * entity first (reusing the same repository lookup its own handler already
 * uses), then resolves via that entity's own `projectId`. Returns `null`
 * (never gated) if the entity itself does not exist. */
export function organisationIdViaEntityProject<TEntity>(
  getEntity: (context: RouteContext) => Promise<TEntity | null>,
  projectIdOf: (entity: TEntity) => ProjectId,
  projects: Pick<ProjectRepository, 'getById'>,
): OrganisationIdResolver {
  return async (context) => {
    const entity = await getEntity(context);
    if (!entity) return null;
    const project = await projects.getById(projectIdOf(entity));
    return project ? project.organisationId : null;
  };
}

/** A route keyed by an entity id that already carries its own
 * `organisationId` directly (e.g. `Policy`, which is organisation-scoped or
 * project-scoped but always carries `organisationId` either way) — no
 * project lookup needed. */
export function organisationIdViaEntity<TEntity>(
  getEntity: (context: RouteContext) => Promise<TEntity | null>,
  organisationIdOf: (entity: TEntity) => OrganisationId,
): OrganisationIdResolver {
  return async (context) => {
    const entity = await getEntity(context);
    return entity ? organisationIdOf(entity) : null;
  };
}
