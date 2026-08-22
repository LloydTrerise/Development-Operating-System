import { requirePrincipal, type Route } from '../http/router.js';

export function createMeRoutes(prefix: string): Route[] {
  return [
    {
      method: 'GET',
      pattern: `${prefix}/me`,
      protected: true,
      handler: ({ principal }): { id: string } => {
        const user = requirePrincipal(principal);
        return { id: user.id };
      },
    },
  ];
}
