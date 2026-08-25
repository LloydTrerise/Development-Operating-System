import type { ArtifactId, ArtifactVersionId, ProjectId } from '@devos/contracts';
import {
  createArtifact,
  getArtifactForPrincipal,
  getArtifactProvenance,
  getArtifactVersionByNumber,
  getArtifactVersionById,
  listArtifactVersions,
  listArtifactsForProject,
  type ArtifactUseCaseDeps,
} from '@devos/application';
import {
  parseCreateArtifactBody,
  parseVersionNumber,
  toArtifactDto,
  toArtifactVersionDto,
  toArtifactVersionWithArtifactDto,
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
      // DEVOS-095: resolves a bare artifact-version id (all an approval's
      // evidence reference carries, DEVOS-045) to its owning artifact's
      // name/type — not in specs/api/poc-api-contracts.md's own route
      // table (§29-30 keys evidence purely by artifactVersionId, with no
      // by-id lookup route defined), added to close the real usability gap
      // this task's acceptance criterion requires, per the DEVOS-046/060/
      // 070/080/090 "build to the task's own acceptance criterion when no
      // spec/wireframe defines the exact surface" precedent.
      method: 'GET',
      pattern: `${prefix}/artifact-versions/:artifactVersionId`,
      protected: true,
      handler: async ({ principal, params }) => {
        const user = requirePrincipal(principal);
        const result = await getArtifactVersionById(
          deps,
          user.id,
          params.artifactVersionId as ArtifactVersionId,
        );
        return toArtifactVersionWithArtifactDto(result);
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
