import type { KnowledgeSourceId, ProjectId } from '@devos/contracts';
import {
  createKnowledgeSource,
  getKnowledgeSourceForPrincipal,
  listKnowledgeSourcesForProject,
  type KnowledgeUseCaseDeps,
} from '@devos/application';
import { parseCreateKnowledgeSourceBody, toKnowledgeSourceDto } from '../dto/knowledge-source.js';
import { requirePrincipal, type Route } from '../http/router.js';

export function createKnowledgeSourceRoutes(prefix: string, deps: KnowledgeUseCaseDeps): Route[] {
  return [
    {
      method: 'GET',
      pattern: `${prefix}/projects/:projectId/knowledge-sources`,
      protected: true,
      handler: async ({ principal, params }) => {
        const user = requirePrincipal(principal);
        const sources = await listKnowledgeSourcesForProject(
          deps,
          user.id,
          params.projectId as ProjectId,
        );
        return sources.map(toKnowledgeSourceDto);
      },
    },
    {
      method: 'POST',
      pattern: `${prefix}/projects/:projectId/knowledge-sources`,
      protected: true,
      handler: async ({ principal, params, body }) => {
        const user = requirePrincipal(principal);
        const input = parseCreateKnowledgeSourceBody(body);
        const source = await createKnowledgeSource(
          deps,
          user.id,
          params.projectId as ProjectId,
          input,
        );
        return toKnowledgeSourceDto(source);
      },
    },
    {
      method: 'GET',
      pattern: `${prefix}/knowledge-sources/:knowledgeSourceId`,
      protected: true,
      handler: async ({ principal, params }) => {
        const user = requirePrincipal(principal);
        const source = await getKnowledgeSourceForPrincipal(
          deps,
          user.id,
          params.knowledgeSourceId as KnowledgeSourceId,
        );
        return toKnowledgeSourceDto(source);
      },
    },
  ];
}
