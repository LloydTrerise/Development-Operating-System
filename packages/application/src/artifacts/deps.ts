import type {
  ArtifactRepository,
  ArtifactVersionRepository,
  MembershipRepository,
  ProjectRepository,
} from '@devos/domain';
import type { ArtifactStorage } from '@devos/storage';
import type { PublishArtifact } from '../tasks/deps.js';

export interface ArtifactUseCaseDeps {
  projects: ProjectRepository;
  memberships: MembershipRepository;
  artifacts: ArtifactRepository;
  artifactVersions: ArtifactVersionRepository;
  storage: ArtifactStorage;
  publishArtifact: PublishArtifact;
}
