import type { ProjectId, WorkItemId } from '@devos/contracts';
import type { Kysely } from 'kysely';
import type { Database } from '../database.js';
import { writeAuditRecord } from './audit-helper.js';
import { withTransaction } from './base.js';
import { getOrganisationIdForProject } from './outbox-events.js';
import { createWorkItemRepository } from './work-items.js';

export type CloseWorkItem = (
  workItemId: WorkItemId,
  projectId: ProjectId,
  metadata: Record<string, unknown>,
  closedAt: string,
) => Promise<void>;

const SYSTEM_ACTOR_ID = 'devos-agent-runtime';

/**
 * DEVOS-078: Stage 12 — Closure (specs/workflows/software-change-workflow.md
 * §23) — "Closure should publish: final outcome; final artifacts; release
 * evidence; review evidence; validation evidence; approval evidence;
 * execution history; traceability; audit information." No closure-specific
 * table or event is specified anywhere, so this reuses exactly the pattern
 * `createContextManifestRecorder`/`createArtifactPublisher` already
 * established: one transaction, a state change plus its own linked audit
 * record — not a new mechanism. The work item's own `status` becomes
 * `'CLOSED'` (an opaque string, like every other status this codebase
 * already uses for a domain-specific terminal state — e.g. DEVOS-067/068's
 * `'REWORK_LIMIT_REACHED'`); `metadata` carries every linked evidence
 * reference (`testEvidenceArtifactId`, `reviewEvidenceArtifactId`,
 * `releaseApprovalId`, `releaseEvidenceArtifactId`) so "traceability" is
 * satisfied by direct reference, not by re-deriving it later. The audit
 * record's own `metadata` mirrors the same references, giving closure the
 * same "material action is auditable" guarantee every other terminal state
 * change in this codebase already has.
 */
export function createWorkItemCloser(db: Kysely<Database>): CloseWorkItem {
  return async (workItemId, projectId, metadata, closedAt) => {
    await withTransaction(db, async (trx) => {
      await createWorkItemRepository(trx).update(
        workItemId,
        { status: 'CLOSED', metadata },
        closedAt,
      );

      const organisationId = await getOrganisationIdForProject(trx, projectId);
      await writeAuditRecord(trx, {
        organisationId,
        projectId,
        actorType: 'SYSTEM',
        actorId: SYSTEM_ACTOR_ID,
        action: 'work_item.closed',
        targetType: 'WorkItem',
        targetId: workItemId,
        outcome: 'SUCCESS',
        metadata,
      });
    });
  };
}
