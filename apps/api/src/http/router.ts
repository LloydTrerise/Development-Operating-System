import type { Principal } from '@devos/identity';
import { AuthenticationError } from './errors.js';

export interface RouteContext {
  principal: Principal | null;
  params: Record<string, string>;
  body: unknown;
  /**
   * DEVOS-088: the same id already returned to the caller as
   * `meta.requestId` (and the `x-correlation-id` response header) — made
   * available to route handlers too, so it can be threaded into a workflow
   * run and, from there, into the agent/tool activity it causes.
   */
  correlationId: string;
}

export type RouteHandler = (context: RouteContext) => unknown | Promise<unknown>;

export interface Route {
  method: string;
  pattern: string;
  protected: boolean;
  handler: RouteHandler;
}

export function requirePrincipal(principal: Principal | null): Principal {
  if (!principal) throw new AuthenticationError();
  return principal;
}

export function matchPath(pattern: string, pathname: string): Record<string, string> | null {
  const patternSegments = pattern.split('/').filter(Boolean);
  const pathSegments = pathname.split('/').filter(Boolean);
  if (patternSegments.length !== pathSegments.length) return null;

  const params: Record<string, string> = {};
  for (let index = 0; index < patternSegments.length; index++) {
    const patternSegment = patternSegments[index]!;
    const pathSegment = pathSegments[index]!;
    if (patternSegment.startsWith(':')) {
      params[patternSegment.slice(1)] = decodeURIComponent(pathSegment);
    } else if (patternSegment !== pathSegment) {
      return null;
    }
  }
  return params;
}

export function findRoute(
  routes: Route[],
  method: string | undefined,
  pathname: string,
): { route: Route; params: Record<string, string> } | undefined {
  for (const route of routes) {
    if (route.method !== method) continue;
    const params = matchPath(route.pattern, pathname);
    if (params) return { route, params };
  }
  return undefined;
}
