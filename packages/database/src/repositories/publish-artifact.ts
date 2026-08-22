import type { Artifact, ArtifactVersion } from '@devos/domain';
import type { Kysely } from 'kysely';
import type { Database } from '../database.js';
import { createArtifactRepository } from './artifacts.js';
import { createArtifactVersionRepository } from './artifact-versions.js';
import { writeAuditRecord } from './audit-helper.js';
import { withTransaction } from './base.js';
import { createEventEnvelope } from './event-envelope.js';
import { createOutboxEventRepository, getOrganisationIdForProject } from './outbox-events.js';

export type PublishArtifact = (artifact: Artifact, version: ArtifactVersion) => Promise<void>;

// System-actor createdBy sentinels recognized here: DEVOS-016's deterministic
// stub, and DEVOS-031's agent runtime (see run-discovery-agent-task.ts and
// record-context-manifest.ts's identical SYSTEM_ACTOR_ID). Any other
// createdBy is a real principal id, i.e. a USER-attributed artifact.
const SYSTEM_ACTOR_IDS = new Set(['devos-deterministic-stub', 'devos-agent-runtime']);

export function createArtifactPublisher(db: Kysely<Database>): PublishArtifact {
  return async (artifact, version) => {
    await withTransaction(db, async (trx) => {
      await createArtifactRepository(trx).create(artifact);
      await createArtifactVersionRepository(trx).create(version);

      const organisationId = await getOrganisationIdForProject(trx, artifact.projectId);
      const envelope = createEventEnvelope(
        'ArtifactCreated',
        'Artifact',
        artifact.id,
        {
          artifactType: artifact.artifactType,
          versionId: version.id,
          contentHash: version.contentHash,
        },
        { projectId: artifact.projectId },
      );
      await createOutboxEventRepository(trx).create(organisationId, envelope);

      // artifact.createdBy already carries the right actor — the principal
      // for API-created artifacts, or a recognized system sentinel for a
      // non-interactive handler (DEVOS-016's deterministic stub, DEVOS-031's
      // agent runtime) — no separate actorId parameter needed.
      await writeAuditRecord(trx, {
        organisationId,
        projectId: artifact.projectId,
        actorType: SYSTEM_ACTOR_IDS.has(artifact.createdBy) ? 'SYSTEM' : 'USER',
        actorId: artifact.createdBy,
        action: 'artifact.created',
        targetType: 'Artifact',
        targetId: artifact.id,
        outcome: 'SUCCESS',
        correlationId: envelope.correlationId,
      });
    });
  };
}
