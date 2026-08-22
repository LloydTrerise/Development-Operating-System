import type { ArtifactId, ProjectId } from '@devos/contracts';
import {
  createArtifact,
  getArtifactForPrincipal,
  getArtifactProvenance,
  getArtifactVersionByNumber,
  listArtifactVersions,
  listArtifactsForProject,
  type ArtifactUseCaseDeps,
} from '@devos/application';
import {
  parseCreateArtifactBody,
  parseVersionNumber,
  toArtifactDto,
  toArtifactVersionDto,
} from '../dto/artifact.js';
import { requirePrincipal, type Route } from '../http/router.js';

export function createArtifactRoutes(prefix: string, deps: ArtifactUseCaseDeps): Route[] {
  return [
    {
      method: 'GET',
      pattern: `${prefix}/projects/:projectId/artifacts`,
      protected: true,
      handler: async ({ principal, params }) => {
        const user = requirePrincipal(principal);
        const artifacts = await listArtifactsForProject(
          deps,
          user.id,
          params.projectId as ProjectId,
        );
        return artifacts.map(toArtifactDto);
      },
    },
    {
      method: 'POST',
      pattern: `${prefix}/projects/:projectId/artifacts`,
      protected: true,
      handler: async ({ principal, params, body }) => {
        const user = requirePrincipal(principal);
        const input = parseCreateArtifactBody(body);
        const { artifact } = await createArtifact(
          deps,
          user.id,
          params.projectId as ProjectId,
          input,
        );
        return toArtifactDto(artifact);
      },
    },
    {
      method: 'GET',
      pattern: `${prefix}/artifacts/:artifactId`,
      protected: true,
      handler: async ({ principal, params }) => {
        const user = requirePrincipal(principal);
        const artifact = await getArtifactForPrincipal(
          deps,
          user.id,
          params.artifactId as ArtifactId,
        );
        return toArtifactDto(artifact);
      },
    },
    {
      method: 'GET',
      pattern: `${prefix}/artifacts/:artifactId/versions`,
      protected: true,
      handler: async ({ principal, params }) => {
        const user = requirePrincipal(principal);
        const versions = await listArtifactVersions(deps, user.id, params.artifactId as ArtifactId);
        return versions.map(toArtifactVersionDto);
      },
    },
    {
      method: 'GET',
      pattern: `${prefix}/artifacts/:artifactId/versions/:version`,
      protected: true,
      handler: async ({ principal, params }) => {
        const user = requirePrincipal(principal);
        const versionNumber = parseVersionNumber(params.version!);
        const version = await getArtifactVersionByNumber(
          deps,
          user.id,
          params.artifactId as ArtifactId,
          versionNumber,
        );
        return toArtifactVersionDto(version);
      },
    },
    {
      method: 'GET',
      pattern: `${prefix}/artifacts/:artifactId/provenance`,
      protected: true,
      handler: async ({ principal, params }) => {
        const user = requirePrincipal(principal);
        return getArtifactProvenance(deps, user.id, params.artifactId as ArtifactId);
      },
    },
  ];
}
