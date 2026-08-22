import type { ContextManifest } from '@devos/domain';
import type { Kysely } from 'kysely';
import type { Database } from '../database.js';
import { writeAuditRecord } from './audit-helper.js';
import { withTransaction } from './base.js';
import { createContextManifestRepository } from './context-manifests.js';
import { getOrganisationIdForProject } from './outbox-events.js';

export type RecordContextManifest = (manifest: ContextManifest) => Promise<void>;

const SYSTEM_ACTOR_ID = 'devos-agent-runtime';

/**
 * Writes the manifest row and an audit record in one transaction — the
 * manifest is "linked to the execution's audit trail" (DEVOS-030's
 * acceptance criterion) via this audit record's targetId, rather than a
 * parallel logging mechanism, extending the same pattern createArtifactPublisher
 * (publish-artifact.ts) already established for artifact creation.
 */
export function createContextManifestRecorder(db: Kysely<Database>): RecordContextManifest {
  return async (manifest) => {
    await withTransaction(db, async (trx) => {
      await createContextManifestRepository(trx).create(manifest);

      const organisationId = await getOrganisationIdForProject(trx, manifest.projectId);
      await writeAuditRecord(trx, {
        organisationId,
        projectId: manifest.projectId,
        actorType: 'SYSTEM',
        actorId: SYSTEM_ACTOR_ID,
        action: 'context_manifest.created',
        targetType: 'ContextManifest',
        targetId: manifest.id,
        outcome: 'SUCCESS',
        metadata: {
          agentExecutionId: manifest.agentExecutionId,
          sourceCount: manifest.sources.length,
        },
      });
    });
  };
}
