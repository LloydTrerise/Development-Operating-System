import type { Artifact, ArtifactVersion } from '@devos/domain';
import type { Kysely } from 'kysely';
import type { Database } from '../database.js';
import { createArtifactRepository } from './artifacts.js';
import { createArtifactVersionRepository } from './artifact-versions.js';
import { writeAuditRecord } from './audit-helper.js';
import { type QueryExecutor, withTransaction } from './base.js';
import { createEventEnvelope } from './event-envelope.js';
import { createOutboxEventRepository, getOrganisationIdForProject } from './outbox-events.js';

export type PublishArtifact = (artifact: Artifact, version: ArtifactVersion) => Promise<void>;

// System-actor createdBy sentinels recognized here: DEVOS-016's deterministic
// stub, and the generic agent-runtime system actor (see record-context-
// manifest.ts's identical SYSTEM_ACTOR_ID) — used for orchestration/budget
// writes that are not any one agent's own action, never for an artifact a
// specific concrete agent produced.
const SYSTEM_ACTOR_IDS = new Set(['devos-deterministic-stub', 'devos-agent-runtime']);

/**
 * DEVOS-297 (Sprint 48): `artifact.createdBy` is now, for the six real
 * agent-task handlers, a real `AGENT_PROFILE` principal id (`Agent.id`),
 * not the generic `devos-agent-runtime` sentinel — distinguished from a
 * human-authored artifact by a real `principals` lookup rather than a
 * second hardcoded sentinel set, since agent ids are freshly minted UUIDs
 * with no fixed literal to enumerate.
 */
async function resolveActorType(
  trx: QueryExecutor,
  createdBy: string,
): Promise<'SYSTEM' | 'USER' | 'AGENT'> {
  if (SYSTEM_ACTOR_IDS.has(createdBy)) return 'SYSTEM';
  const principal = await trx
    .selectFrom('principals')
    .select('principal_type')
    .where('id', '=', createdBy)
    .executeTakeFirst();
  return principal?.principal_type === 'AGENT' ? 'AGENT' : 'USER';
}

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
      // for API-created artifacts, a real agent's own principal id for an
      // agent-task handler's own output (DEVOS-297), or a recognized system
      // sentinel for a non-interactive handler (DEVOS-016's deterministic
      // stub) — no separate actorId parameter needed.
      await writeAuditRecord(trx, {
        organisationId,
        projectId: artifact.projectId,
        actorType: await resolveActorType(trx, artifact.createdBy),
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
