import type { ContextManifest } from '@devos/domain';
import type { Kysely } from 'kysely';
import type { Database } from '../database.js';
import { writeAuditRecord } from './audit-helper.js';
import { withTransaction } from './base.js';
import { createContextManifestRepository } from './context-manifests.js';
import { getOrganisationIdForProject } from './outbox-events.js';

/**
 * DEVOS-297 (Sprint 48): `actorId` is new — `runAgentTask` (this function's
 * only production caller) always passes the resolved agent's own real
 * `AGENT_PROFILE` principal id (`Agent.id`), since a context manifest is
 * only ever recorded as part of one specific agent's own execution. A
 * function type widening a required parameter is a real, deliberate
 * behavior change here (unlike an optional-and-additive widening) — TypeScript's
 * own "fewer parameters is assignable to more parameters" leniency still
 * lets every existing `async (manifest) => {...}` test fake type-check
 * unmodified, since JS ignores an extra argument a fake never reads.
 */
export type RecordContextManifest = (manifest: ContextManifest, actorId: string) => Promise<void>;

/**
 * Writes the manifest row and an audit record in one transaction — the
 * manifest is "linked to the execution's audit trail" (DEVOS-030's
 * acceptance criterion) via this audit record's targetId, rather than a
 * parallel logging mechanism, extending the same pattern createArtifactPublisher
 * (publish-artifact.ts) already established for artifact creation.
 */
export function createContextManifestRecorder(db: Kysely<Database>): RecordContextManifest {
  return async (manifest, actorId) => {
    await withTransaction(db, async (trx) => {
      await createContextManifestRepository(trx).create(manifest);

      const organisationId = await getOrganisationIdForProject(trx, manifest.projectId);
      await writeAuditRecord(trx, {
        organisationId,
        projectId: manifest.projectId,
        actorType: 'AGENT',
        actorId,
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
