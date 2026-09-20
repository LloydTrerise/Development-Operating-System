import type { KnowledgeSourceId, OrganisationId, ProjectId } from '@devos/contracts';
import {
  archiveKnowledgeSource,
  createKnowledgeSource,
  getKnowledgeSourceForPrincipal,
  getKnowledgeSourceReferences,
  installKnowledgeSource,
  listKnowledgeSourcesForProject,
  listSharedKnowledgeSourcesForOrganisation,
  shareKnowledgeSource,
  updateKnowledgeSource,
  type KnowledgeUseCaseDeps,
} from '@devos/application';
import {
  parseCreateKnowledgeSourceBody,
  parseInstallKnowledgeSourceBody,
  parseShareKnowledgeSourceBody,
  parseUpdateKnowledgeSourceBody,
  toKnowledgeReferenceDto,
  toKnowledgeSourceDto,
  toSharedKnowledgeSourceDto,
} from '../dto/knowledge-source.js';
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
    {
      method: 'PATCH',
      pattern: `${prefix}/knowledge-sources/:knowledgeSourceId`,
      protected: true,
      handler: async ({ principal, params, body }) => {
        const user = requirePrincipal(principal);
        const input = parseUpdateKnowledgeSourceBody(body);
        const source = await updateKnowledgeSource(
          deps,
          user.id,
          params.knowledgeSourceId as KnowledgeSourceId,
          input,
        );
        return toKnowledgeSourceDto(source);
      },
    },
    {
      method: 'POST',
      pattern: `${prefix}/knowledge-sources/:knowledgeSourceId/archive`,
      protected: true,
      handler: async ({ principal, params }) => {
        const user = requirePrincipal(principal);
        const source = await archiveKnowledgeSource(
          deps,
          user.id,
          params.knowledgeSourceId as KnowledgeSourceId,
        );
        return toKnowledgeSourceDto(source);
      },
    },
    {
      method: 'GET',
      pattern: `${prefix}/knowledge-sources/:knowledgeSourceId/references`,
      protected: true,
      handler: async ({ principal, params }) => {
        const user = requirePrincipal(principal);
        const references = await getKnowledgeSourceReferences(
          deps,
          user.id,
          params.knowledgeSourceId as KnowledgeSourceId,
        );
        return references.map(toKnowledgeReferenceDto);
      },
    },
    {
      method: 'POST',
      pattern: `${prefix}/knowledge-sources/:knowledgeSourceId/share`,
      protected: true,
      handler: async ({ principal, params, body }) => {
        const user = requirePrincipal(principal);
        const { shared } = parseShareKnowledgeSourceBody(body);
        const source = await shareKnowledgeSource(
          deps,
          user.id,
          params.knowledgeSourceId as KnowledgeSourceId,
          shared,
        );
        return toKnowledgeSourceDto(source);
      },
    },
    {
      method: 'GET',
      pattern: `${prefix}/organisations/:organisationId/shared-knowledge-sources`,
      protected: true,
      handler: async ({ principal, params }) => {
        const user = requirePrincipal(principal);
        const sources = await listSharedKnowledgeSourcesForOrganisation(
          deps,
          user.id,
          params.organisationId as OrganisationId,
        );
        return sources.map(toSharedKnowledgeSourceDto);
      },
    },
    {
      method: 'POST',
      pattern: `${prefix}/organisations/:organisationId/shared-knowledge-sources/:knowledgeSourceId/install`,
      protected: true,
      handler: async ({ principal, params, body }) => {
        const user = requirePrincipal(principal);
        const { targetProjectId } = parseInstallKnowledgeSourceBody(body);
        const source = await installKnowledgeSource(
          deps,
          user.id,
          params.knowledgeSourceId as KnowledgeSourceId,
          targetProjectId as ProjectId,
        );
        return toKnowledgeSourceDto(source);
      },
    },
  ];
}
