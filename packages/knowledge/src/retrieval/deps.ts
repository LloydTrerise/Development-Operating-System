import type {
  ArtifactRepository,
  ArtifactVersionRepository,
  KnowledgeSourceRepository,
  ProjectRepository,
} from '@devos/domain';

/**
 * Retrieval functions are pure data access over already-authorised
 * repository ports — they do not themselves check project membership.
 * specs/api/poc-api-contracts.md §27's "Context retrieval must apply the
 * same permission checks as direct resource access" is satisfied by the
 * caller (the context builder, DEVOS-041, via `packages/application`)
 * resolving membership first, exactly like every other direct-resource use
 * case in this codebase already does — retrieval does not re-implement or
 * bypass that check.
 */
export interface RetrievalDeps {
  projects: ProjectRepository;
  knowledgeSources: KnowledgeSourceRepository;
  artifacts: ArtifactRepository;
  artifactVersions: ArtifactVersionRepository;
}
